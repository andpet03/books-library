(function (root) {
  'use strict';
  class CatalogueAPI {
    constructor(config, fetcher = (...args) => fetch(...args)) {
      const url = new URL(config.supabaseUrl);
      if (url.protocol !== 'https:' || !/^[a-z0-9-]+\.supabase\.co$/.test(url.host) || url.pathname !== '/' || url.search || url.hash || url.username || url.password) throw new Error('The catalogue address is not configured correctly.');
      if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(config.publishableKey)) throw new Error('The website needs a Supabase publishable key. Secret keys are not accepted.');
      this.base = url.origin + '/rest/v1/'; this.key = config.publishableKey; this.fetcher = fetcher;
    }
    async get(table, params) {
      if (!['library_books','library_categories','library_scrape_runs','library_book_observations'].includes(table)) throw new Error('Unknown catalogue resource.');
      const url = this.base + table + '?' + new URLSearchParams(params);
      for (let attempt = 0; attempt < 3; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 20000);
        let res;
        try {
          res = await this.fetcher(url, {method:'GET',headers:{apikey:this.key},signal:controller.signal,credentials:'omit',redirect:'error'});
        } catch {
          if (attempt === 2) throw new Error('The catalogue is taking too long to respond. Check your connection and try again.');
        } finally { clearTimeout(timer); }
        if (res && res.ok) { const data = await res.json(); if (!Array.isArray(data)) throw new Error('Unexpected catalogue response.'); return data; }
        if (res && ![429,500,502,503,504].includes(res.status)) throw new Error(`The catalogue could not be read (HTTP ${res.status}). Please try again later.`);
        if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 800 * (attempt+1)));
      }
      throw new Error('The catalogue is temporarily unavailable. Please try again later.');
    }
    async all(table, params, progress) {
      const rows = [];
      while (true) {
        const page = await this.get(table, {...params,limit:250,offset:rows.length});
        if (!page.length) return rows;
        rows.push(...page);
        if (progress) progress(rows.length);
      }
    }
    async catalogue(progress) {
      const runs = await this.get('library_scrape_runs',{select:'run_id,finished_at,started_at,status,books_collected',status:'eq.completed',order:'finished_at.desc,run_id.desc',limit:1});
      if (!runs.length) throw new Error('No completed collection is available yet. Please come back shortly.');
      const run = runs[0];
      const [books,categories,observations] = await Promise.all([
        this.all('library_books',{select:'*',order:'book_id.asc'}),
        this.all('library_categories',{select:'*',order:'category_id.asc'}),
        this.all('library_book_observations',{select:'*',run_id:'eq.'+run.run_id,order:'book_id.asc'},progress)
      ]);
      return {run,categories,books:root.Folio.snapshot(books,categories,observations,run)};
    }
    history(bookId, cutoff) {
      return this.all('library_book_observations', {select:'observation_id,observed_at,price_incl_tax,availability',book_id:'eq.'+bookId,observed_at:'lte.'+cutoff,order:'observed_at.asc,observation_id.asc'});
    }
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = CatalogueAPI;
  else root.CatalogueAPI = CatalogueAPI;
})(typeof globalThis !== 'undefined' ? globalThis : this);
