# FOLIO interface attribution

Book titles, descriptions, categories, UPC identifiers, demonstration prices,
stock counts, source ratings and cover image URLs come from
[Books to Scrape](https://books.toscrape.com/), collected by the project's Python
scraper and served from the owner's Supabase database.

Cover artwork belongs to its respective rights holders. The website loads covers
from their source URLs rather than bundling standalone cover files in `web`.
The repository documentation includes owner-captured screenshots reproducing
book covers and source descriptions. Neither those screenshots nor this project
claim ownership of that source material. Attribution is not a grant of a licence
to redistribute it. Descriptions are source content, not generated summaries.

The FOLIO interface, styling and favicon were created with assistance from
OpenAI ChatGPT/Codex as part of the student's AI programming project. The frontend
uses native browser APIs and system fonts; no frontend framework, chart library
or external font package is required. Node's built-in test runner is used for
offline logic tests.

For data access, see [Supabase Data API](https://supabase.com/docs/guides/api) and
[Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security).
