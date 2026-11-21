"""Offline tests: no Supabase credentials and no internet required."""
import copy
import unittest
from contextlib import redirect_stdout
from io import StringIO

from supabase_sync import sync, validate, merge_book, TABLES

RUN = '00000000-0000-4000-8000-000000000001'
OBS = '00000000-0000-4000-8000-000000000002'
OLD = '2026-11-01T00:00:00+00:00'
NEW = '2026-11-20T00:00:00+00:00'


def sample():
    return {
        'version': 1,
        'categories': {'poetry': {'category_id': 'poetry', 'name': 'Poetry'}},
        'books': {'book': {'book_id': 'book', 'title': 'A title', 'category_id': 'poetry',
                           'first_seen_at': NEW, 'last_seen_at': NEW}},
        'scrape_runs': [{'run_id': RUN, 'status': 'completed', 'started_at': NEW,
                        'finished_at': NEW, 'expected_books': 1,
                        'books_collected': 1, 'error_count': 0}],
        'book_observations': [{'observation_id': OBS, 'book_id': 'book',
                               'run_id': RUN, 'observed_at': NEW}],
    }


class FakeClient:
    def __init__(self):
        self.tables = {name: {} for name in TABLES}
        self.fail_once = False
        self.hide_observation = False

    def rows(self, name, **filters):
        rows = list(self.tables[name].values())
        if 'run_id' in filters:
            rows = [r for r in rows if r['run_id'] == filters['run_id'][3:]]
        if name == 'book_observations' and self.hide_observation:
            return []
        return copy.deepcopy(rows)

    def write(self, name, rows, ignore=False):
        for row in rows:
            key = row[TABLES[name]]
            if not ignore or key not in self.tables[name]:
                self.tables[name][key] = copy.deepcopy(row)
        if name == 'book_observations' and self.fail_once:
            self.fail_once = False
            raise RuntimeError('Simulated lost response after database commit')

    def finish(self, run):
        self.tables['scrape_runs'][run['run_id']] = copy.deepcopy(run)


class SyncTests(unittest.TestCase):
    def setUp(self):
        self.state = sample()
        self.client = FakeClient()

    def upload(self):
        with redirect_stdout(StringIO()):
            sync(self.state, self.client)

    def test_repeating_import_does_not_duplicate(self):
        self.upload()
        before = copy.deepcopy(self.client.tables)
        self.upload()
        self.assertEqual(before, self.client.tables)

    def test_retry_after_lost_response(self):
        self.client.fail_once = True
        with self.assertRaises(RuntimeError):
            self.upload()
        self.assertEqual('running', self.client.tables['scrape_runs'][RUN]['status'])
        self.upload()
        self.assertEqual('completed', self.client.tables['scrape_runs'][RUN]['status'])
        self.assertEqual(1, len(self.client.tables['book_observations']))

    def test_missing_remote_observation_prevents_completion(self):
        self.client.hide_observation = True
        with self.assertRaises(RuntimeError):
            self.upload()
        self.assertEqual('running', self.client.tables['scrape_runs'][RUN]['status'])

    def test_first_seen_preserved_with_fresh_local_history(self):
        remote = {**self.state['books']['book'], 'first_seen_at': OLD, 'last_seen_at': OLD}
        self.client.tables['books']['book'] = remote
        self.upload()
        result = self.client.tables['books']['book']
        self.assertEqual(OLD, result['first_seen_at'])
        self.assertEqual(NEW, result['last_seen_at'])

    def test_old_local_metadata_cannot_overwrite_newer_remote(self):
        old = {**self.state['books']['book'], 'first_seen_at': OLD, 'last_seen_at': OLD}
        newer = {**self.state['books']['book'], 'title': 'New title'}
        result = merge_book(old, newer)
        self.assertEqual('New title', result['title'])
        self.assertEqual(OLD, result['first_seen_at'])

    def test_new_run_adds_history_without_deleting_old(self):
        self.upload()
        run2 = '00000000-0000-4000-8000-000000000003'
        obs2 = '00000000-0000-4000-8000-000000000004'
        self.state['scrape_runs'][0]['run_id'] = run2
        self.state['book_observations'][0].update(run_id=run2, observation_id=obs2)
        self.upload()
        self.assertEqual(2, len(self.client.tables['book_observations']))
        self.assertEqual(2, len(self.client.tables['scrape_runs']))

    def test_partial_run_is_not_marked_completed(self):
        self.state['scrape_runs'][0].update(status='partial', expected_books=2)
        self.upload()
        self.assertEqual('partial', self.client.tables['scrape_runs'][RUN]['status'])

    def test_inconsistent_count_rejected_before_writes(self):
        self.state['scrape_runs'][0]['books_collected'] = 2
        with self.assertRaises(ValueError):
            self.upload()
        self.assertTrue(all(not rows for rows in self.client.tables.values()))

    def test_duplicate_run_book_rejected(self):
        duplicate = {**self.state['book_observations'][0],
                     'observation_id': '00000000-0000-4000-8000-000000000005'}
        self.state['book_observations'].append(duplicate)
        with self.assertRaises(ValueError):
            validate(self.state)


if __name__ == '__main__':
    unittest.main()
