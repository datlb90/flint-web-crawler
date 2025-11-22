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

- Domain-scoped only: Only crawl links belonging to the flintk12.com domain or any of its subdomains. External links are ignored entirely, and redirects that end outside this domain are skipped.

- Static HTML only: The crawler fetches HTML responses and parses the DOM. It does not execute JavaScript or render client-side navigation.

- Bounded traversal: A maximum page limit is enforced (user-configurable) to prevent runaway crawling on large sites.

- Deterministic results:
    - The crawler produces the exact same output every time you run it with the same input.
    - The crawler processes pages sequentially, so the order in which pages are discovered is always the same.
    - Multiple URLs can refer to the same page. Normalization ensures they map to a single canonical URL, preventing accidental duplication.

- Graceful error handling: 404s, 500s, network errors, and non-HTML content are skipped safely.

## High-Level Architecture

The application consists of three main pieces:

1. Frontend (Next.js App Router)

Located in `src/app/page.tsx`, this component provides:

- An input box for the starting URL.

- An optional max page limit.

- A button to begin crawling.

- Loading, error, and result states.

- Renders the final site map (pages, links, assets).

2. API Route `POST /api/crawl`

Implemented in `src/app/api/crawl/route.ts`, responsible for

- Validating inputs.

- Invoking the crawler module.

- Structuring and returning the JSON response.

- Mapping errors to user-friendly messages.

3. Core Crawler `src/lib/crawler.ts`

A pure TypeScript module that:

- Fetches HTML from pages using `fetch` — chosen because it is a built-in, lightweight, standards-compliant HTTP client that keeps the crawler simple and dependency-free while providing a reliable API for retrieving HTML pages.

- Parses HTML using `Cheerio` — selected because it is lightweight, fast, and well-suited for server-side crawling. Cheerio provides a jQuery-style API for selecting elements, works without executing JavaScript, and avoids the heavy overhead of tools like JSDOM or Puppeteer, which are unnecessary for this static HTML use case.

- Extracts: internal links and assets (`img`, `script`, `link`).

- Builds a graph representing the site.

- Uses BFS with a visited set for safe traversal — BFS was chosen over DFS because it provides a more predictable and stable crawl order, surfaces top-level site structure earlier, and makes it easier to enforce a max-page limit. DFS can be deterministic, but small changes in page structure can cause large shifts in traversal order and deeper branch exploration.

This module is intentionally isolated from Next.js for easier testing and reuse.

## Data Structures

The crawler represents the website as a directed graph:

```type PageNode = {
  url: string;
  links: string[];   // Internal links discovered on this page
  assets: string[];  // Static assets (img/script/css)
};

type SiteMap = Record<string, PageNode>;
```

Why this structure?

- `Record<string, PageNode>` gives O(1) random access

- JSON-friendly serialization

- Natural representation of a link graph

- Easy to extend (can add metadata later)


## Additional Data Structures

`visited: Set<string>`: Prevents revisiting the same page; important for avoiding infinite loops.

`queue: string[]`: For orderly BFS traversal.

`pageLimit`: Hard stop to avoid runaway crawls.

## Alternatives Considered

- Client-side crawling was rejected because browser CORS rules prevent fetching most pages on flintk12.com. It would also expose the crawler logic publicly, which is not appropriate for this assignment. Most importantly, it cannot reliably access internal or cross-page content on the site.

- A headless browser like Puppeteer was rejected because it is far heavier than needed for static HTML parsing. It is slower due to full page rendering and JavaScript execution. Using it would be overkill for a site that already serves server-rendered HTML.

- JSDOM was considered because it offers a full DOM environment, but it is slower and heavier. Cheerio was chosen instead because it is faster, more lightweight, and perfectly suited for static HTML extraction. It provides a simple, predictable API without the overhead of simulating a browser.

## Extensibility & Future Improvements

The current crawler is intentionally simple, but several enhancements are straightforward:

- Parallel/concurrent fetching

- Respecting robots.txt

- Reading sitemap.xml for shortcuts

- Persisting crawl results in a database

- Graph visualization (D3.js, Cytoscape.js)

- Detecting duplicate content via hashing

- Cookies / session support for authenticated areas


## Edge Cases Handled

- Invalid or unreachable URLs

- Redirects (301/302): skipping redirects that land on external domains

- External links

- Query parameter normalization

- Cyclic links

- HTTP errors

- Non-HTML content

- Enforced page limit

- Broken HTML or missing tags

The crawler uses graceful failure handling to ensure predictable behavior.

## Running the Project

```npm install
npm run dev
```

Visit:

```http://localhost:3000
```

Enter a starting URL and optional page limit, then click Crawl.