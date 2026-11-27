# FOLIO — Development audit

## 1. Initial request and first implementation

I worked with ChatGPT/Codex to develop a Books to Scrape project beyond a basic scraping exercise: collect the complete catalogue, store its data and history, update it automatically, and build an interface for exploring the books. The requests below are summarised from the development record; quotation marks are used only for messages preserved in the conversation.

We started with a fresh `books-library` folder and a Python virtual environment. I installed Requests and Beautiful Soup and ran a first script that printed 20 titles. We then extracted the details of “A Light in the Attic” and inspected the resulting JSON to understand which fields were available, including category, UPC, price and stock.

I wanted all books rather than only the first page, richer book details, repeated observations and future automatic database updates. We therefore extended the collector with pagination and individual detail-page requests, and separated categories, books, collection runs and observations in the data model.

## 2. Testing the collector and database

I ran the complete collection locally. It finished with 1,000 books across 50 pages, 50 categories and zero reported collection errors. Two descriptions were absent in the extraction, so those fields remained optional rather than being invented.

Next, I created four `library_` tables in Supabase, keeping the earlier experimental tables separate. Connection checks succeeded, and the first import reported 50 categories, 1,000 books, one run and 1,000 observations.

We then developed the update process so later collections would retain earlier observations. Synchronisation included repeatable uploads, retry handling and checks of observation identifiers and counts before finalising a run. A later collection retained the previous history. I also manually triggered the cloud workflow: it completed successfully in 19 minutes and 1 second.

## 3. Issues found and requests for changes

One practical problem was that `update_library.py` was missing from my local project folder when I needed to run the integrated update. We resolved this by placing the update files in the correct folder before continuing.

After connecting the interface to the stored catalogue, I tested search, combined filters, book details, the personal shelf, history, comparison and budget matching. When refreshing appeared to do nothing, I reported:

> I clicked on refresh but it seems like nothing happened

I then observed:

> The book in the shelf section is still there but the books that I compared disappear

We clarified the different behaviours: Refresh reads the latest completed collection already in Supabase; it does not run the scraper. Shelf entries are saved in browser storage, while comparison selections are temporary and reset on reload. These observations required clarification, not a claimed code fix.

Later, I asked whether the old database tables were still needed. We inspected the current table definitions and prepared database setup documentation for the four-table design. The subsequent repository review also found missing ignore rules and outdated supporting instructions. After those findings, I requested:

> let's do the corrections

## 4. Fixes, improvements and final result

- **Complete collection:** the initial 20-title prototype became a collector covering all 50 catalogue pages and individual book details. My full-run results confirmed 1,000 books.
- **Repeatable updates and history:** the integrated update files were placed correctly, and synchronisation preserved earlier observations. My terminal output confirmed successful history synchronisation without deleting existing observations.
- **Automation:** the successful manual GitHub Actions run demonstrated collection outside my computer. The configured daily schedule was not independently verified by that manual run.
- **Reproducible setup:** schema/setup files were prepared from the supplied database metadata; execution against a fresh database was not confirmed.
- **Publication corrections:** ignore rules were added for environment variants, generated exports and shelf backups. Setup instructions were aligned with the existing deployment and local address, verification notes were updated, and screenshot artwork attribution was clarified. The final supplied archive contained these corrections.

The final FOLIO interface displays the collection through Discover, My shelf, Book match and Compare. My screenshots show a title search returning one book, combined Business/price/rating filters returning four books, and a two-book match totalling £49.24 within a £50 budget. History charts show three observations of the same book; unchanged prices and stock correctly produce flat lines. A saved book remained after reload, and the website deployment completed successfully.

The result grew from terminal output into a usable catalogue with stored history and a published interface. ChatGPT/Codex supported implementation and corrections; I ran the project, configured the services, tested the interface and supplied evidence of the results.
