"""One command: collect books, then synchronise saved history with Supabase."""
import argparse
import subprocess
import sys
from pathlib import Path

from supabase_sync import make_client, load_history, sync

ROOT = Path(__file__).resolve().parent


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--sync-only', action='store_true', help='Upload saved history without scraping')
    parser.add_argument('--pages', type=int, default=0, help='0: all pages; 1: short test (partial run)')
    args = parser.parse_args()
    if args.pages < 0 or (args.sync_only and args.pages):
        parser.error('Use nonnegative pages; do not combine --pages and --sync-only')
    data_dir = ROOT / 'data'
    data_dir.mkdir(exist_ok=True)
    lock = data_dir / '.update.lock'
    try:
        handle = lock.open('x')
    except FileExistsError:
        print('An update may already be running. Close it before retrying.')
        return 1
    try:
        handle.close()
        if (data_dir / '.scraper.lock').exists():
            raise RuntimeError('A scraper may already be running. Wait for it to finish.')
        client = make_client()
        client.preflight()
        print('Supabase connection OK.', flush=True)
        scrape_code = 0
        if not args.sync_only:
            scrape_code = subprocess.run([
                sys.executable, str(ROOT / 'books_scraper.py'), '--pages', str(args.pages)
            ], cwd=ROOT).returncode
            if scrape_code not in (0, 2):
                print('Collection stopped. Saved history remains; use --sync-only when ready.')
                return scrape_code if scrape_code > 0 else 1
        sync(load_history(), client)
        if scrape_code == 2:
            print('Upload succeeded, but this collection is PARTIAL, not a full catalogue update.')
        return scrape_code
    finally:
        lock.unlink(missing_ok=True)


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print('\nStopped. Keep data/history.json. Retry upload with --sync-only.')
        raise SystemExit(130)
    except RuntimeError as error:
        print(f'ERROR: {error}')
        raise SystemExit(1)
    except (OSError, ValueError, KeyError, TypeError, ImportError):
        print('ERROR: Check local history, dependencies and .env. No secrets printed.')
        raise SystemExit(1)
