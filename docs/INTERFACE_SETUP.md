# FOLIO: website setup

FOLIO is the public reading interface for the books-library scraper project.
The website uses HTML, CSS and plain JavaScript. No build step is needed.

## Get the project

Download and extract the repository, or clone it. Keep its folder structure.
See the [root README](../README.md) for Python environment setup and collection
commands. The workflow uses Python 3.13 and Node.js 22; Node is needed only for
interface development tests, not to browse FOLIO.

The structure should include:

- books_scraper.py
- supabase_sync.py
- update_library.py
- requirements.txt
- web/index.html
- web/config.js
- web/css/style.css
- web/js/core.js
- web/js/api.js
- web/js/app.js
- web/assets/favicon.svg
- web-tests/core.test.cjs
- web-tests/api.test.cjs

`web/config.js` already contains the project URL and the publishable key supplied
by the owner. That key is intended to be public. The application refuses secret
or legacy keys. Never copy `.env` into `web` or paste the scraper's secret key
into the website.

## Open it locally on Windows

Open PowerShell in the main `books-library` folder. Run:

```powershell
.\.venv\Scripts\python.exe -m http.server 8000 --bind 127.0.0.1 --directory web
```

Keep that window open. Visit http://127.0.0.1:8000 in your browser.
Ctrl+C in PowerShell stops the local website server. This command serves only
`web`, so the parent directory's `.env` and local history are not exposed by it.
Internet access is needed for Supabase and book cover images.

This is a website server, not the scraper: opening or refreshing FOLIO does not
start a new collection. FOLIO reads the latest completed collection from Supabase.

Do not run the website through the ZIP viewer. Use the extracted files together.
Double-clicking index.html is not the supported setup because browser storage
behaviour can differ under file URLs.

## Required database access

The four existing library_ tables must have RLS enabled. The website expects:

| Table | Anonymous SELECT policy |
| --- | --- |
| library_categories | All rows |
| library_books | All rows |
| library_scrape_runs | status = 'completed' |
| library_book_observations | Related run has status = 'completed' |

The owner executed the access-policy SQL. A metadata export dated 24 November
2026 confirms RLS enabled and direct anonymous SELECT grants on these four tables.
The public `anon` role needs SELECT privileges only; it must not receive INSERT,
UPDATE, DELETE or TRUNCATE privileges. The existing scraper uses its separate
secret key. Effective live permissions were not fully tested; see
[the publication audit](../AUDIT.md) for verification limits. For a fresh
database, follow [Database setup](DATABASE_SETUP.md). Do not rerun the initial
schema script on the existing project.

## Use the interface

- Discover: search title, description or category; filter category, maximum price,
  minimum source rating and stock. All matching titles are available through
  clearly labelled catalogue pages of 36 books. The API fetches the full catalogue,
  not just its first page.
- My shelf: use the heart button to save books, then open a book to mark it as
  want to read, currently reading or finished. Add a personal note of up to 2,000
  characters. Removing a book from the shelf also removes its saved note/status.
- Backup and restore: export a JSON file. Import merges entries and keeps current
  notes/status when the same book already exists. Backups may contain private notes;
  keep them out of the public repository.
- Compare: select up to three books and compare their recorded price, rating,
  category and available copies. Lowest price means lowest among the selected
  books, not an assessment of book quality or a real-world buying recommendation.
- Book match: randomly choose one or several available titles within a total
  budget. It can skip books marked finished. It does not guarantee the largest
  possible bundle, optimise ratings or include shipping costs.
- Book detail: read the source description and view recorded price/stock history.
  A table provides exact collection times and values in addition to the chart.
- Refresh: explicitly load the most recent completed collection. A failed refresh
  preserves the current catalogue and shows an error. There is no background
  reshuffling or scraping triggered by a visitor.

## Data and privacy

FOLIO has no login system. Shelf entries and notes are stored with localStorage
in the current browser and origin. Changing from 127.0.0.1 to GitHub Pages,
using another browser or clearing browser data changes that storage. Use backups
to transfer it. Selected comparison books are kept only for the current visit.

The website sends only read requests to Supabase. Notes and reading status are
not sent to Supabase. Supabase receives catalogue requests; books.toscrape.com
receives image requests. The website uses system fonts and no analytics service.

Books to Scrape is a demonstration website: prices, availability and ratings are
not real purchasing information. No author, ISBN, page count or publication date
is invented. The source UPC is displayed explicitly as the book ID.

## Publication

The published website is https://andpet03.github.io/books-library/.
The owner supplied a successful deployment screenshot and confirmed the live site.

GitHub Pages uses GitHub Actions as its source. The repository's
`.github/workflows/deploy-website.yml` runs interface tests and publishes only
`web`. It is triggered by relevant changes on `main` or by manual dispatch.
The separate `daily-update.yml` workflow collects data and updates Supabase.
Database updates do not require redeploying the website.

Keep `.env`, virtual environments, generated data/exports and personal shelf
backups out of uploads. `.gitignore` helps with local Git operations but does
not remove already tracked files or replace careful browser-upload selection.

Always use http://127.0.0.1:8000 for the documented local setup. `localhost`,
`127.0.0.1` and the published site have distinct browser-storage origins.
To move a shelf, download its backup from the original address and restore it
at the destination. This transfer still needs a separately recorded acceptance test.

## Offline logic tests (optional for local use)

With Node.js installed, run from the project root:

```sh
node --test web-tests/core.test.cjs web-tests/api.test.cjs
```

Node is needed only for these development tests, not for using FOLIO.
