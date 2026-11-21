const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('../web/js/core.js');
const sample = [
  {book_id:'a',title:'Poetry & Light',description:'A story about stars',category:'Poetry',category_id:'p',price:12.34,rating:5,availability:2},
  {book_id:'b',title:'Mystery Night',description:null,category:'Mystery',category_id:'m',price:20,rating:3,availability:0},
  {book_id:'c',title:'Another Story',description:'A journey',category:'Mystery',category_id:'m',price:10,rating:null,availability:4}
];
const filters={query:'',category:'',max:'',rating:0,stock:false,sort:'title'};
test('search includes descriptions, ignores case and trims spaces',()=>assert.deepEqual(F.filterBooks(sample,{...filters,query:' STARS '}).map(b=>b.book_id),['a']));
test('category price and stock filters combine',()=>assert.deepEqual(F.filterBooks(sample,{...filters,category:'m',max:15,stock:true}).map(b=>b.book_id),['c']));
test('missing ratings remain visible unless a minimum rating is selected',()=>{assert.equal(F.filterBooks(sample,filters).length,3);assert.equal(F.filterBooks(sample,{...filters,rating:4}).length,1);});
test('price zero is a real filter, not an absent filter',()=>assert.equal(F.filterBooks(sample,{...filters,max:0}).length,0));
test('sorts by actual numeric price without changing source order',()=>{assert.deepEqual(F.filterBooks(sample,{...filters,sort:'price-low'}).map(b=>b.book_id),['c','a','b']);assert.equal(sample[0].book_id,'a');});
test('highest rated puts unknown rating last',()=>assert.deepEqual(F.filterBooks(sample,{...filters,sort:'rating'}).map(b=>b.book_id),['a','b','c']));
test('bundles never exceed the total budget or repeat books',()=>{for(let i=0;i<100;i++){const rows=F.bundle(sample,22.34,3);assert.ok(rows.reduce((s,b)=>s+Math.round(b.price*100),0)<=2234);assert.equal(new Set(rows.map(b=>b.book_id)).size,rows.length);assert.ok(rows.every(b=>b.availability>0));}});
test('bundle arithmetic uses pennies',()=>{const rows=F.bundle([{...sample[0],price:.1},{...sample[2],price:.2}],.3,2);assert.equal(rows.length,2);});
test('bundle respects number limit and handles impossible budget',()=>{assert.equal(F.bundle(sample,100,1).length,1);assert.equal(F.bundle(sample,1,3).length,0);assert.equal(F.bundle(sample,NaN,3).length,0);});
test('HTML and attribute characters are escaped',()=>assert.equal(F.escape('<img src="x" onerror=\'x\'>&'),'&lt;img src=&quot;x&quot; onerror=&#39;x&#39;&gt;&amp;'));
test('external and executable image/source URLs rejected',()=>{for(const url of ['javascript:alert(1)','https://evil.test/x','https://books.toscrape.com.evil.test/x','http://books.toscrape.com/x','https://a:b@books.toscrape.com/x'])assert.equal(F.safeSource(url),'');assert.equal(F.safeSource('https://books.toscrape.com/x'),'https://books.toscrape.com/x');});
test('shelf backup round-trips notes without interpreting HTML',()=>{const rows=F.normaliseShelf({version:1,books:[{book_id:'a',status:'read',note:'<b>hello</b>',title:'A'}]});assert.equal(rows.a.note,'<b>hello</b>');assert.equal(rows.a.status,'read');assert.equal(Object.getPrototypeOf(rows),null);});
test('invalid reading status and long notes rejected',()=>{for(const row of [{book_id:'a',status:'bad',note:''},{book_id:'a',status:'read',note:'x'.repeat(2001)}])assert.throws(()=>F.normaliseShelf({version:1,books:[row]}));});
test('incorrect backup shape rejected',()=>{assert.throws(()=>F.normaliseShelf({version:2,books:[]}));assert.throws(()=>F.normaliseShelf({version:1,books:'wrong'}));});
const run={run_id:'run-1',books_collected:1};
const observation={book_id:'a',run_id:'run-1',price_incl_tax:'12.34',currency:'GBP',availability:2,rating:5,review_count:0};
test('snapshot uses values from a fixed completed run',()=>{const rows=F.snapshot(sample,[{category_id:'p',name:'Poetry'}],[observation],run);assert.equal(rows.length,1);assert.equal(rows[0].price,12.34);assert.equal(rows[0].category,'Poetry');});
test('snapshot refuses missing books, duplicates and cross-run observations',()=>{assert.throws(()=>F.snapshot([],[],[observation],run));assert.throws(()=>F.snapshot(sample,[],[observation,observation],{...run,books_collected:2}));assert.throws(()=>F.snapshot(sample,[],[{...observation,run_id:'wrong'}],run));});
test('snapshot refuses truncated collection and bad prices',()=>{assert.throws(()=>F.snapshot(sample,[],[],run));assert.throws(()=>F.snapshot(sample,[],[{...observation,price_incl_tax:'NaN'}],run));});
