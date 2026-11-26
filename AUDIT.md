# FOLIO — Development audit

## 1. Initial request and project produced

The project developed into a book catalogue with a Python collector, Supabase storage and a browser interface. The interface supports searching and filtering, a personal shelf, book comparison, budget-based suggestions and price/availability history. I asked ChatGPT/Codex to help prepare the README using the screenshots from my own checks:

> Consider all of these screenshot when setting up the readme later

I subsequently requested the README and repository review. The account below summarises that testing and correction process; the quoted requests are taken from our conversation.

## 2. Testing and issues found

I ran the collection workflow and opened the interface locally. My screenshots showed catalogue filtering, book details, the shelf, history charts, budget suggestions and comparison. I also checked refresh: my saved book remained on the shelf, while the comparison selection disappeared. This was identified as a difference between saved shelf state and temporary comparison state, rather than a defect that was fixed.

The later repository review found concrete publication issues: `.gitignore` did not cover environment-file variants, generated exports or shelf backups; setup documents described deployment as a future step and used a different local address from the README; verification notes omitted my later checks; and attribution wording did not acknowledge cover artwork visible in screenshots.

## 3. Request for corrections

After the review identified these issues, I asked:

> let's do the corrections

ChatGPT/Codex prepared changes to the ignore rules and the three interface documents. The changes addressed the reported publication issues without altering the application code or database configuration.

## 4. Fixes and result after checking again

- **Ignore rules:** added `.env.*`, `!.env.example`, `/data/`, `/output/` and `folio-shelf*.json`. Their behaviour was checked in a temporary Git repository.
- **Setup instructions:** updated them for the existing Pages workflow and consistently used `127.0.0.1` for local access.
- **Verification notes:** added the browser and deployment results I had confirmed, keeping pending checks separate.
- **Attribution:** clarified that documentation screenshots reproduce source cover artwork.

I supplied updated repository downloads, and the final archive contained the corrected rules and documents. The website looks the same after these corrections because they concern documentation and publication safeguards. The result is a more consistent setup guide and repository configuration, rather than a visual redesign. Shelf persistence and temporary comparison behaviour remain as described above.
