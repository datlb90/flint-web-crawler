import { NextResponse } from "next/server";
import { crawl } from "@/lib/crawler";
import { DomainError, ValidationError } from "@/lib/errors";
import type {
    CrawlSuccessResponse,
    CrawlErrorResponse,
} from "@/lib/crawlTypes";

// The request body for the crawl API
type CrawlRequestBody = {
    url?: string; // Making this optional is a reminder that this is untrusted input
    maxPages?: number; // The maximum number of pages to crawl, if not provided, the default value will be used
    allowedDomain?: string; // Optional allowed domain (defaults to config)
};

/**
 * POST /api/crawl
 * Crawl the website starting from the given URL
 * @param request - The request body containing the URL and max pages
 * @returns A JSON response containing the site map
 */
export async function POST(request: Request) {
    const startedAt = Date.now();

    let body: CrawlRequestBody;

    try {
        body = await request.json();
    } catch {
        return NextResponse.json(
            { error: "Invalid JSON body." },
            { status: 400 }
        );
    }

    const { url, maxPages, allowedDomain } = body ?? {};

    if (typeof url !== "string" || url.trim().length === 0) {
        return NextResponse.json(
            { error: 'Field "url" is required and must be a non-empty string.' },
            { status: 400 }
        );
    }

    if (maxPages !== undefined && typeof maxPages !== "number") {
        return NextResponse.json(
            { error: '"maxPages" must be a number if provided.' },
            { status: 400 }
        );
    }

    if (allowedDomain !== undefined && typeof allowedDomain !== "string") {
        return NextResponse.json(
            { error: '"allowedDomain" must be a string if provided.' },
            { status: 400 }
        );
    }

    try {
        // Let the crawler own the real validation (domain + maxPages rules)
        const siteMap = await crawl(url, { maxPages, allowedDomain });
        const elapsedMs = Date.now() - startedAt;
        const pagesCrawled = Object.keys(siteMap).length;

        const successPayload: CrawlSuccessResponse = {
            siteMap,
            stats: { pagesCrawled, elapsedMs },
        };

        return NextResponse.json<CrawlSuccessResponse>(successPayload, { status: 200 });

    } catch (err) {
        // Handle domain and validation errors as 400 Bad Request
        if (err instanceof DomainError || err instanceof ValidationError) {
            return NextResponse.json(
                { error: err.message },
                { status: 400 }
            );
        }

        // Handle unexpected errors as 500 Internal Server Error
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error("Crawl failed:", message, err);

        const errorPayload: CrawlErrorResponse = {
            error: "Unexpected error while crawling. Please try again later or with a different URL.",
        };

        return NextResponse.json<CrawlErrorResponse>(errorPayload, { status: 500 });
    }
}