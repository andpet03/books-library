# FOLIO publication audit

**Review date:** 24 November 2026  
**Repository:** https://github.com/andpet03/books-library  
**Scope:** initial read-only review of `books-library-main.zip`, followed by a targeted static re-review of the authorised correction package.  
**Outcome:** F-01 and F-02 resolved in the prepared correction package after targeted re-review. Upload to GitHub has not been independently verified. Other recommendations and verification limits remain. This is not a security certification.

## Reviewed version and method

The archive contains 37 files: 24 source/configuration/documentation files and 13 PNG screenshots. Its SHA-256 is:

```text
27f4b0bf84c29fdf0096aabb004e88c49e439bd50391bc9d05232409768651d4
```

The audit covered the three Python application files, dependency declarations, both GitHub workflows, `.gitignore`, SQL setup, README and supporting documentation, frontend HTML/JavaScript/CSS configuration and test-file structure. Text searches checked common credential patterns; manual inspection distinguished public configuration and dummy test values from secrets. Relative Markdown links were checked against the archive: no missing targets were found.

No project code, tests, scraper, SQL setup or workflow was executed during either review. No database requests, commits or pushes were made. The initial supplied snapshot was left unchanged. After the owner authorised corrections, separate copies of ignore rules and documentation were edited, then re-reviewed. Git ignore checks used an isolated temporary repository and did not execute application code.

The ZIP has no `.git` directory. Git status, tracked-versus-untracked state, branch identity and historical commits could not be verified. The checksum identifies the supplied archive, not a Git commit. Findings apply to this snapshot, not automatically to later repository changes.

## 1. Initial confirmed findings and subsequent resolution

### F-01 — Project-specific ignore rules are missing

**Location:** `.gitignore` (environment rules and end of file).  
**Priority:** medium. **Status:** resolved in prepared correction package; see section 6.

The generic Python template excludes `.env`, `.venv` and Python caches, but has no project-specific rules for `data/`, `output/`, downloaded shelf backups or environment variants such as `.env.local`. The README instructs contributors to exclude these files, so the configuration does not fully implement the documented practice.

None of these generated/private files was found in the supplied ZIP. This is a confirmed prevention gap, not evidence that a secret or personal backup was published. Catalogue exports are generated public-source data; shelf backups can contain personal notes.

**Resolution:** append rules such as:

```gitignore
# FOLIO local configuration and generated files
.env.*
!.env.example
/data/
/output/
folio-shelf*.json
```

Keep a future `.env.example` limited to placeholders. Store other personal backups outside the repository. After changing ignore rules, check actual Git tracked files: ignore rules do not remove a file already committed. Browser uploads also require manual file selection.

**Recheck:** inspect the revised rules and, where a Git checkout is available, verify ignored paths and the tracked file list without printing credentials.

### F-02 — Supporting documents still describe an earlier project stage

**Locations:** `docs/INTERFACE_SETUP.md` (Publication and local URL); `docs/INTERFACE_VERIFICATION.md` (browser acceptance status); `docs/INTERFACE_ATTRIBUTION.md` (artwork statement).  
**Priority:** low. **Status:** resolved in prepared correction package; see section 6.

The setup document says Pages will be configured after local checks, although the root README and supplied deployment screenshot record a successful deployment. It also directs users to `localhost` while the README uses `127.0.0.1`; those are different browser-storage origins and can create apparently missing shelves.

The verification document is dated as an earlier development record but has no clear addendum for the later owner-confirmed browser and deployment checks. Its assistant-environment limitations remain valid and should not be erased. Attribution says the interface update contains no artwork copies, while the final repository now includes screenshots showing book covers. Remote loading of standalone covers is correctly described, but screenshot reproduction should be acknowledged.

**Resolution:** update the publication instructions to describe `deploy-website.yml`, use one local URL consistently, add dated owner-observed results to the verification record, and clarify that screenshots reproduce source cover artwork without transferring ownership.

**Recheck:** compare these documents with the root README and the evidence actually supplied. Do not mark notes, mobile behaviour or backup transfer verified unless separately tested.

## 2. Checks with no confirmed issue in this snapshot

| Area | Finding and boundary |
| --- | --- |
| Secrets | No real server-side secret, private key, GitHub token or JWT-shaped credential was identified by the targeted text review. This is not an exhaustive secret-detection guarantee. |
| Public configuration | `web/config.js` contains a Supabase project URL and intentionally publishable key. Their presence is expected. Values are omitted from this report. |
| Test fixtures | Secret-like and publishable-key-like literals in `web-tests/api.test.cjs` are dummy rejection/configuration fixtures, not evidence of real credentials. |
| Private/generated files | No `.env`, virtual environment, dependency folder, generated history/export directory or personal shelf backup is included. |
| Credential handling | `supabase_sync.py` reads environment variables/root `.env`, restricts destination URLs to HTTPS Supabase hosts, refuses redirects and uses generic network/HTTP error messages. |
| Frontend handling | The browser API accepts publishable keys and issues GET requests. Source descriptions and notes are escaped before HTML insertion; source links/images are restricted to the source host. Static inspection is not a penetration test. |
| Personal state | Shelf notes/status use browser storage and JSON export. Compare state is temporary. No application code was found sending personal notes to Supabase. |
| Workflows | The collector uses repository secrets and read-only repository contents permission. Pages publishes `web` only. Checkout credentials are not persisted. The collection artifact path is limited to `data/history.json`, with seven-day retention. |
| Setup | Dependency installation and execution commands are documented. A fresh-project SQL setup and detailed database instructions are present. The README and SQL match the prepared versions checked in this session. |
| README | Covers purpose, data collection, persistence, interaction, setup, development/learning, limitations and AI assistance; contains the supplied screenshots and working relative file targets. |

Screenshots intentionally show the interface, catalogue data and public repository identity. No credential or private note was identified in the supplied project screenshots. This review does not verify ownership or redistribution licences for source book artwork or descriptions.

## 3. Recommendations and possible concerns

These are improvements or verification gaps, not confirmed exploits.

- **Declare the direct `urllib3` dependency:** `books_scraper.py` imports `urllib3.util.retry`, but `requirements.txt` relies on Requests bringing urllib3 transitively. Declare a reviewed compatible version range if retaining the direct import. No current installation failure is established.
- **Improve reproducibility:** dependency ranges are not locked, Actions use version tags rather than immutable commit hashes, and the README could state Python 3.13 and Node 22 explicitly as the workflow versions. Consider a reviewed lock/constraints file and pinned Actions after testing compatibility.
- **Provide `.env.example`:** README placeholders are sufficient to explain configuration, but a dedicated placeholder file would make setup easier. Never copy an actual secret into it.
- **Review server-role privileges:** `database/001_initial_schema.sql` reproduces broad exported service-role privileges, including DELETE/TRUNCATE. The current synchroniser uses SELECT/INSERT/UPDATE. Narrowing privileges is a separate controlled improvement, not something applied in this audit.
- **Validate a fresh installation:** the SQL is transaction-wrapped and intentionally fails if the tables already exist. It is initial setup, not a rerunnable migration. Test it on a disposable new project, never by deleting production tables.
- **Retain documented operating limits:** uploads span multiple requests; observation read-back verifies IDs/counts rather than every value; mutable metadata is not historically versioned; local and cloud writers do not share a database lock. These limitations are documented and were not fixed during review.
- **Check legacy database objects separately:** the earlier `books` and `book_prices` tables are not referenced by the current application. Their permissions were not included in the four-table export. Not being used by FOLIO does not establish whether they are accessible through the shared project's API. Deletion is not required by this report.

## 4. Database evidence and limits

The separately supplied metadata export confirms RLS enabled on all four FOLIO tables, direct `anon` SELECT grants, and policies restricting run/observation reads to completed collections. It also shows the broader server-role grants. The initial schema reproduces these definitions and explicitly sets table privileges for a fresh installation.

This evidence does not establish all effective live permissions. Role memberships, column grants, schema defaults, functions, triggers, other exposed objects and actual denied-write requests were not inspected by the export query. No live permission probes were performed during this audit.

## 5. Previous checks, fixes and outstanding verification

Before this audit, the project added a full README with screenshots and reconstructed database setup from the owner's metadata export. Those deliverables are present in the reviewed ZIP. They resolve earlier documentation/setup omissions, but the initial SQL has not been execution-tested on a fresh database here.

Previous development evidence includes nine passing simulated synchronisation tests, 23 passing interface logic/API-mock tests, a successful manual cloud collection and successful Pages deployment. These are historical development results, not tests rerun against this archive during this audit. Owner screenshots/confirmation support desktop catalogue use, comparison, history, budget matching and saved-book persistence.

**Initial audit:** no fixes were made during the read-only inspection. The owner then explicitly authorised corrections. The separate edit and re-review are recorded in section 6; no application code or database configuration was changed.

Still unverified:

- Git history, prior secret commits, current tracked files and secret revocation/rotation.
- Whether any credential previously used outside this archive remains valid.
- Live repository settings, secret values, current dependencies' vulnerability status and complete workflow logs.
- Automatic scheduled runs after the demonstrated manual run.
- Clean-database SQL execution and end-to-end setup by a new user.
- Complete live RLS/effective-grant enforcement and permissions on legacy objects.
- Mobile and keyboard-only behaviour, note persistence, backup transfer and network-error recovery beyond the recorded evidence.

If a real secret is discovered in Git history, revoke/rotate it and remove it from history before considering that exposure resolved. Removing it only from the newest files is insufficient.

After upload, verify that GitHub contains the corrected files. The re-review below applies to the prepared package, not uninspected remote changes. This repository report is separate from the course's audit evidence PDF. Finding no additional issues does not prove the project is safe.


## 6. Authorised corrections and targeted re-audit — 24 November 2026

The owner requested “let's do the corrections” after the initial report.
Changes were prepared separately from the original archive:

| Finding | Correction | Re-review result |
| --- | --- | --- |
| F-01 | Appended `.env.*`, `!.env.example`, `/data/`, `/output/` and `folio-shelf*.json` rules, preserving the original template. | Git ignore behaviour checked in an isolated temporary repository. Environment files, generated data and named shelf backups are ignored; placeholder configuration, source, schema and screenshots remain eligible. |
| F-02 | Updated interface setup, verification and attribution documents. | Confirmed deployment instructions match the supplied workflow, local setup consistently uses `127.0.0.1`, owner observations are separated from pending tests, and screenshot artwork is acknowledged. |

Relative Markdown links were checked against the original snapshot with the
correction package applied: no missing targets. A file comparison confirmed
that only `.gitignore`, the three named interface documents and this report
were added/changed. Python/JavaScript code, dependencies, workflows, schema,
README and screenshots were not changed.

The initial archive checksum above remains the baseline. No Git history
was reconstructed and no live permission check or functional test was performed.

**Result:** the two confirmed findings are resolved in these prepared files.
The recommendations in section 3 and limitations in sections 4–5 remain applicable.
This is suitable as a bounded publication review record, not a guarantee that
all security, functionality or redistribution questions have been resolved.
