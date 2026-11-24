# Recreate the FOLIO database

## Existing project owner

The current database already contains these tables and its data. **Do not run
`001_initial_schema.sql` on the existing project.** Add it to the repository as
setup documentation for a fresh installation. It does not migrate or repair an
existing database. The old `books` and `book_prices` tables are not dependencies
and are neither created nor modified by this script.

## Fresh installation

1. Create a new Supabase project and open its SQL Editor as the database administrator.
2. Copy the complete contents of `database/001_initial_schema.sql` into the editor
   and run it once. It creates four empty tables, constraints, two additional
   indexes, RLS policies and table privileges in one transaction. Supabase's
   built-in `anon`, `authenticated` and `service_role` roles must already exist.
3. If any statement fails, resolve the error before continuing. The transaction
   must commit successfully. A name collision intentionally fails rather than
   silently accepting a possibly incompatible table. This is not a rerunnable migration.
4. Install the repository's Python dependencies as described in the root README.
5. Put the new project's URL and server-side secret key into the root `.env`:

   ```dotenv
   SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   SUPABASE_KEY=YOUR_SERVER_SIDE_SECRET_KEY
   ```

6. Run `python update_library.py` using the configured Python environment. This
   collects and uploads the catalogue. The schema alone does not contain book data.
   Alternatively, `--sync-only` can upload a valid existing local `data/history.json`.
7. Edit the existing fields in `web/config.js`: set `supabaseUrl` to the new project
   URL and `publishableKey` to that project's **publishable** key. Never put the
   server-side secret in this file. The website requires public Data API access
   to the `public` schema and the four tables.
8. Open FOLIO and confirm that a completed collection loads. If using GitHub
   Actions, configure `SUPABASE_URL` and `SUPABASE_KEY` repository secrets for the
   new project too. Keep the environment file out of Git.

## Access model reproduced

| Role | Table privileges | RLS behaviour |
| --- | --- | --- |
| `anon` | SELECT only | Categories/books readable; runs and observations restricted to completed runs |
| `authenticated` | No direct table grants from this script | No policies created for this role; FOLIO has no login |
| `service_role` | SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER | Supabase's privileged server role bypasses RLS |
| Database owner | Owner administration | Owner normally bypasses RLS; FORCE RLS is not enabled |

The server-role privileges above reproduce the exported configuration. The
scraper normally needs SELECT, INSERT and UPDATE; narrowing privileges can be
considered separately. No permission change has been applied to the live project.
The script also explicitly grants schema USAGE to `anon` and `service_role` and
revokes table privileges from PUBLIC, avoiding reliance on broad table defaults.
Schema-level privileges were not included in the supplied export.

## Provenance and validation limits

Reconstructed on 24 November 2026 from the owner's read-only export of the four
FOLIO tables. Columns, defaults, nullability, named constraints, indexes, policy
expressions and direct application-role grants were compared with that export.
Primary-key and unique indexes are created by their constraints and are not
created a second time.

The export confirms RLS is enabled on all four tables and direct `anon` grants
are SELECT only. It is not a complete live security audit: role memberships,
column-level grants, functions, triggers, schema defaults, other API-exposed
objects and actual denied-write requests were not checked by that query.

This setup file has been statically checked against the export. It has **not**
been executed against a fresh PostgreSQL/Supabase instance in the assistant's
environment. A clean-database execution test remains pending. No live database
changes were made while preparing this package.
