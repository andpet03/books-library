# Interface verification — updated 24 November 2026

## Checks completed during development

- JavaScript syntax checks passed for core.js, api.js and app.js.
- 23 Node tests passed: search, combined filters, unknown ratings, numeric sorting,
  budget arithmetic in pennies, count limits, duplicate avoidance, HTML escaping,
  URL restrictions, shelf backup validation, fixed-run snapshot integrity,
  key restrictions, API errors, pagination past a server row cap and history
  query parameters.
- The supplied 1,000-book history was used to check the real field mappings.
- The distribution contains only the website, offline tests and documentation.
  The only embedded credential is the owner's intentionally public publishable key.
  No secret key, environment file or personal shelf data is bundled.

## Assistant-environment limits during initial development

A direct read request to the project's Supabase API received HTTP 403 from this
execution environment. This does not establish whether the cause is the network
restriction or Supabase. The owner subsequently demonstrated successful catalogue reads in the browser.
That does not resolve the cause of this environment-specific failure or verify
all database permissions. No database writes were attempted by this check.

A Chromium visual/interaction check could not start because this execution
sandbox denies a required socket operation. Desktop appearance was subsequently documented by the owner; keyboard
interaction and mobile behaviour still require confirmation. The
23 passing tests are logic/API-mock tests, not an end-to-end or visual audit.

## Owner-provided browser and deployment evidence

Screenshots captured on 21 November and subsequent owner confirmation support:

- A rendered catalogue with 1,000 books and 50 categories.
- A known-title search and combined category/price/rating filters.
- A book detail view and price/stock charts with three observations.
- A saved book remaining after a browser reload. Written-note persistence was
  not separately confirmed. Comparison selections reset on reload by design.
- A two-book comparison and a £50 Book match yielding a £49.24 total.
- A successful Pages workflow completing in 21 seconds, followed by owner
  confirmation of the live site before README preparation.

These observations do not establish every edge case below. Evidence is displayed
in the [root README](../README.md); static publication findings and the correction
review are recorded in [AUDIT.md](../AUDIT.md). No application tests were rerun
as part of the documentation corrections on 24 November.

## Browser acceptance checklist (not a list of passed tests)

1. Start the web-only local server described in INTERFACE_SETUP.md. Verify the
   catalogue loads and the total matches the latest completed run (currently
   expected to be 1,000 if the source has not changed).
2. Search a known title; try a category, a maximum price and a minimum rating.
   Clear filters; move to the last page and confirm titles remain available.
3. Save a book, add a note, mark it finished and reload. Confirm persistence.
4. Export a shelf backup; restore it in another browser/origin. Confirm the
   existing notes are retained on duplicate IDs.
5. Compare three books. Confirm a fourth is refused until one is removed.
6. Try Book match with a £50 budget. Confirm total <= £50, availability > 0 and
   finished books are excluded when that setting is selected.
7. Open a book's history, switch between price and stock and expand the value
   table. A flat series is valid for this demo catalogue.
8. Turn off the network and press Refresh after a successful load. Confirm the
   previous collection stays visible with an error message. Restore connectivity.
9. Check phone-width layout, keyboard navigation, focus indicators and Escape
   to close a book dialog. Test a missing image and confirm the title fallback.
10. Confirm site visitors cannot write database records through API permissions.
    Do this as a separate controlled database permission review, not by allowing
    destructive operations in the public interface.

## Known limitations

- Catalogues use a fixed completed observation run. Book descriptions/covers are
  mutable metadata in library_books and are not versioned for historical runs.
- Only books observed in the latest completed run appear in Discover. Saved
  titles absent from that run are retained in the shelf backup and listed as
  unavailable, with a removal option.
- A fresh page load downloads all book metadata and latest observations. There
  is no offline catalogue, persistent cache, user account or cross-device sync.
- History fetches all completed observations for the selected book up to the
  chosen snapshot's finish time. Very long histories may need aggregation later.
- The random bundle picker is intentionally simple, not an AI recommender or
  an optimisation algorithm. Its budget excludes delivery fees.
- The daily schedule was configured, and the first manually triggered GitHub
  run succeeded in 19m 1s. An automatically scheduled run has not yet been seen.

This document records development checks; the separate publication review is
[AUDIT.md](../AUDIT.md). Unconfirmed checks remain open.
