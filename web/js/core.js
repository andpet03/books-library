/* Shared pure logic, usable in the browser and in Node's offline tests. */
(function (root) {
  'use strict';
  const money = value => new Intl.NumberFormat('en-GB', {style:'currency',currency:'GBP'}).format(Number(value));
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  function safeSource(value) {
    try { const u = new URL(value); return u.protocol === 'https:' && u.hostname === 'books.toscrape.com' && !u.username && !u.password ? u.href : ''; }
    catch { return ''; }
  }
  function filterBooks(books, filters) {
    const query = String(filters.query || '').trim().toLocaleLowerCase();
    const max = filters.max === '' || filters.max == null ? Infinity : Number(filters.max);
    const rating = Number(filters.rating || 0);
    const result = books.filter(b => (!query || `${b.title} ${b.description || ''} ${b.category}`.toLocaleLowerCase().includes(query))
      && (!filters.category || b.category_id === filters.category)
      && b.price <= max && (!rating || (b.rating != null && b.rating >= rating))
      && (!filters.stock || b.availability > 0));
    const order = {
      'title': (a,b) => a.title.localeCompare(b.title),
      'rating': (a,b) => (b.rating ?? -1) - (a.rating ?? -1),
      'price-low': (a,b) => a.price - b.price,
      'price-high': (a,b) => b.price - a.price,
      'stock': (a,b) => b.availability - a.availability
    }[filters.sort] || ((a,b) => a.title.localeCompare(b.title));
    return result.sort((a,b) => order(a,b) || a.title.localeCompare(b.title) || a.book_id.localeCompare(b.book_id));
  }
  function bundle(books, budget, count, random = Math.random) {
    let remaining = Math.round(Number(budget) * 100);
    if (!Number.isFinite(remaining) || remaining <= 0) return [];
    const pool = books.filter(b => b.availability > 0 && Number.isFinite(b.price) && b.price >= 0).slice();
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(random() * (i+1)); [pool[i],pool[j]] = [pool[j],pool[i]]; }
    const picked = [];
    for (const book of pool) {
      const price = Math.round(book.price * 100);
      if (picked.length >= count) break;
      if (price <= remaining) { picked.push(book); remaining -= price; }
    }
    return picked;
  }
  function normaliseShelf(input) {
    if (!input || input.version !== 1 || !Array.isArray(input.books) || input.books.length > 10000) throw new Error('Choose a valid FOLIO shelf backup.');
    const result = Object.create(null);
    for (const row of input.books) {
      if (!row || typeof row.book_id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(row.book_id)
        || !['want','reading','read'].includes(row.status) || typeof row.note !== 'string' || row.note.length > 2000) throw new Error('This backup contains an invalid book entry.');
      result[row.book_id] = {status: row.status, note: row.note, title: String(row.title || '').slice(0,500)};
    }
    return result;
  }
  function snapshot(books, categories, observations, run) {
    const cats = new Map(categories.map(c => [c.category_id,c.name]));
    const metadata = new Map(books.map(b => [b.book_id,b]));
    const ids = new Set();
    const result = observations.map(o => {
      const b = metadata.get(o.book_id);
      if (!b || ids.has(o.book_id) || o.run_id !== run.run_id) throw new Error('The latest collection is incomplete. Please try refreshing later.');
      ids.add(o.book_id);
      const price = Number(o.price_incl_tax);
      if (!Number.isFinite(price) || price < 0 || o.currency !== 'GBP' || !Number.isInteger(o.availability) || o.availability < 0) throw new Error('Some catalogue values could not be read.');
      return {...b, category:cats.get(b.category_id) || 'Uncategorised', price, availability:o.availability,
        rating:o.rating, review_count:o.review_count, observed_at:o.observed_at};
    });
    if (result.length !== run.books_collected) throw new Error('The number of books does not match the completed collection. Please try again.');
    return result;
  }
  const api = {money,escape,safeSource,filterBooks,bundle,normaliseShelf,snapshot};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Folio = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
