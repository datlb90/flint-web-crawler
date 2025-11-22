/**
 * Centralized configuration for the web crawler.
 * All crawler-related constants should be defined here for easy maintenance.
 */
export const CRAWLER_CONFIG = {
  /** The allowed domain to crawl (including subdomains) */
  ALLOWED_DOMAIN: "flintk12.com",
  
  /** Default maximum number of pages to crawl if not specified */
  DEFAULT_MAX_PAGES: 100,
  
  /** Hard safety cap to prevent runaway crawls */
  MAX_PAGES_HARD_LIMIT: 500,
  
  /** User agent string for HTTP requests */
  USER_AGENT: "FlintCrawler/1.0 (+https://flintk12.com)",
  
  /** Request timeout in milliseconds */
  REQUEST_TIMEOUT_MS: 10000,
  
  /** Delay between requests in milliseconds (rate limiting) */
  DELAY_BETWEEN_REQUESTS_MS: 100,
  
  /** Maximum response size in bytes (10MB) */
  MAX_RESPONSE_SIZE_BYTES: 10 * 1024 * 1024,
} as const;

