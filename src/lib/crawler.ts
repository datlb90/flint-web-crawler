import * as cheerio from "cheerio";

// A PageNode represents a single web page
export type PageNode = {
    url: string; // The canonical URL of the page
    links: string[]; // Internal links discovered on this page
    assets: string[]; // Static assets (img/script/css) discovered on this page
};

// A SiteMap is a collection of PageNodes keyed by their canonical URL
export type SiteMap = Record<string, PageNode>;

export type CrawlOptions = {
    maxPages?: number; // Maximum number of pages to crawl,
}

// The result of extracting links and assets from an HTML page
type ExtractResult = {
    links: string[]; // The links discovered on the page
    assets: string[]; // The assets discovered on the page
}

const ALLOWED_DOMAIN = "flintk12.com"; // The allowed domain to crawl
const DEFAULT_MAX_PAGES = 100; // The default maximum number of pages to crawl if maxPages is not provided

/**
 * Normalize the hostname to remove www.
 * @param hostname - The hostname to normalize
 * @returns The normalized hostname
 */
function normalizeHostname(hostname: string): string {
    return hostname.toLowerCase().replace(/^www\./, "");
}

/**
 * Normalize the URL to remove query parameters and ensure it starts with http:// or https://
 * Ensure the url belongs to the allowed domain flintk12.com
 * @param rawUrl - The URL to normalize
 * @returns The normalized URL or null if it is not valid
 */
function normalizeUrl(rawUrl: string): string | null {
    // Trim the URL to remove any leading or trailing whitespace
    rawUrl = rawUrl.trim();

    let url: URL;

    try {
        // Parse the URL to get hostname, path, etc.
        // If rawUrl is relative, this will throw unless you supply a base.
        // All relative URLs should be converted to absolute URLs BEFORE they reach this function.
        url = new URL(rawUrl);
    } catch {
        return null; // Invalid URL
    }

    // Only accept http/https
    if (url.protocol !== "http:" && url.protocol !== "https:") {
        return null;
    }

    // Enforce allowed domain (flintk12.com or www.flintk12.com)
    const host = normalizeHostname(url.hostname);
    if (host !== ALLOWED_DOMAIN) {
        return null; // Skip external domain
    }

    // Remove query parameters and fragments
    url.search = "";
    url.hash = "";

    // Remove trailing slash unless it's the root
    if (url.pathname.endsWith("/") && url.pathname !== "/") {
        url.pathname = url.pathname.slice(0, -1);
    }

    return url.toString();
}

/**
 * Check if the response is an HTML page
 * @param contentType - The content type of the response
 * @returns True if the response is an HTML page, false otherwise
 */
function isHtmlResponse(contentType: string | null): boolean {
    if (!contentType) return false;
    return contentType.toLowerCase().includes("text/html");
}


/**
 * Extract the links and assets from an HTML page
 * @param pageUrl - The URL of the page
 * @param html - The HTML of the page
 * @returns The links and assets discovered on the page
 */
function extractLinksAndAssets(pageUrl: string, html: string): ExtractResult {
    // Parses the raw HTML string into a DOM-like structure
    // Allows us to use jQuery-style selectors to find elements
    const $ = cheerio.load(html);

    const linkSet = new Set<string>();
    const assetSet = new Set<string>();

    // Extract links from the page
    $("a[href]").each((_, el) => { // Find all <a> tags with href attributes
        const href = $(el).attr("href");
        if (!href) return; // Skip if no href attribute

        if (
            href.startsWith("#") || // Skip anchors
            href.startsWith("mailto:") || // Skip mailto links
            href.startsWith("tel:") || // Skip tel links
            href.startsWith("javascript:") // Skip javascript links
        ) {
            return;
        }

        // Turn relative URL into absolute using the pageUrl as base.
        let absoluteUrl: string;
        try {
            absoluteUrl = new URL(href, pageUrl).toString();
        } catch {
            return; // Skip invalid URL
        }

        const normalized = normalizeUrl(absoluteUrl);
        if (normalized) {
            linkSet.add(normalized); // Add the normalized URL to the linkSet
        }
    });

    // Extract scripts from the page
    $("script[src]").each((_, el) => { // Find all <script> tags with src attributes
        const src = $(el).attr("src");
        if (!src) return; // Skip if no src attribute

        try {
            // Turn relative URL into absolute using the pageUrl as base.
            const absoluteUrl = new URL(src, pageUrl).toString();
            // Add the absolute URL to the assetSet.
            // We are not normalizing the URL here because scripts are typically not normalized.
            assetSet.add(absoluteUrl);
        } catch {
            return; // Skip invalid URL
        }
    });

    // Extract images from the page
    $("img[src]").each((_, el) => { // Find all <img> tags with src attributes
        const src = $(el).attr("src");
        if (!src) return; // Skip if no src attribute

        try {
            // Turn relative URL into absolute using the pageUrl as base.
            const absoluteUrl = new URL(src, pageUrl).toString();
            // Add the absolute URL to the assetSet.
            // We are not normalizing the URL here because images are typically not normalized.
            assetSet.add(absoluteUrl);
        } catch {
            return; // Skip invalid URL
        }
    });

    // Extract CSS links from the page
    $('link[rel="stylesheet"][href]').each((_, el) => { // Find all <link> tags with rel="stylesheet" and href attributes
        const href = $(el).attr("href");
        if (!href) return; // Skip if no href attribute

        try {
            // Turn relative URL into absolute using the pageUrl as base.
            const absoluteUrl = new URL(href, pageUrl).toString();
            // Add the absolute URL to the assetSet.
            // We are not normalizing the URL here because CSS links are typically not normalized.
            assetSet.add(absoluteUrl);
        } catch {
            return; // Skip invalid URL
        }
    });

    // Deterministic ordering
    const links = Array.from(linkSet).sort();
    const assets = Array.from(assetSet).sort();

    // Return the links and assets in a deterministic order
    return { links, assets };
}

/**
 * Crawl the website asynchronously using BFS starting from the given URL
 * @param startUrl - The URL to start crawling from
 * @param options - The options for the crawl
 * @returns A promise that resolves to the site map
 */
export async function crawl(startUrl: string, options: CrawlOptions = {}): Promise<SiteMap> {
    if (!startUrl) {
        throw new Error("startUrl is required");
    }

    // Get the maximum number of pages to crawl
    const maxPages = options.maxPages && options.maxPages > 0
        ? options.maxPages
        : DEFAULT_MAX_PAGES; // Use the default value if not provided

    // Normalize the start URL
    const normalizedStart = normalizeUrl(startUrl);
    if (!normalizedStart) {
        throw new Error(
            `Start URL must belong to domain ${ALLOWED_DOMAIN}, got: ${startUrl}`
        );
    }

    // Initialize the site map, visited set, and queue for BFS traversal
    const siteMap: SiteMap = {};
    const visited = new Set<string>();
    const queue: string[] = [];

    visited.add(normalizedStart);
    queue.push(normalizedStart);

    let pagesCrawled = 0;

    while (queue.length > 0 && pagesCrawled < maxPages) {
        // Dequeue the next URL to crawl
        const currentUrl = queue.shift()!; // This will not be undefined because we check queue.length > 0
        try {
            // Fetch the HTML of the current URL
            const res = await fetch(currentUrl, {
                headers: {
                    // Set a user agent to identify the crawler following good-web-citizen standards
                    "User-Agent": "FlintCrawler/1.0 (+https://flintk12.com)"
                }
            });

            // Get final normalized URL since fetch may redirect to a different URL
            const finalUrl = normalizeUrl(res.url);
            if (!finalUrl) {
                continue; // Skip if final URL is not within flintk12.com
            }

            const contentType = res.headers.get("content-type");
            if (!res.ok || !isHtmlResponse(contentType)) {
                // Skip non-HTML or error status pages
                continue;
            }

            // Extract the HTML of the current page
            const html = await res.text();
            // Extract the links and assets from the current page
            const { links, assets } = extractLinksAndAssets(finalUrl, html);
            // Add the current page to the site map with its links and assets
            siteMap[finalUrl] = {
                url: finalUrl,
                links,
                assets
            };

            // Enqueue unseen internal links in deterministic order
            for (const link of links) {
                if (!visited.has(link)) {
                    visited.add(link);
                    queue.push(link);
                }
            }

            pagesCrawled++;
        } catch (err) {
            // Network / parsing errors: log if needed and continue
            console.error(`Failed to crawl ${currentUrl}:`, err);
        }
    }

    return siteMap;
}