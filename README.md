## Flint Web Crawler

A simple web crawler that discovers pages on flintk12.com, extracts their static assets, and builds a site map showing how pages connect.

## Problem Understanding

The goal is to build a crawler that, starting from a user-provided URL on flintk12.com, discovers all reachable pages within that domain and outputs a simple site map.

The crawler must:

- Stay strictly inside the flintk12.com domain and its subdomains.

- Avoid following any external links (e.g., social media).

- Prevent infinite loops and repeated visits.

- Extract static assets (img, script, css) and internal links.

- Produce a JSON site map showing how pages connect.


## Constraints & Assumptions

- Domain-scoped only: Only crawl links belonging to the configured domain (defaults to flintk12.com) or any of its subdomains. External links are ignored entirely, and redirects that end outside the allowed domain are skipped.

- Bounded traversal: A maximum page limit is enforced to prevent runaway crawling on large sites. Max pages is an upper bound, not a target: The crawler stops when either the page limit is reached **or** there are no more eligible pages left in the queue.

- Static HTML only: The crawler fetches HTML responses and parses the DOM. It does not execute JavaScript or render client-side navigation.

- Deterministic results:
    - The crawler produces the exact same output every time you run it with the same input.
    - The crawler processes pages sequentially, so the order in which pages are discovered is always the same.
    - Multiple URLs can refer to the same page. Normalization ensures they map to a single canonical URL, preventing accidental duplication.

- Graceful error handling: 404s, 500s, network errors, and non-HTML content are skipped safely.

## High-Level Architecture

The application consists of three main pieces:

**1. Frontend (Next.js App Router)**

Located in `src/app/page.tsx`, this component provides:

- An input box for the starting URL.

- A max page limit.

- A Crawl button to begin crawling.

- Loading, error, and result states.

- Renders the final site map (pages, links, assets).

**2. API Route `POST /api/crawl`**

Implemented in `src/app/api/crawl/route.ts`, responsible for:

- Sanity checking for inputs.

- Invoking the crawler module.

- Structuring and returning the JSON response.

- Mapping errors to user-friendly messages using custom error classes for type-safe error handling.

**3. Core Crawler Module (`src/lib/crawler.ts`)**

A pure TypeScript module that:

- Handles input validations

- Fetches HTML from pages using `fetch` - chosen because it is a built-in, lightweight, standards-compliant HTTP client that keeps the crawler simple and dependency-free while providing a reliable API for retrieving HTML pages.

- Uses an extractor interface (`IExtractor`) for parsing HTML — this abstraction allows different extraction implementations (Cheerio, JSDOM, or custom parsers) without changing crawler logic. The default `CheerioExtractor` uses Cheerio for fast, server-side HTML parsing without executing JavaScript.

- Extracts internal links and assets (`img`, `script`, `link`) via the extractor interface.

- Builds a graph representing the site.

- Uses BFS with a visited set for safe traversal. BFS was chosen over DFS because it provides a more predictable and stable crawl order, surfaces top-level site structure earlier, and makes it easier to enforce a max-page limit. DFS can be deterministic, but small changes in page structure can cause large shifts in traversal order and deeper branch exploration.

- Supports configurable domain validation. The allowed domain can be specified per-crawl via `CrawlOptions`, making it flexible for different use cases while defaulting to the configured domain.

This module is intentionally isolated from Next.js for easier testing and reuse.

## Module Structure

The codebase is organized into focused modules for better maintainability:

**`src/lib/config.ts`** — Centralized configuration
- All crawler-related constants (domain, limits, timeouts, etc.)
- Single source of truth for configuration values
- Easy to modify without touching business logic

**`src/lib/urlUtils.ts`** — URL-related utilities
- `normalizeUrl()` — Normalizes URLs, removes query params/fragments, enforces domain restrictions
- `isAllowedDomain()` — Validates hostnames against allowed domain
- `resolveAbsoluteUrl()` — Converts relative URLs to absolute URLs
- Reusable across the codebase, reducing duplication

**`src/lib/errors.ts`** — Custom error classes
- `DomainError` — Thrown when URLs don't belong to allowed domain
- `ValidationError` — Thrown for invalid input (e.g., invalid maxPages)
- `CrawlError` — For network/HTTP errors during crawling
- Enables type-safe error handling with `instanceof` checks instead of fragile string matching

**`src/lib/crawlTypes.ts`** — TypeScript type definitions
- Shared types for API responses and data structures
- Ensures type safety across the application

**`src/lib/extractor.ts`** — Extractor interface and implementations
- `IExtractor` interface — abstraction for HTML parsing and extraction
- `CheerioExtractor` — default implementation using Cheerio for fast server-side parsing
- Allows custom extractors to be plugged in without modifying crawler logic
- Supports configurable domain validation for link normalization

**`src/lib/crawler.ts`** — Core crawling logic
- Uses the above modules for configuration, URL handling, error reporting, and extraction
- Focused on the crawling algorithm (BFS traversal, visited tracking, queue management)
- Accepts configurable options: `maxPages`, `extractor`, and `allowedDomain`

**`src/lib/__tests__/`** — Test suite
- Comprehensive unit tests for all core modules using Jest
- `urlUtils.test.ts` — Tests URL normalization, domain validation, and absolute URL resolution
- `errors.test.ts` — Tests custom error classes (`DomainError`, `ValidationError`, `CrawlError`) and error handling
- `extractor.test.ts` — Tests HTML extraction logic, link discovery, and asset extraction
- `crawler.test.ts` — Tests the main crawling algorithm, BFS traversal, visited tracking, and site map generation
- Tests are isolated from Next.js for fast execution and easy debugging
- Run tests with `npm test`, `npm run test:watch`, or `npm run test:coverage`

## Data Structures

The crawler represents the website as a directed graph:

```
type PageNode = {
  url: string;
  links: string[];   // Internal links discovered on this page
  assets: string[];  // Static assets (img/script/css)
};

type SiteMap = Record<string, PageNode>;
```

Why this structure?

- We chose `Record<string, PageNode>` over alternatives like `Map` (not JSON-serializable), `Array` (O(n) lookup), or nested structures (unnecessary complexity) because it provides O(1) random access for URL lookups during crawling, direct JSON serialization for API responses, a simple API (`siteMap[url]`), and natural representation of URLs as keys. 

- JSON-friendly serialization

- Natural representation of a link graph

- Easy to extend (can add metadata later)


## Additional Data Structures

`visited: Set<string>`: Prevents revisiting the same page; important for avoiding infinite loops.

`queue: string[]`: For orderly BFS traversal.

`maxPages`: Hard stop to avoid runaway crawls (configurable via `CRAWLER_CONFIG.MAX_PAGES_HARD_LIMIT`).

## Alternatives Considered

- Client-side crawling was rejected because browser CORS rules prevent fetching most pages on flintk12.com. It would also expose the crawler logic publicly, which is not appropriate for this assignment. Most importantly, it cannot reliably access internal or cross-page content on the site.

- A headless browser like Puppeteer was rejected because it is far heavier than needed for static HTML parsing. It is slower due to full page rendering and JavaScript execution. Using it would be overkill for a site that already serves server-rendered HTML.

- JSDOM was considered because it offers a full DOM environment, but it is slower and heavier. Cheerio was chosen instead because it is faster, more lightweight, and perfectly suited for static HTML extraction. It provides a simple, predictable API without the overhead of simulating a browser.

## Extensibility & Future Improvements

The crawler includes several extensibility features and has room for future enhancements:

### Implemented Extensibility Features

- **Custom extractors**: The `IExtractor` interface allows you to create custom extraction logic (e.g., regex-based, JSDOM, or specialized parsers). Pass your extractor via `CrawlOptions.extractor`.

- **Configurable domain**: Use `CrawlOptions.allowedDomain` to crawl different domains per request, making the crawler reusable across multiple sites.

### Future Improvements

- Suport timeout, rate limiting

- Enforce response size limits

- Improve error tracking: tracked failed URLs separately, include failure statistics in response

- Retry logic for transient failures

- Parallel/concurrent fetching

- Persisting crawl results in a database

- Respecting robots.txt

- Graph visualization 

## Edge Cases Handled

### URL and Domain Validation

- **Invalid or unreachable URLs**: Invalid URL formats are rejected during normalization; network errors are caught and logged without crashing the crawler
- **External links**: Links outside the allowed domain (including subdomains) are filtered out during extraction and normalization
- **Redirects (301/302)**: Final redirect URLs are normalized and validated against the allowed domain; redirects to external domains are skipped
- **Protocol validation**: Only HTTP and HTTPS URLs are accepted; other protocols (mailto, tel, javascript, etc.) are filtered out
- **Relative URL resolution**: Relative URLs are converted to absolute URLs using the page's base URL before processing
- **Query parameter and fragment normalization**: Query parameters and URL fragments are removed during normalization to prevent duplicate page entries
- **Trailing slash normalization**: Trailing slashes are removed (except for root path) to ensure consistent URL representation
- **Case-insensitive domain matching**: Domain validation is case-insensitive and handles `www.` prefix normalization
- **Subdomain support**: All subdomains of the allowed domain are accepted (e.g., `www.flintk12.com`, `blog.flintk12.com`)

### Crawl Control and Limits

- **Cyclic links**: A `visited` Set prevents revisiting the same page, avoiding infinite loops
- **Enforced page limit**: Configurable `maxPages` with validation and a hard safety cap (`MAX_PAGES_HARD_LIMIT`) to prevent runaway crawls
- **URL deduplication**: Sets are used internally to prevent duplicate links and assets in the output

### HTTP and Content Handling

- **HTTP errors**: Non-OK responses (4xx, 5xx) are skipped gracefully without stopping the crawl
- **Non-HTML content**: Content-Type validation ensures only HTML pages are processed; other content types (PDF, images, etc.) are skipped
- **Empty or malformed HTML**: Cheerio handles empty HTML, malformed markup, and missing tags gracefully
- **Missing attributes**: Missing `href`, `src`, or other attributes are checked before processing to avoid errors

### Input Validation

- **Invalid JSON body**: API route validates request body format and returns appropriate error messages
- **Missing or empty URL**: API route validates that URL is provided and non-empty
- **Invalid maxPages value**: Validates that `maxPages` is a positive number, with type checking at both API and crawler levels
- **Invalid allowedDomain type**: API route validates that `allowedDomain` is a string if provided

### Error Handling

- **Type-safe error handling**: Custom error classes (`DomainError`, `ValidationError`, `CrawlError`) enable type-safe error discrimination using `instanceof` checks
- **Network errors**: Fetch failures are caught and logged without crashing; the crawler continues with remaining URLs
- **Graceful degradation**: Individual page failures don't stop the entire crawl; the crawler continues processing the queue

The crawler uses graceful failure handling to ensure predictable behavior. Errors are handled with custom error classes that provide type safety and better error context.

## Running the Project

```
npm install
npm run dev
```

Visit:

```
http://localhost:3000
```

Enter a starting URL and a max pages value, then click Crawl.
