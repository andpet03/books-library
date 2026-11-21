const test = require('node:test');
const assert = require('node:assert/strict');
global.Folio = require('../web/js/core.js');
const API = require('../web/js/api.js');
const config={supabaseUrl:'https://example.supabase.co',publishableKey:'sb_publishable_testing'};
const response=data=>({ok:true,status:200,json:async()=>data});
test('secret and legacy keys refused before any network request',()=>{assert.throws(()=>new API({...config,publishableKey:'sb_secret_private'}));assert.throws(()=>new API({...config,publishableKey:'eyJlegacy'}));});
test('configuration refuses non-Supabase destination',()=>{assert.throws(()=>new API({...config,supabaseUrl:'https://example.supabase.co.evil.test'}));assert.throws(()=>new API({...config,supabaseUrl:'https://example.supabase.co/rest/v1'}));});
test('pagination continues even when server caps rows below requested limit',async()=>{
  const data=Array.from({length:1000},(_,i)=>({book_id:String(i)}));const requests=[];
  const api=new API(config,async(url,options)=>{requests.push(options);const offset=Number(new URL(url).searchParams.get('offset'));return response(data.slice(offset,offset+100));});
  const all=await api.all('library_books',{order:'book_id.asc'});
  assert.equal(all.length,1000);assert.equal(requests.length,11);assert.ok(requests.every(r=>r.method==='GET' && r.credentials==='omit' && !r.headers.Authorization));
});
test('permission failures produce useful errors without exposing configuration',async()=>{
  const api=new API(config,async()=>({ok:false,status:403}));
  await assert.rejects(api.get('library_books',{}),error=>error.message.includes('403')&&!error.message.includes(config.publishableKey));
});
test('latest snapshot loads full catalogue and binds observations to chosen run',async()=>{
  const seen=[];const api=new API(config,async(url)=>{
    const u=new URL(url);seen.push(u);const table=u.pathname.split('/').pop();
    if(table==='library_scrape_runs')return response([{run_id:'r1',finished_at:'2026-11-21T00:00:00Z',books_collected:1}]);
    if(Number(u.searchParams.get('offset'))>0)return response([]);
    if(table==='library_books')return response([{book_id:'a',title:'A',category_id:'p'}]);
    if(table==='library_categories')return response([{category_id:'p',name:'Poetry'}]);
    return response([{book_id:'a',run_id:'r1',price_incl_tax:'10.00',currency:'GBP',availability:1}]);
  });
  const result=await api.catalogue();assert.equal(result.books[0].title,'A');
  assert.ok(seen.filter(u=>u.pathname.endsWith('observations')).every(u=>u.searchParams.get('run_id')==='eq.r1'));
});
test('history query keeps the selected book and snapshot cutoff',async()=>{
  const calls=[];const api=new API(config,async url=>{calls.push(new URL(url));return response([]);});
  await api.history('book1','2026-11-21T00:00:00Z');
  assert.equal(calls[0].searchParams.get('book_id'),'eq.book1');assert.equal(calls[0].searchParams.get('observed_at'),'lte.2026-11-21T00:00:00Z');
});
