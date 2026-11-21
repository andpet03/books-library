(() => {
  'use strict';
  const F = window.Folio, $ = id => document.getElementById(id), h = F.escape;
  const SHELF_KEY = 'folio.shelf.v1', PAGE_SIZE = 36;
  let books = [], categories = [], run = null, page = 1, view = 'browse', loading = false;
  let selected = new Set(), shelf = Object.create(null), detailId = null, historyToken = 0, historyRows = [], historyMode = 'price';
  let pickerBooks = [], api, toastTimer, storageWarning = false;
  const statuses = {want:'Want to read',reading:'Currently reading',read:'Finished'};
  const date = value => new Date(value).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'});
  const byId = id => books.find(b => b.book_id === id);
  const rating = value => value == null ? 'Not rated' : `<span class="stars" aria-label="${Number(value)} out of 5 stars">${'★'.repeat(Math.max(0,Math.min(5,Number(value))))}<span class="muted-stars">${'☆'.repeat(Math.max(0,5-Number(value)))}</span>`;
  function toast(text) { clearTimeout(toastTimer); $('toast').textContent = text; $('toast').hidden = false; toastTimer = setTimeout(() => $('toast').hidden = true, 4000); }
  function loadShelf() {
    try { const data = localStorage.getItem(SHELF_KEY); if (data) shelf = F.normaliseShelf(JSON.parse(data)); }
    catch { storageWarning = true; $('notice').textContent = 'Your saved shelf could not be opened. This visit will start with an empty shelf; restore a backup if you have one.'; $('notice').hidden = false; }
  }
  function backup() { return {version:1,exported_at:new Date().toISOString(),books:Object.entries(shelf).map(([book_id,value])=>({book_id,...value}))}; }
  function persist() {
    try { localStorage.setItem(SHELF_KEY,JSON.stringify(backup())); }
    catch { storageWarning = true; $('notice').textContent = 'Browser storage is unavailable or full. Your shelf is kept for this visit only. Download a backup before leaving.'; $('notice').hidden = false; }
    counts();
  }
  function counts() {
    $('shelf-count').textContent = Object.keys(shelf).length;
    $('compare-count').textContent = selected.size;
    $('compare-tray').hidden = !selected.size || view === 'compare';
    $('tray-text').textContent = `${selected.size} of 3 books selected`;
  }
  function cover(book, extra='') {
    const url = F.safeSource(book.cover_url);
    return `<div class="cover ${extra}" style="--book-hue:${[...book.book_id].reduce((s,c)=>s+c.charCodeAt(0),0)%360}"><div class="cover-fallback"><span>FOLIO COLLECTION</span><strong>${h(book.title)}</strong><i>✧</i></div>${url?`<img src="${h(url)}" alt="Cover of ${h(book.title)}" loading="lazy" decoding="async">`:''}</div>`;
  }
  function card(b, shelfMode=false) {
    const saved = !!shelf[b.book_id], compared = selected.has(b.book_id);
    return `<article class="book-card"><div class="card-art"><button class="cover-button" data-action="detail" data-id="${h(b.book_id)}" aria-label="Details for ${h(b.title)}">${cover(b)}</button><button class="heart ${saved?'saved':''}" data-action="save" data-id="${h(b.book_id)}" aria-pressed="${saved}" aria-label="${saved?'Remove from':'Save to'} my shelf: ${h(b.title)}">${saved?'♥':'♡'}</button>${shelfMode?`<span class="reading-badge">${statuses[shelf[b.book_id].status]}</span>`:''}</div><div class="card-copy"><span class="category-text">${h(b.category)}</span><h3><button data-action="detail" data-id="${h(b.book_id)}">${h(b.title)}</button></h3><div class="rating-row">${rating(b.rating)}<span>${b.availability > 0 ? `${b.availability} available`:'Out of stock'}</span></div><div class="card-bottom"><strong>${F.money(b.price)}</strong><button class="compare-button ${compared?'chosen':''}" data-action="compare" data-id="${h(b.book_id)}" aria-pressed="${compared}" aria-label="${compared?'Remove from comparison':'Compare'}: ${h(b.title)}">${compared?'✓ Added':'+ Compare'}</button></div></div></article>`;
  }
  function filters() { return {query:$('search').value,category:$('category').value,max:$('max-price').value,rating:$('rating').value,stock:$('stock').checked,sort:$('sort').value}; }
  function renderBrowse() {
    const result = F.filterBooks(books,filters()), pages = Math.max(1,Math.ceil(result.length/PAGE_SIZE));
    page = Math.min(page,pages);
    const start = (page-1)*PAGE_SIZE;
    $('book-grid').innerHTML = result.slice(start,start+PAGE_SIZE).map(b=>card(b)).join('');
    $('book-grid').setAttribute('aria-busy','false');
    $('browse-empty').hidden = !!result.length || loading;
    $('result-count').textContent = result.length ? `${start+1}–${Math.min(start+PAGE_SIZE,result.length)} of ${result.length.toLocaleString()} matching books · ${books.length.toLocaleString()} in the collection` : (loading?'Opening the shelves…':'No matching books');
    $('pagination').hidden = pages <= 1;
    $('page-label').textContent = `Page ${page} of ${pages}`;
    $('previous').disabled = page === 1; $('next').disabled = page === pages;
    document.querySelectorAll('[data-genre]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.genre===$('category').value)));
  }
  function renderShelf() {
    const state = $('shelf-filter').value;
    const saved = books.filter(b=>shelf[b.book_id] && (state==='all'||shelf[b.book_id].status===state));
    $('shelf-grid').innerHTML = saved.map(b=>card(b,true)).join('');
    $('shelf-empty').hidden = saved.length > 0;
    const missing = Object.entries(shelf).filter(([id])=>!byId(id));
    $('missing-shelf').innerHTML = missing.length ? `<p>${missing.length} saved book(s) are not in the latest catalogue. Your notes remain in your backup.</p><ul>${missing.map(([id,v])=>`<li>${h(v.title||id)} <button class="text-button" data-action="save" data-id="${h(id)}">Remove from shelf</button></li>`).join('')}</ul>` : '';
  }
  function renderCompare() {
    const chosen = [...selected].map(byId).filter(Boolean);
    if (!chosen.length) { $('compare-content').innerHTML = '<div class="empty"><span class="empty-symbol">⇄</span><h3>A closer look makes all the difference.</h3><p>Choose “+ Compare” on up to three books in the catalogue.</p><button class="primary" data-view="browse">Explore books →</button></div>'; return; }
    const min = Math.min(...chosen.map(b=>b.price));
    $('compare-content').innerHTML = `<div class="table-scroll"><table class="comparison"><caption class="sr-only">Comparison of selected books</caption><thead><tr><th scope="col">A closer look</th>${chosen.map(b=>`<th scope="col">${cover(b,'mini-cover')}<button class="comparison-title" data-action="detail" data-id="${h(b.book_id)}">${h(b.title)}</button><button class="text-button" data-action="compare" data-id="${h(b.book_id)}">Remove</button></th>`).join('')}</tr></thead><tbody><tr><th scope="row">Recorded price</th>${chosen.map(b=>`<td><strong>${F.money(b.price)}</strong>${b.price===min?'<span class="best-price">Lowest in this comparison</span>':''}</td>`).join('')}</tr><tr><th scope="row">Category</th>${chosen.map(b=>`<td>${h(b.category)}</td>`).join('')}</tr><tr><th scope="row">Source rating</th>${chosen.map(b=>`<td>${rating(b.rating)}</td>`).join('')}</tr><tr><th scope="row">Available copies</th>${chosen.map(b=>`<td>${b.availability}</td>`).join('')}</tr><tr><th scope="row">My shelf</th>${chosen.map(b=>`<td><button data-action="save" data-id="${h(b.book_id)}" class="outline">${shelf[b.book_id]?'♥ Saved':'♡ Save book'}</button></td>`).join('')}</tr></tbody></table></div>`;
  }
  function renderPicker() {
    if (!pickerBooks.length) return;
    const total = pickerBooks.reduce((s,b)=>s+Math.round(b.price*100),0)/100;
    $('picker-result').innerHTML = `<div class="section-heading"><div><span class="eyebrow">YOUR NEXT CHAPTER</span><h3>${pickerBooks.length===1?'A story with your name on it.':'A little stack of possibilities.'}</h3></div><strong>${F.money(total)} total</strong></div><div class="book-grid picker-grid">${pickerBooks.map(b=>card(b)).join('')}</div>`;
  }
  function renderAll() { counts(); renderBrowse(); renderShelf(); renderCompare(); renderPicker(); }
  function setView(next, updateHash=true) {
    view = ['browse','shelf','picker','compare'].includes(next)?next:'browse';
    for (const name of ['browse','shelf','picker','compare']) $(name+'-view').hidden = name!==view;
    $('hero').hidden = view!=='browse';
    document.querySelectorAll('header [data-view]').forEach(b=>{if(b.dataset.view===view)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
    if (updateHash && location.hash !== '#'+view) history.replaceState(null,'','#'+view);
    counts();
    if (view==='shelf') renderShelf(); if(view==='compare') renderCompare();
  }
  function refreshGenreOptions() {
    const ids = new Set(books.map(b=>b.category_id));
    const relevant = categories.filter(c=>ids.has(c.category_id)).sort((a,b)=>a.name.localeCompare(b.name));
    const options = relevant.map(c=>`<option value="${h(c.category_id)}">${h(c.name)}</option>`).join('');
    const current = $('category').value, picker = $('picker-category').value;
    $('category').innerHTML = '<option value="">Every category</option>'+options;
    $('picker-category').innerHTML = '<option value="">Surprise me — any category</option>'+options;
    if(ids.has(current)) $('category').value=current; if(ids.has(picker)) $('picker-category').value=picker;
    const names = ['Fiction','Mystery','Fantasy','Romance','Poetry','Nonfiction','Science Fiction'];
    $('genre-chips').innerHTML = '<button data-genre="" aria-pressed="true">All stories</button>'+names.map(name=>relevant.find(c=>c.name===name)).filter(Boolean).map(c=>`<button data-genre="${h(c.category_id)}" aria-pressed="false">${h(c.name)}</button>`).join('');
  }
  function updateHero() {
    $('hero-count').textContent = `${books.length.toLocaleString()} books · ${new Set(books.map(b=>b.category_id)).size} categories`;
    const picks = books.filter(b=>F.safeSource(b.cover_url)).slice(0,3);
    if(picks.length===3) $('hero-books').innerHTML = picks.map((b,i)=>`<div class="art-book book-${['one','two','three'][i]}">${cover(b)}</div>`).join('');
  }
  async function load() {
    if(loading)return;
    loading=true; $('refresh').disabled=true; $('retry').disabled=true; $('load-error').hidden=true;
    const freshness = $('freshness').textContent;
    $('freshness').textContent = books.length?'Checking for a newer collection…':'Opening the latest collection…';
    if(!books.length) $('book-grid').innerHTML = Array.from({length:6},()=>'<div class="skeleton"><div></div><span></span><span></span></div>').join('');
    try {
      api = api || new window.CatalogueAPI(window.FOLIO_CONFIG);
      const data = await api.catalogue(n=>{if(!books.length)$('freshness').textContent=`Reading the collection · ${n.toLocaleString()} books`;});
      books=data.books; categories=data.categories; run=data.run;
      selected = new Set([...selected].filter(byId)); pickerBooks=[]; $('picker-result').innerHTML='';
      refreshGenreOptions(); updateHero(); loading=false; renderAll();
      const age=(Date.now()-new Date(run.finished_at).getTime())/3600000;
      $('freshness').textContent = `Last completed collection: ${date(run.finished_at)}${age>48?' · More than 48 hours old':''}`;
      if(detailId && $('book-dialog').open) openDetail(detailId);
    } catch(error) {
      $('load-error').hidden=false; $('error-text').textContent = error.message || 'Please check your connection.';
      $('freshness').textContent = books.length?`${freshness} · Refresh failed; showing the previous collection`:'Catalogue unavailable';
      if(!books.length){$('book-grid').innerHTML='';$('result-count').textContent='No catalogue loaded';$('hero-count').textContent='A collection worth exploring';}
    } finally { loading=false;$('refresh').disabled=false;$('retry').disabled=false;$('book-grid').setAttribute('aria-busy','false'); }
  }
  function toggleSave(id) {
    if(shelf[id]) {delete shelf[id];toast('Removed from your shelf.');}
    else { const b=byId(id);if(!b)return; shelf[id]={status:'want',note:'',title:b.title};toast('Saved to your shelf.'); }
    persist();renderAll(); if(detailId===id && $('book-dialog').open) renderPersonal();
  }
  function toggleCompare(id) {
    if(selected.has(id))selected.delete(id);
    else {if(selected.size===3){toast('Choose up to three books. Remove one before adding another.');return;}selected.add(id);}
    renderAll();
  }
  function renderPersonal() {
    const node=$('personal-controls'), b=byId(detailId); if(!node||!b)return;
    const entry=shelf[detailId];
    node.innerHTML = entry?`<div class="personal-heading"><h3>On your shelf</h3><button class="text-button" data-action="save" data-id="${h(detailId)}">Remove</button></div><label>Reading status<select id="reading-status">${Object.entries(statuses).map(([value,label])=>`<option value="${value}" ${value===entry.status?'selected':''}>${label}</option>`).join('')}</select></label><label>A note to yourself<textarea id="book-note" maxlength="2000" rows="3" placeholder="Why this book? A thought to come back to…">${h(entry.note)}</textarea></label><span class="small muted">Saved automatically in this browser.</span>`:`<button class="primary" data-action="save" data-id="${h(detailId)}">♡ Add to my shelf</button>`;
  }
  async function openDetail(id) {
    const b=byId(id);if(!b)return;
    detailId=id; historyRows=[];historyMode='price'; const token=++historyToken;
    $('book-detail').innerHTML=`<div class="detail-top">${cover(b,'detail-cover')}<div><span class="eyebrow">${h(b.category)}</span><h2 id="detail-title">${h(b.title)}</h2><div class="detail-rating">${rating(b.rating)} <span>${b.review_count} source reviews</span></div><div class="detail-price">${F.money(b.price)} <span>${b.availability>0?`${b.availability} copies available`:'Out of stock'}</span></div><p class="small muted">Recorded ${h(date(b.observed_at))}. Demonstration data.</p>${F.safeSource(b.source_url)?`<a class="text-link" href="${h(F.safeSource(b.source_url))}" target="_blank" rel="noopener noreferrer">View source page ↗</a>`:''}<p class="small muted">Book ID (UPC): ${h(b.book_id)}</p></div></div><div class="detail-body"><section><span class="eyebrow">BETWEEN THE COVERS</span><h3>About this book</h3><p class="description">${h(b.description || 'The source catalogue does not provide a description for this book.')}</p></section><section id="personal-controls" class="personal"></section></div><section class="history-section"><div class="history-header"><div><span class="eyebrow">THE STORY IN NUMBERS</span><h3>Recorded over time.</h3></div><div class="segmented" aria-label="History metric"><button data-metric="price" aria-pressed="true">Price</button><button data-metric="stock" aria-pressed="false">Available copies</button></div></div><div id="history-content" role="status">Loading this book’s history…</div><p class="small muted">Each point is a collection, not a price change. A flat line means the recorded value stayed the same. Only completed collections are shown.</p></section>`;
    renderPersonal();
    if(!$('book-dialog').open)$('book-dialog').showModal();
    $('book-dialog').scrollTop=0;
    try {const rows=await api.history(id,run.finished_at);if(token!==historyToken)return;historyRows=rows;renderHistory();}
    catch {if(token===historyToken)$('history-content').innerHTML='<p>History could not be loaded. Close this book and open it again to retry.</p>';}
  }
  function renderHistory() {
    if(!$('history-content'))return;
    document.querySelectorAll('[data-metric]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.metric===historyMode)));
    if(!historyRows.length){$('history-content').textContent='No history is available for this book yet.';return;}
    const price=historyMode==='price', values=historyRows.map(r=>Number(price?r.price_incl_tax:r.availability));
    if(values.some(v=>!Number.isFinite(v))){$('history-content').textContent='History contains an unreadable value.';return;}
    const times=historyRows.map(r=>new Date(r.observed_at).getTime()), max=Math.max(...values), min=Math.min(...values), spread=max-min||Math.max(max*.1,1);
    const lo=Math.max(0,min-spread*.15), hi=max+spread*.15, x=i=>60+(times[i]-times[0])/(times[times.length-1]-times[0]||1)*660, y=v=>175-(v-lo)/(hi-lo||1)*140;
    const points=values.map((v,i)=>`${x(i)},${y(v)}`).join(' ');
    const format=v=>price?F.money(v):String(Math.round(v));
    $('history-content').innerHTML=`<div class="history-stats"><div><span>First recorded</span><strong>${format(values[0])}</strong></div><div><span>Latest recorded</span><strong>${format(values[values.length-1])}</strong></div><div><span>Lowest recorded</span><strong>${format(min)}</strong></div><div><span>Observations</span><strong>${values.length}</strong></div></div><svg class="history-chart" viewBox="0 0 780 225" role="img" aria-label="${price?'Price':'Available copies'} history, ${values.length} observations. Full values are in the table below."><line x1="60" y1="175" x2="720" y2="175" stroke="#d6dbd5"/><line x1="60" y1="35" x2="720" y2="35" stroke="#e9ece6"/><text x="3" y="40">${h(format(hi))}</text><text x="3" y="180">${h(format(lo))}</text><polyline points="${points}" fill="none" stroke="#b45135" stroke-width="3" stroke-linejoin="round"/>${values.map((v,i)=>`<circle cx="${x(i)}" cy="${y(v)}" r="4" fill="#b45135"><title>${h(date(historyRows[i].observed_at))}: ${h(format(v))}</title></circle>`).join('')}<text x="60" y="213">${h(new Date(times[0]).toLocaleDateString())}</text><text x="720" y="213" text-anchor="end">${h(new Date(times[times.length-1]).toLocaleDateString())}</text></svg><details><summary>See all recorded values (${values.length})</summary><div class="table-scroll"><table class="history-table"><thead><tr><th scope="col">Collection time</th><th scope="col">Price</th><th scope="col">Available copies</th></tr></thead><tbody>${historyRows.slice().reverse().map(r=>`<tr><td>${h(date(r.observed_at))}</td><td>${F.money(r.price_incl_tax)}</td><td>${Number(r.availability)}</td></tr>`).join('')}</tbody></table></div></details>`;
  }
  function resetFilters() {$('filters').reset();page=1;renderBrowse();}
  document.addEventListener('click',event=>{
    const nav=event.target.closest('[data-view]');if(nav){setView(nav.dataset.view);window.scrollTo({top:0,behavior:'smooth'});return;}
    const genre=event.target.closest('[data-genre]');if(genre){$('category').value=genre.dataset.genre;page=1;renderBrowse();return;}
    const action=event.target.closest('[data-action]');if(action){const {action:type,id}=action.dataset;if(type==='detail')openDetail(id);if(type==='save')toggleSave(id);if(type==='compare')toggleCompare(id);return;}
    const metric=event.target.closest('[data-metric]');if(metric){historyMode=metric.dataset.metric;renderHistory();}
  });
  document.addEventListener('error',event=>{if(event.target.tagName==='IMG')event.target.hidden=true;},true);
  document.addEventListener('change',event=>{if(event.target.id==='reading-status' && shelf[detailId]){shelf[detailId].status=event.target.value;persist();renderShelf();}});
  document.addEventListener('input',event=>{if(event.target.id==='book-note' && shelf[detailId]){shelf[detailId].note=event.target.value;persist();}});
  $('filters').addEventListener('submit',e=>e.preventDefault());
  $('filters').addEventListener('input',()=>{page=1;renderBrowse();});
  $('filters').addEventListener('change',()=>{page=1;renderBrowse();});
  $('reset').onclick=resetFilters; $('empty-reset').onclick=resetFilters;
  $('previous').onclick=()=>{page--;renderBrowse();$('catalogue').scrollIntoView({behavior:'smooth'});};
  $('next').onclick=()=>{page++;renderBrowse();$('catalogue').scrollIntoView({behavior:'smooth'});};
  $('shelf-filter').onchange=renderShelf;
  $('refresh').onclick=load; $('retry').onclick=load;
  $('clear-compare').onclick=()=>{selected.clear();renderAll();};
  $('close-detail').onclick=()=>$('book-dialog').close();
  $('book-dialog').addEventListener('close',()=>{historyToken++;detailId=null;});
  $('picker-form').onsubmit=event=>{
    event.preventDefault(); if(!books.length){toast('Wait for the catalogue to load first.');return;}
    const genre=$('picker-category').value;
    const pool=books.filter(b=>(!genre||b.category_id===genre)&&(!$('exclude-read').checked||shelf[b.book_id]?.status!=='read'));
    pickerBooks=F.bundle(pool,Number($('budget').value),Number($('bundle-size').value));
    if(!pickerBooks.length)$('picker-result').innerHTML='<div class="empty"><h3>No match within that budget.</h3><p>Try increasing the budget or choosing a different category.</p></div>';
    else renderPicker();
  };
  $('export-shelf').onclick=()=>{const blob=new Blob([JSON.stringify(backup(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='folio-shelf.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  $('import-shelf').onchange=async event=>{
    const file=event.target.files[0];if(!file)return;
    try {if(file.size>5000000)throw new Error('Please choose a backup smaller than 5 MB.');const incoming=F.normaliseShelf(JSON.parse(await file.text()));
      // Keep current entries when the same book exists in both shelves.
      shelf=Object.assign(Object.create(null),incoming,shelf);persist();renderAll();toast('Backup restored. Existing notes were kept.');
    }catch(error){toast(error instanceof SyntaxError?'This file is not a valid JSON backup.':error.message);}finally{event.target.value='';}
  };
  window.addEventListener('hashchange',()=>{if(location.hash!=='#catalogue')setView(location.hash.slice(1),false);});
  loadShelf();setView(location.hash.slice(1),false);load();
})();
