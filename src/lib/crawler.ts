import { CRAWLER_CONFIG } from "./config";
import { normalizeUrl } from "./urlUtils";
import { DomainError, ValidationError } from "./errors";
import { IExtractor, CheerioExtractor } from "./extractor";

// A PageNode represents a single web page
export type PageNode = {
    url: string;
    links: string[];
    assets: string[];
};

export type SiteMap = Record<string, PageNode>;

export type CrawlOptions = {
    maxPages?: number;
    extractor?: IExtractor; // Optional custom extractor (defaults to CheerioExtractor)
    allowedDomain?: string; // Optional allowed domain (defaults to CRAWLER_CONFIG.ALLOWED_DOMAIN)
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
 * Crawl the website asynchronously using BFS starting from the given URL
 * @param startUrl - The URL to start crawling from
 * @param options - The options for the crawl
 * @returns A promise that resolves to the site map
 */
export async function crawl(startUrl: string, options: CrawlOptions = {}): Promise<SiteMap> {
    // Resolve the allowed domain from options or default to config
    const allowedDomain = options.allowedDomain ?? CRAWLER_CONFIG.ALLOWED_DOMAIN;

    const normalizedStart = normalizeUrl(startUrl, allowedDomain);
    if (!normalizedStart) {
        throw new DomainError(
            `Starting URL must belong to domain ${allowedDomain}`,
            startUrl
        );
    }

    const maxPages = resolveMaxPages(options);
    const extractor = options.extractor ?? new CheerioExtractor();

    const siteMap: SiteMap = {};
    const visited = new Set<string>();
    const queue: string[] = [];

    visited.add(normalizedStart);
    queue.push(normalizedStart);

    let pagesCrawled = 0;

    while (queue.length > 0 && pagesCrawled < maxPages) {
        const currentUrl = queue.shift()!;
        try {
            const res = await fetch(currentUrl, {
                headers: {
                    "User-Agent": CRAWLER_CONFIG.USER_AGENT
                }
            });

            const finalUrl = normalizeUrl(res.url, allowedDomain);
            if (!finalUrl) {
                continue;
            }

            if (!visited.has(finalUrl)) {
                visited.add(finalUrl);
            }

            const contentType = res.headers.get("content-type");
            if (!res.ok || !isHtmlResponse(contentType)) {
                continue;
            }

            const html = await res.text();
            const { links, assets } = extractor.extract(finalUrl, html, allowedDomain);
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
            console.error(`Failed to crawl ${currentUrl}:`, err);
        }
    }

    return siteMap;
}