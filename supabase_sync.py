"""Upload local history safely. Run with the scraper stopped; use one writer."""
import json
import os
import re
import time
from datetime import datetime
from pathlib import Path
from urllib.parse import urlsplit
from uuid import UUID

ROOT = Path(__file__).resolve().parent
TABLES = {
    'categories': 'category_id', 'books': 'book_id',
    'scrape_runs': 'run_id', 'book_observations': 'observation_id',
}


def timestamp(value):
    result = datetime.fromisoformat(value)
    if result.tzinfo is None:
        raise ValueError('Timestamp must include its timezone')
    return result


def validate(state):
    if state.get('version') != 1:
        raise ValueError('Unsupported history version')
    books, cats = state['books'], state['categories']
    runs = {r['run_id']: r for r in state['scrape_runs']}
    if len(runs) != len(state['scrape_runs']):
        raise ValueError('Duplicate run ID')
    for key, row in cats.items():
        if key != row['category_id']:
            raise ValueError('Category ID mismatch')
    for key, book in books.items():
        if key != book['book_id'] or book['category_id'] not in cats:
            raise ValueError('Invalid book reference')
        if timestamp(book['first_seen_at']) > timestamp(book['last_seen_at']):
            raise ValueError('Invalid book timestamps')
    groups = {key: [] for key in runs}
    ids, pairs = set(), set()
    for obs in state['book_observations']:
        UUID(obs['observation_id'])
        pair = (obs['run_id'], obs['book_id'])
        if obs['observation_id'] in ids or pair in pairs:
            raise ValueError('Duplicate observation')
        if obs['run_id'] not in runs or obs['book_id'] not in books:
            raise ValueError('Invalid observation reference')
        ids.add(obs['observation_id'])
        pairs.add(pair)
        groups[obs['run_id']].append(obs)
    for key, run in runs.items():
        UUID(key)
        if run['status'] not in ('completed', 'partial', 'failed', 'interrupted'):
            raise ValueError('Stop the scraper before syncing unfinished history')
        if run['books_collected'] != len(groups[key]):
            raise ValueError('Run count does not match local observations')
        if run['finished_at'] is not None:
            if timestamp(run['finished_at']) < timestamp(run['started_at']):
                raise ValueError('Invalid run timestamps')
        if run['status'] == 'completed' and (
            run['expected_books'] != len(groups[key]) or run['error_count'] != 0
        ):
            raise ValueError('Invalid completed run')
    return groups


def merge_book(local, remote):
    """Preserve first sighting, and never replace newer metadata with older data."""
    if remote is None:
        return dict(local)
    result = dict(local if timestamp(local['last_seen_at']) >=
                  timestamp(remote['last_seen_at']) else remote)
    result['first_seen_at'] = min(
        (local['first_seen_at'], remote['first_seen_at']), key=timestamp
    )
    return result


class Client:
    def __init__(self, url, key):
        import requests
        parsed = urlsplit(url)
        if (parsed.scheme != 'https'
                or not re.fullmatch(r'[a-z0-9-]+\.supabase\.co', parsed.netloc)
                or parsed.path or parsed.query or parsed.fragment or not key):
            raise ValueError('Check SUPABASE_URL and SUPABASE_KEY in .env')
        self.url = url
        self.requests = requests
        self.session = requests.Session()
        self.session.headers['apikey'] = key
        if not key.startswith('sb_secret_'):
            self.session.headers['Authorization'] = 'Bearer ' + key

    def request(self, method, name, **kwargs):
        # All writes use stable IDs, so retrying a lost response is safe.
        for attempt in range(4):
            try:
                response = self.session.request(
                    method, self.url + '/rest/v1/library_' + name,
                    timeout=(15, 60), allow_redirects=False, **kwargs
                )
            except self.requests.RequestException:
                if attempt == 3:
                    raise RuntimeError('Network failure; retry with --sync-only') from None
            else:
                if 200 <= response.status_code < 300:
                    return response
                if response.status_code not in (429, 500, 502, 503, 504):
                    raise RuntimeError(f'library_{name}: HTTP {response.status_code}')
                if attempt == 3:
                    raise RuntimeError(f'library_{name}: HTTP {response.status_code}; retry later')
            time.sleep(2 ** attempt)

    def rows(self, name, **filters):
        result = []
        while True:
            response = self.request('GET', name, params={
                'select': '*', 'order': TABLES[name] + '.asc',
                'offset': len(result), 'limit': 500, **filters,
            })
            page = response.json()
            if not isinstance(page, list):
                raise RuntimeError('Unexpected database response')
            if not page:
                return result
            result.extend(page)

    def write(self, name, rows, ignore=False):
        mode = 'ignore-duplicates' if ignore else 'merge-duplicates'
        for start in range(0, len(rows), 100):
            batch = rows[start:start + 100]
            self.request('POST', name, params={'on_conflict': TABLES[name]},
                         headers={'Prefer': f'resolution={mode},return=minimal'}, json=batch)
            print(f'library_{name}: {start + len(batch)}/{len(rows)} processed', flush=True)

    def finish(self, run):
        response = self.request('PATCH', 'scrape_runs',
                                params={'run_id': 'eq.' + run['run_id']},
                                headers={'Prefer': 'return=representation'}, json=run)
        rows = response.json()
        if len(rows) != 1 or rows[0]['status'] != run['status']:
            raise RuntimeError('Run finalisation could not be verified')

    def preflight(self):
        for name in TABLES:
            self.request('GET', name, params={'select': TABLES[name], 'limit': 1})


def make_client():
    from dotenv import load_dotenv
    load_dotenv(ROOT / '.env')
    return Client(os.getenv('SUPABASE_URL', '').strip().rstrip('/'),
                  os.getenv('SUPABASE_KEY', '').strip())


def sync(state, client):
    groups = validate(state)
    # Read the remote snapshot before deciding how to update book metadata.
    remote_books = {b['book_id']: b for b in client.rows('books')}
    client.write('categories', list(state['categories'].values()), ignore=True)
    client.write('books', [merge_book(b, remote_books.get(b['book_id']))
                           for b in state['books'].values()])
    for run in sorted(state['scrape_runs'], key=lambda r: timestamp(r['started_at'])):
        pending = {**run, 'status': 'running', 'finished_at': None}
        client.write('scrape_runs', [pending], ignore=True)
        observations = groups[run['run_id']]
        client.write('book_observations', observations, ignore=True)
        remote = client.rows('book_observations', run_id='eq.' + run['run_id'])
        expected = {(o['observation_id'], o['book_id']) for o in observations}
        actual = {(o['observation_id'], o['book_id']) for o in remote}
        if expected != actual or len(remote) != len(observations):
            raise RuntimeError('Remote observations differ from local run; run not finalised')
        client.finish(run)
        print(f"VERIFIED: {run['run_id']} — {len(remote)} observations; {run['status']}", flush=True)
    print('SUCCESS: History synchronised. Existing observations were preserved.', flush=True)


def load_history():
    return json.loads((ROOT / 'data' / 'history.json').read_text(encoding='utf-8'))


if __name__ == '__main__':
    try:
        sync(load_history(), make_client())
    except RuntimeError as error:
        raise SystemExit(str(error))
    except (OSError, ValueError, KeyError, TypeError, ImportError):
        raise SystemExit('Check local history, dependencies and .env. No secrets printed.')
