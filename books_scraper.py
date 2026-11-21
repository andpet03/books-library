"""Books to Scrape: full catalogue collection with local history.

Run: python books_scraper.py          (all catalogue pages)
Test: python books_scraper.py --pages 1
This stage writes local files only. It does not connect to Supabase.
"""
import argparse
import csv
import json
import re
import sys
import time
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from urllib.parse import urljoin, urlsplit
from uuid import uuid4

import requests
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

BASE_URL = 'https://books.toscrape.com/'
ROOT = Path(__file__).resolve().parent
TABLES = ('categories', 'books', 'book_observations', 'scrape_runs')
FIELDS = {
    'categories': ['category_id', 'name', 'source_url'],
    'books': ['book_id', 'title', 'category_id', 'description', 'cover_url',
              'source_url', 'product_type', 'first_seen_at', 'last_seen_at'],
    'book_observations': ['observation_id', 'book_id', 'run_id', 'observed_at',
                         'price_incl_tax', 'price_excl_tax', 'tax', 'currency',
                         'availability', 'availability_text', 'rating', 'review_count'],
    'scrape_runs': ['run_id', 'started_at', 'finished_at', 'status',
                    'expected_books', 'books_collected', 'pages_processed', 'error_count'],
}


def now():
    return datetime.now(timezone.utc).isoformat()


def checked_url(base, relative):
    url = urljoin(base, relative)
    parsed = urlsplit(url)
    if (parsed.scheme != 'https' or parsed.netloc != 'books.toscrape.com'
            or parsed.username or parsed.password):
        raise ValueError('Unexpected source URL')
    return url


def parse_money(value):
    if not re.fullmatch(r'£\d+\.\d{2}', value):
        raise ValueError('Unrecognised GBP price')
    return str(Decimal(value[1:]))


def parse_listing(html, url):
    soup = BeautifulSoup(html, 'html.parser')
    links = soup.select('article.product_pod h3 a')
    if not links:
        raise ValueError('No book links found on catalogue page')
    urls = [checked_url(url, a['href']) for a in links]
    next_link = soup.select_one('li.next a')
    next_url = checked_url(url, next_link['href']) if next_link else None
    form = soup.select_one('form.form-horizontal')
    match = re.search(r'([\d,]+) results?', form.get_text(' ', strip=True)) if form else None
    expected = int(match[1].replace(',', '')) if match else None
    return urls, next_url, expected


def parse_book(html, url, run_id, timestamp):
    soup = BeautifulSoup(html, 'html.parser')
    info = {}
    for row in soup.select('table.table tr'):
        heading, value = row.find('th'), row.find('td')
        if heading is not None and value is not None:
            info[heading.get_text(strip=True)] = value.get_text(' ', strip=True)
    title = soup.select_one('.product_main h1')
    crumbs = soup.select('ul.breadcrumb li a')
    if title is None or not title.get_text(strip=True) or len(crumbs) < 3:
        raise ValueError('Missing title or category')
    book_id = info.get('UPC', '').strip()
    if not book_id:
        raise ValueError('Missing UPC')
    category_url = checked_url(url, crumbs[-1]['href'])
    category_id = urlsplit(category_url).path.rstrip('/').split('/')[-2]
    stock = info['Availability']
    match = re.search(r'\((\d+) available\)', stock, re.I)
    if match:
        availability = int(match[1])
    elif stock.strip().lower() == 'out of stock':
        availability = 0
    else:
        raise ValueError('Unrecognised availability')
    heading = soup.select_one('#product_description')
    paragraph = heading.find_next_sibling('p') if heading else None
    cover = soup.select_one('.item.active img')
    stars = soup.select_one('.product_main .star-rating')
    ratings = {'One': 1, 'Two': 2, 'Three': 3, 'Four': 4, 'Five': 5}
    rating = next((ratings[c] for c in stars.get('class', []) if c in ratings), None) if stars else None
    reviews = int(info['Number of reviews'])
    if reviews < 0:
        raise ValueError('Negative review count')
    category = dict(category_id=category_id, name=crumbs[-1].get_text(strip=True), source_url=category_url)
    book = dict(book_id=book_id, title=title.get_text(strip=True), category_id=category_id,
                description=paragraph.get_text(' ', strip=True) if paragraph else None,
                cover_url=checked_url(url, cover['src']) if cover else None,
                source_url=url, product_type=info['Product Type'],
                first_seen_at=timestamp, last_seen_at=timestamp)
    observation = dict(observation_id=str(uuid4()), book_id=book_id, run_id=run_id,
                       observed_at=timestamp, price_incl_tax=parse_money(info['Price (incl. tax)']),
                       price_excl_tax=parse_money(info['Price (excl. tax)']),
                       tax=parse_money(info['Tax']), currency='GBP', availability=availability,
                       availability_text=stock, rating=rating, review_count=reviews)
    return category, book, observation


def load_state(path):
    if not path.exists():
        return dict(version=1, categories={}, books={}, book_observations=[], scrape_runs=[])
    state = json.loads(path.read_text(encoding='utf-8'))
    if (not isinstance(state, dict) or state.get('version') != 1
            or not isinstance(state.get('categories'), dict)
            or not isinstance(state.get('books'), dict)
            or not isinstance(state.get('book_observations'), list)
            or not isinstance(state.get('scrape_runs'), list)):
        raise ValueError('Invalid history file; it will not be overwritten')
    return state


def checkpoint(path, state):
    # A temporary file followed by replacement avoids a half-written history file.
    temp = path.with_suffix('.tmp')
    temp.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding='utf-8')
    temp.replace(path)


def accept_record(state, run, category, book, observation):
    old = state['books'].get(book['book_id'])
    if old:
        book['first_seen_at'] = old['first_seen_at']
    state['categories'][category['category_id']] = category
    state['books'][book['book_id']] = book
    state['book_observations'].append(observation)
    run['books_collected'] += 1


def export_tables(output, state):
    output.mkdir(parents=True, exist_ok=True)
    for name in TABLES:
        rows = list(state[name].values()) if isinstance(state[name], dict) else state[name]
        (output / (name + '.json')).write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding='utf-8')
        with (output / (name + '.csv')).open('w', newline='', encoding='utf-8-sig') as file:
            writer = csv.DictWriter(file, fieldnames=FIELDS[name], extrasaction='ignore')
            writer.writeheader()
            # JSON is canonical. Escape spreadsheet formula prefixes in CSV text.
            for row in rows:
                safe = {k: ("'" + v if isinstance(v, str) and v.lstrip().startswith(('=', '+', '-', '@')) else v)
                        for k, v in row.items()}
                writer.writerow(safe)


def collect(state, fetch, save, page_limit=0):
    # An old 'running' record means a previous process stopped before finalising.
    for old in state['scrape_runs']:
        if old['status'] == 'running':
            old['status'] = 'interrupted'
    run = dict(run_id=str(uuid4()), started_at=now(), finished_at=None, status='running',
               expected_books=None, books_collected=0, pages_processed=0, error_count=0)
    state['scrape_runs'].append(run)
    save()
    seen_pages, seen_ids, seen_urls = set(), set(), set()
    url = BASE_URL
    interrupted = False
    try:
        while url and (not page_limit or run['pages_processed'] < page_limit):
            if url in seen_pages:
                raise ValueError('Repeated catalogue page')
            seen_pages.add(url)
            urls, next_url, expected = parse_listing(fetch(url), url)
            if expected is not None:
                if run['expected_books'] is None:
                    run['expected_books'] = expected
                elif expected != run['expected_books']:
                    raise ValueError('Catalogue total changed during collection')
            for book_url in urls:
                if book_url in seen_urls:
                    continue
                seen_urls.add(book_url)
                try:
                    category, book, observation = parse_book(fetch(book_url), book_url, run['run_id'], now())
                    if book['book_id'] in seen_ids:
                        continue
                except (requests.RequestException, ValueError, KeyError, IndexError) as exc:
                    run['error_count'] += 1
                    print(f'Book skipped ({type(exc).__name__}): {book_url}', flush=True)
                    save()
                    continue
                seen_ids.add(book['book_id'])
                accept_record(state, run, category, book, observation)
                save()
                print(f"Book {run['books_collected']}: {book['title']}", flush=True)
            run['pages_processed'] += 1
            save()
            url = next_url
        matches_total = run['expected_books'] is not None and run['books_collected'] == run['expected_books']
        run['status'] = 'completed' if not url and not run['error_count'] and matches_total else 'partial'
    except KeyboardInterrupt:
        interrupted = True
        run['status'] = 'interrupted'
        print('\nStopped by user. Saved observations are retained.', flush=True)
    except (requests.RequestException, ValueError, KeyError, IndexError) as exc:
        run['error_count'] += 1
        run['status'] = 'partial' if run['books_collected'] else 'failed'
        print(f'Collection stopped: {type(exc).__name__}', flush=True)
    finally:
        run['finished_at'] = now()
        save()
    return run, interrupted


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pages', type=int, default=0, help='0 = entire catalogue (default); 1 = one-page test')
    args = parser.parse_args()
    if args.pages < 0:
        parser.error('--pages cannot be negative')
    data_dir = ROOT / 'data'
    data_dir.mkdir(exist_ok=True)
    history = data_dir / 'history.json'
    lock = data_dir / '.scraper.lock'
    try:
        handle = lock.open('x')
    except FileExistsError:
        print('Another run may be active. Do not start two copies. If a previous process crashed, close it before removing data/.scraper.lock.')
        return 1
    try:
        handle.close()
        state = load_state(history)
        with requests.Session() as session:
            retries = Retry(total=3, backoff_factor=1, status_forcelist=[429, 500, 502, 503, 504], allowed_methods=['GET'])
            session.mount('https://', HTTPAdapter(max_retries=retries))
            session.headers['User-Agent'] = 'BooksLibraryStudentProject/1.0 (educational scraper)'
            def fetch(url):
                checked_url(BASE_URL, url)
                time.sleep(1)
                response = session.get(url, timeout=30, allow_redirects=False)
                if 300 <= response.status_code < 400:
                    raise ValueError('Unexpected redirect; inspect the source before continuing')
                response.raise_for_status()
                return response.content.decode('utf-8')
            print('Starting collection. Keep this window open. Ctrl+C stops safely.', flush=True)
            run, interrupted = collect(state, fetch, lambda: checkpoint(history, state), args.pages)
        output = ROOT / 'output' / run['run_id']
        export_tables(output, state)
        print(f"\nStatus: {run['status']}")
        print(f"Books this run: {run['books_collected']} / expected: {run['expected_books']}")
        print(f"Pages: {run['pages_processed']} | Errors: {run['error_count']}")
        print(f'History: {history}\nExports: {output}')
        return 130 if interrupted else (0 if run['status'] == 'completed' else 2)
    finally:
        lock.unlink(missing_ok=True)


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except (OSError, ValueError) as exc:
        print(f'Local file or data error ({type(exc).__name__}). Keep data/history.json; do not delete your history.', file=sys.stderr)
        raise SystemExit(1)
