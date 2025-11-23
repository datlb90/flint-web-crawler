/**
 * Centralized configuration for the web crawler.
 * All crawler-related constants should be defined here for easy maintenance.
 */
export const CRAWLER_CONFIG = {
  // The allowed domain to crawl (including subdomains)
  ALLOWED_DOMAIN: "flintk12.com",

  // Default maximum number of pages to crawl if not specified
  DEFAULT_MAX_PAGES: 100,

  // Hard safety cap to prevent runaway crawls
  MAX_PAGES_HARD_LIMIT: 500,

  // User agent string for HTTP requests
  USER_AGENT: "FlintCrawler/1.0 (+https://flintk12.com)",

} as const;

