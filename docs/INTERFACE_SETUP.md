# FOLIO: website setup

FOLIO is the public reading interface for the books-library scraper project.
The website uses HTML, CSS and plain JavaScript. No build step is needed.

## Install this update

Extract Books_Library_FOLIO_Interface.zip. Copy its `web`, `web-tests` and `docs`
folders into your existing `books-library` folder. Merge existing folders if
asked. The update does not replace the scraper, its local history or credentials.

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

Keep that window open. Visit http://localhost:8000 in your browser.
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

The owner was given the SQL for these policies and reported successful execution.
The public `anon` role needs SELECT privileges only; it must not receive INSERT,
UPDATE, DELETE or TRUNCATE privileges. The existing scraper uses its separate
secret key. A full permission audit remains part of the final project audit.

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
in the current browser and origin. Changing from localhost to GitHub Pages,
using another browser or clearing browser data changes that storage. Use backups
to transfer it. Selected comparison books are kept only for the current visit.

The website sends only read requests to Supabase. Notes and reading status are
not sent to Supabase. Supabase receives catalogue requests; books.toscrape.com
receives image requests. The website uses system fonts and no analytics service.

Books to Scrape is a demonstration website: prices, availability and ratings are
not real purchasing information. No author, ISBN, page count or publication date
is invented. The source UPC is displayed explicitly as the book ID.

## Publication

Upload the `web`, `web-tests` and `docs` folders to the existing repository,
retaining their structure. Do not upload the ZIP itself, .env, .venv, local data,
output exports or personal shelf backups. These instructions do not enable
GitHub Pages automatically. A Pages deployment that publishes the `web` folder
will be configured after the local interface has been checked.

## Offline logic tests (optional for local use)

With Node.js installed, run from the project root:

```sh
node --test web-tests/core.test.cjs web-tests/api.test.cjs
```

Node is needed only for these development tests, not for using FOLIO.
