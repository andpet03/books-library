-- FOLIO: initial schema for a NEW Supabase project.
-- Reconstructed from owner-supplied database metadata exported 24 November 2026.
-- Run as the database administrator. Supabase roles must already exist.
-- Do NOT run against the existing FOLIO tables. Existing names cause failure.
-- No DROP, DELETE or TRUNCATE statements; no book data or credentials included.
-- One transaction: any error rolls back this setup.
BEGIN;
SET LOCAL search_path = public, pg_catalog;

CREATE TABLE public."library_categories" (
  "category_id" text NOT NULL,
  "name" text NOT NULL,
  "source_url" text NOT NULL,
  CONSTRAINT "library_categories_pkey" PRIMARY KEY (category_id)
);

ALTER TABLE public."library_categories" ENABLE ROW LEVEL SECURITY;

CREATE TABLE public."library_books" (
  "book_id" text NOT NULL,
  "title" text NOT NULL,
  "category_id" text NOT NULL,
  "description" text,
  "cover_url" text,
  "source_url" text NOT NULL,
  "product_type" text NOT NULL,
  "first_seen_at" timestamp with time zone NOT NULL,
  "last_seen_at" timestamp with time zone NOT NULL,
  CONSTRAINT "library_books_category_id_fkey" FOREIGN KEY (category_id) REFERENCES library_categories(category_id),
  CONSTRAINT "library_books_check" CHECK ((last_seen_at >= first_seen_at)),
  CONSTRAINT "library_books_pkey" PRIMARY KEY (book_id),
  CONSTRAINT "library_books_source_url_key" UNIQUE (source_url)
);

CREATE INDEX library_books_category_idx ON public.library_books USING btree (category_id);
ALTER TABLE public."library_books" ENABLE ROW LEVEL SECURITY;

CREATE TABLE public."library_scrape_runs" (
  "run_id" uuid NOT NULL,
  "started_at" timestamp with time zone NOT NULL,
  "finished_at" timestamp with time zone,
  "status" text NOT NULL,
  "expected_books" integer,
  "books_collected" integer DEFAULT 0 NOT NULL,
  "pages_processed" integer DEFAULT 0 NOT NULL,
  "error_count" integer DEFAULT 0 NOT NULL,
  CONSTRAINT "library_scrape_runs_books_collected_check" CHECK ((books_collected >= 0)),
  CONSTRAINT "library_scrape_runs_check" CHECK (((finished_at IS NULL) OR (finished_at >= started_at))),
  CONSTRAINT "library_scrape_runs_error_count_check" CHECK ((error_count >= 0)),
  CONSTRAINT "library_scrape_runs_expected_books_check" CHECK ((expected_books >= 0)),
  CONSTRAINT "library_scrape_runs_pages_processed_check" CHECK ((pages_processed >= 0)),
  CONSTRAINT "library_scrape_runs_pkey" PRIMARY KEY (run_id),
  CONSTRAINT "library_scrape_runs_status_check" CHECK ((status = ANY (ARRAY['running'::text, 'completed'::text, 'partial'::text, 'failed'::text, 'interrupted'::text])))
);

ALTER TABLE public."library_scrape_runs" ENABLE ROW LEVEL SECURITY;

CREATE TABLE public."library_book_observations" (
  "observation_id" uuid NOT NULL,
  "book_id" text NOT NULL,
  "run_id" uuid NOT NULL,
  "observed_at" timestamp with time zone NOT NULL,
  "price_incl_tax" numeric(10,2) NOT NULL,
  "price_excl_tax" numeric(10,2) NOT NULL,
  "tax" numeric(10,2) NOT NULL,
  "currency" text NOT NULL,
  "availability" integer NOT NULL,
  "availability_text" text NOT NULL,
  "rating" smallint,
  "review_count" integer NOT NULL,
  CONSTRAINT "library_book_observations_availability_check" CHECK ((availability >= 0)),
  CONSTRAINT "library_book_observations_book_id_fkey" FOREIGN KEY (book_id) REFERENCES library_books(book_id),
  CONSTRAINT "library_book_observations_currency_check" CHECK ((currency = 'GBP'::text)),
  CONSTRAINT "library_book_observations_pkey" PRIMARY KEY (observation_id),
  CONSTRAINT "library_book_observations_price_excl_tax_check" CHECK ((price_excl_tax >= (0)::numeric)),
  CONSTRAINT "library_book_observations_price_incl_tax_check" CHECK ((price_incl_tax >= (0)::numeric)),
  CONSTRAINT "library_book_observations_rating_check" CHECK (((rating >= 1) AND (rating <= 5))),
  CONSTRAINT "library_book_observations_review_count_check" CHECK ((review_count >= 0)),
  CONSTRAINT "library_book_observations_run_id_book_id_key" UNIQUE (run_id, book_id),
  CONSTRAINT "library_book_observations_run_id_fkey" FOREIGN KEY (run_id) REFERENCES library_scrape_runs(run_id),
  CONSTRAINT "library_book_observations_tax_check" CHECK ((tax >= (0)::numeric))
);

CREATE INDEX library_observations_book_date_idx ON public.library_book_observations USING btree (book_id, observed_at DESC);
ALTER TABLE public."library_book_observations" ENABLE ROW LEVEL SECURITY;

-- Explicit table privileges override inherited defaults on these new tables.
-- service_role permissions reproduce the export, including administrative operations.
GRANT USAGE ON SCHEMA public TO anon, service_role;

REVOKE ALL PRIVILEGES ON TABLE public."library_categories" FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public."library_categories" TO "anon";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."library_categories" TO "service_role";
CREATE POLICY "library_public_categories" ON public."library_categories"
  AS PERMISSIVE FOR SELECT TO anon
  USING (true);

REVOKE ALL PRIVILEGES ON TABLE public."library_books" FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public."library_books" TO "anon";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."library_books" TO "service_role";
CREATE POLICY "library_public_books" ON public."library_books"
  AS PERMISSIVE FOR SELECT TO anon
  USING (true);

REVOKE ALL PRIVILEGES ON TABLE public."library_scrape_runs" FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public."library_scrape_runs" TO "anon";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."library_scrape_runs" TO "service_role";
CREATE POLICY "library_public_completed_runs" ON public."library_scrape_runs"
  AS PERMISSIVE FOR SELECT TO anon
  USING ((status = 'completed'::text));

REVOKE ALL PRIVILEGES ON TABLE public."library_book_observations" FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public."library_book_observations" TO "anon";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."library_book_observations" TO "service_role";
CREATE POLICY "library_public_completed_observations" ON public."library_book_observations"
  AS PERMISSIVE FOR SELECT TO anon
  USING ((EXISTS ( SELECT 1
   FROM library_scrape_runs r
  WHERE ((r.run_id = library_book_observations.run_id) AND (r.status = 'completed'::text)))));

COMMIT;
