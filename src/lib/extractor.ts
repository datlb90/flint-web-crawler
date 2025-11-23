import * as cheerio from "cheerio";
import { normalizeUrl, resolveAbsoluteUrl } from "./urlUtils";

// Result of extracting links and assets from an HTML page
export type ExtractResult = {
    links: string[];
    assets: string[];
};

/**
 * Interface for extracting links and assets from HTML content.
 * This abstraction allows for different extraction implementations
 * (e.g., Cheerio, JSDOM, or custom parsers) without changing the crawler logic.
 */
export interface IExtractor {
    /**
     * Extract internal links and static assets from HTML content
     * @param pageUrl - The base URL of the page (for resolving relative URLs)
     * @param html - The HTML content to parse
     * @param allowedDomain - Optional allowed domain for link normalization (defaults to config)
     * @returns Links and assets discovered on the page
     */
    extract(pageUrl: string, html: string, allowedDomain?: string): ExtractResult;
}

/**
 * Cheerio-based implementation of the IExtractor interface.
 * Uses Cheerio for fast, server-side HTML parsing without executing JavaScript.
 */
export class CheerioExtractor implements IExtractor {
    extract(pageUrl: string, html: string, allowedDomain?: string): ExtractResult {
        // Parses the raw HTML string into a DOM-like structure
        // Allows us to use jQuery-style selectors to find elements
        const $ = cheerio.load(html);

        const linkSet = new Set<string>();
        const assetSet = new Set<string>();

        // Extract links from the page
        $("a[href]").each((_, el) => {
            const href = $(el).attr("href");
            if (!href) return;

            // Skip non-HTTP links
            if (
                href.startsWith("#") ||
                href.startsWith("mailto:") ||
                href.startsWith("tel:") ||
                href.startsWith("javascript:")
            ) {
                return;
            }

            const absoluteUrl = resolveAbsoluteUrl(href, pageUrl);
            if (!absoluteUrl) return;

            const normalized = normalizeUrl(absoluteUrl, allowedDomain);
            if (normalized) {
                linkSet.add(normalized);
            }
        });

        // Extract scripts from the page
        $("script[src]").each((_, el) => {
            const src = $(el).attr("src");
            if (!src) return;

            const absoluteUrl = resolveAbsoluteUrl(src, pageUrl);
            if (absoluteUrl) {
                // Scripts are not normalized to preserve query parameters and fragments
                assetSet.add(absoluteUrl);
            }
        });

        // Extract images from the page
        $("img[src]").each((_, el) => {
            const src = $(el).attr("src");
            if (!src) return;

            const absoluteUrl = resolveAbsoluteUrl(src, pageUrl);
            if (absoluteUrl) {
                // Images are not normalized to preserve query parameters and fragments
                assetSet.add(absoluteUrl);
            }
        });

        // Extract CSS links from the page
        $('link[rel="stylesheet"][href]').each((_, el) => {
            const href = $(el).attr("href");
            if (!href) return;

            const absoluteUrl = resolveAbsoluteUrl(href, pageUrl);
            if (absoluteUrl) {
                // CSS stylesheets are not normalized to preserve query parameters and fragments
                assetSet.add(absoluteUrl);
            }
        });

        // Return sorted arrays for deterministic output
        return {
            links: Array.from(linkSet).sort(),
            assets: Array.from(assetSet).sort(),
        };
    }
}

