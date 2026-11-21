# Interface verification — 21 November 2026

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

## Not verified here

A direct read request to the project's Supabase API received HTTP 403 from this
execution environment. This does not establish whether the cause is the network
restriction or Supabase. Successful anonymous access must be checked in the
owner's browser. No database writes were attempted.

A Chromium visual/interaction check could not start because this execution
sandbox denies a required socket operation. Therefore rendered appearance,
keyboard interaction and mobile behaviour require browser confirmation. The
23 passing tests are logic/API-mock tests, not an end-to-end or visual audit.

## Browser acceptance checks

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

This document records development checks; it is not the final AUDIT.md.
