import * as cheerio from "cheerio";
import { CRAWLER_CONFIG } from "./config";
import { normalizeUrl, resolveAbsoluteUrl } from "./urlUtils";
import { DomainError, ValidationError } from "./errors";

// A PageNode represents a single web page
export type PageNode = {
    url: string;
    links: string[];
    assets: string[];
};

export type SiteMap = Record<string, PageNode>;

export type CrawlOptions = {
    maxPages?: number;
}

// The result of extracting links and assets from an HTML page
type ExtractResult = {
    links: string[];
    assets: string[];
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
 * Resolve maxPages from options:
 * - Use CRAWLER_CONFIG.DEFAULT_MAX_PAGES if undefined
 * - Throw on invalid values (<= 0, NaN, etc.)
 * - Clamp to CRAWLER_CONFIG.MAX_PAGES_HARD_LIMIT for safety
 */
function resolveMaxPages(options: CrawlOptions): number {
    const { maxPages } = options;

    if (maxPages === undefined) {
        return CRAWLER_CONFIG.DEFAULT_MAX_PAGES;
    }

    if (!Number.isFinite(maxPages) || maxPages <= 0) {
        throw new ValidationError(
            `Max pages must be a positive number, got ${maxPages}`,
            "maxPages"
        );
    }

    // Clamp the max pages to the hard limit to avoid runaway crawls
    return Math.min(maxPages, CRAWLER_CONFIG.MAX_PAGES_HARD_LIMIT);
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
    $("a[href]").each((_, el) => {
        const href = $(el).attr("href");
        if (!href) return;

        if (
            href.startsWith("#") || // Skip anchors
            href.startsWith("mailto:") || // Skip mailto links
            href.startsWith("tel:") || // Skip tel links
            href.startsWith("javascript:") // Skip javascript links
        ) {
            return;
        }

        const absoluteUrl = resolveAbsoluteUrl(href, pageUrl);
        if (!absoluteUrl) {
            return; // Skip invalid URL
        }

        const normalized = normalizeUrl(absoluteUrl);
        if (normalized) {
            linkSet.add(normalized);
        }
    });

    // Extract scripts from the page
    $("script[src]").each((_, el) => {
        const src = $(el).attr("src");
        if (!src) return;

        const absoluteUrl = resolveAbsoluteUrl(src, pageUrl);
        if (!absoluteUrl) {
            return; // Skip invalid URL
        }
        // We are not normalizing the URL here because scripts are typically not normalized.
        assetSet.add(absoluteUrl);
    });

    // Extract images from the page
    $("img[src]").each((_, el) => {
        const src = $(el).attr("src");
        if (!src) return;

        const absoluteUrl = resolveAbsoluteUrl(src, pageUrl);
        if (!absoluteUrl) {
            return; // Skip invalid URL
        }
        // We are not normalizing the URL here because images are typically not normalized.
        assetSet.add(absoluteUrl);
    });

    // Extract CSS links from the page
    $('link[rel="stylesheet"][href]').each((_, el) => {
        const href = $(el).attr("href");
        if (!href) return;

        const absoluteUrl = resolveAbsoluteUrl(href, pageUrl);
        if (!absoluteUrl) {
            return; // Skip invalid URL
        }
        // We are not normalizing the URL here because CSS links are typically not normalized.
        assetSet.add(absoluteUrl);
    });

    // Make sure the links and assets are in a deterministic order
    const links = Array.from(linkSet).sort();
    const assets = Array.from(assetSet).sort();

    return { links, assets };
}

/**
 * Crawl the website asynchronously using BFS starting from the given URL
 * @param startUrl - The URL to start crawling from
 * @param options - The options for the crawl
 * @returns A promise that resolves to the site map
 */
export async function crawl(startUrl: string, options: CrawlOptions = {}): Promise<SiteMap> {
    // Normalize the start URL and throw if it is invalid or out-of-domain
    const normalizedStart = normalizeUrl(startUrl);
    if (!normalizedStart) {
        throw new DomainError(
            `Starting URL must belong to domain ${CRAWLER_CONFIG.ALLOWED_DOMAIN}`,
            startUrl
        );
    }
    const maxPages = resolveMaxPages(options);

    const siteMap: SiteMap = {};
    const visited = new Set<string>();
    const queue: string[] = [];

    visited.add(normalizedStart);
    queue.push(normalizedStart);

    let pagesCrawled = 0;

    while (queue.length > 0 && pagesCrawled < maxPages) {
        // This will not be undefined because we check queue.length > 0
        const currentUrl = queue.shift()!;
        try {
            const res = await fetch(currentUrl, {
                headers: {
                    // Set a user agent to identify the crawler following good-web-citizen standards
                    "User-Agent": CRAWLER_CONFIG.USER_AGENT
                }
            });

            // Get final normalized URL since fetch may redirect to a different URL
            const finalUrl = normalizeUrl(res.url);
            if (!finalUrl) {
                continue; // Skip if final URL is not within the allowed domain
            }

            // Make sure the final URL is also treated as visited
            if (!visited.has(finalUrl)) {
                visited.add(finalUrl);
            }

            const contentType = res.headers.get("content-type");
            if (!res.ok || !isHtmlResponse(contentType)) {
                // Skip non-HTML or error status pages
                continue;
            }

            const html = await res.text();
            const { links, assets } = extractLinksAndAssets(finalUrl, html);
            siteMap[finalUrl] = {
                url: finalUrl,
                links,
                assets
            };

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