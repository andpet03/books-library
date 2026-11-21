import contextlib
import io
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import books_scraper as s

BOOK = '<ul class="breadcrumb"><li><a href="/">Home</a></li><li><a href="/catalogue/">Books</a></li><li><a href="/catalogue/category/books/poetry_23/index.html">Poetry</a></li></ul><div class="product_main"><h1>Fixture book</h1><p class="star-rating Three"></p></div><div id="product_description"></div><p>Fixture description.</p><table class="table">'+''.join(f'<tr><th>{k}</th><td>{v}</td></tr>' for k,v in {'UPC':'fixture123','Availability':'In stock (22 available)','Price (incl. tax)':'£51.77','Price (excl. tax)':'£51.77','Tax':'£0.00','Number of reviews':'0','Product Type':'Books'}.items())+'</table>'

def listing(next_page=False, total=1):
    return f'<form class="form-horizontal"><strong>{total}</strong> results - showing 1 to 1.</form><article class="product_pod"><h3><a href="/catalogue/fixture/index.html">Fixture</a></h3></article>'+('<li class="next"><a href="/catalogue/page-2.html">next</a></li>' if next_page else '')

class ScraperTests(unittest.TestCase):
    def fresh(self):
        return dict(version=1,categories={},books={},book_observations=[],scrape_runs=[])
    def collect(self,state,fetch,limit=0):
        with contextlib.redirect_stdout(io.StringIO()):
            return s.collect(state,fetch,lambda:None,limit)[0]
    def test_parser(self):
        cat,book,obs=s.parse_book(BOOK,s.BASE_URL,'run','time')
        self.assertEqual(book['category_id'],cat['category_id'])
        self.assertEqual(obs['availability'],22)
        self.assertEqual(obs['rating'],3)
        self.assertEqual(obs['price_incl_tax'],'51.77')
        self.assertIsNone(book['cover_url'])
    def test_unknown_stock_rejected(self):
        with self.assertRaises(ValueError):
            s.parse_book(BOOK.replace('In stock (22 available)','Unknown'),s.BASE_URL,'run','time')
    def test_two_runs_preserve_history(self):
        state=self.fresh()
        fetch=lambda url: listing() if url==s.BASE_URL else BOOK
        with patch.object(s,'now',return_value='first'):
            self.assertEqual(self.collect(state,fetch)['status'],'completed')
        with patch.object(s,'now',return_value='second'): self.collect(state,fetch)
        self.assertEqual(len(state['books']),1)
        self.assertEqual(len(state['book_observations']),2)
        self.assertEqual(state['books']['fixture123']['first_seen_at'],'first')
        self.assertEqual(state['books']['fixture123']['last_seen_at'],'second')
        self.assertNotEqual(*[o['run_id'] for o in state['book_observations']])
    def test_pagination_and_deduplication(self):
        fetch=lambda url: listing(True) if url==s.BASE_URL else (listing() if 'page-2' in url else BOOK)
        run=self.collect(self.fresh(),fetch)
        self.assertEqual((run['pages_processed'],run['books_collected'],run['status']),(2,1,'completed'))
    def test_page_limit_is_partial(self):
        run=self.collect(self.fresh(),lambda url: listing(True,2) if url==s.BASE_URL else BOOK,1)
        self.assertEqual(run['status'],'partial')
    def test_parse_failure_is_not_success(self):
        run=self.collect(self.fresh(),lambda url: listing() if url==s.BASE_URL else 'broken')
        self.assertEqual(run['status'],'partial')
        self.assertEqual(run['error_count'],1)
    def test_count_mismatch(self):
        run=self.collect(self.fresh(),lambda url: listing(total=2) if url==s.BASE_URL else BOOK)
        self.assertEqual(run['status'],'partial')
    def test_interrupt_keeps_data(self):
        state=self.fresh()
        def fetch(url):
            if 'page-2' in url: raise KeyboardInterrupt
            return listing(True,2) if url==s.BASE_URL else BOOK
        self.assertEqual(self.collect(state,fetch)['status'],'interrupted')
        self.assertEqual(len(state['book_observations']),1)
    def test_external_urls_rejected(self):
        with self.assertRaises(ValueError): s.checked_url(s.BASE_URL,'https://example.com/')
    def test_storage(self):
        with tempfile.TemporaryDirectory() as folder:
            p=Path(folder)/'history.json'
            state=self.fresh()
            s.checkpoint(p,state)
            self.assertEqual(s.load_state(p),state)
            p.write_text('{broken')
            with self.assertRaises(ValueError): s.load_state(p)
            self.assertEqual(p.read_text(),'{broken')
if __name__=='__main__': unittest.main()
