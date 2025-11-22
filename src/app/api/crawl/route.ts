import { NextResponse } from "next/server";
import { crawl } from "@/lib/crawler";

// The request body for the crawl API
type CrawlRequestBody = {
    url?: string; // Making this optional is a reminder that this is untrusted input
    maxPages?: number; // The maximum number of pages to crawl, if not provided, the default value will be used
};

/**
 * POST /api/crawl
 * Crawl the website starting from the given URL
 * @param request - The request body containing the URL and max pages
 * @returns A JSON response containing the site map
 */
export async function POST(request: Request) {
    // Get the start time of the crawl
    const startedAt = Date.now();

    // Get the request body
    let body: CrawlRequestBody;

    try {
        // Try to parse the request body as JSON
        body = await request.json();
    } catch {
        // If the request body is not valid JSON, return a 400 error
        return NextResponse.json(
            { error: "Invalid JSON body." },
            { status: 400 }
        );
    }

    // Destructure URL and maxPages from the request body.
    // If body is null/undefined, fall back to an empty object.
    const { url, maxPages } = body ?? {};

    // Minimal shape validation (type/required checks)
    // If the URL is not a string or is an empty string, return a 400 error 
    if (typeof url !== "string" || url.trim().length === 0) {
        // Return a 400 error with a message
        return NextResponse.json(
            { error: 'Field "url" is required and must be a non-empty string.' },
            { status: 400 }
        );
    }

    // If the max pages is provided and is not a number, return a 400 error
    if (maxPages !== undefined && typeof maxPages !== "number") {
        // Return a 400 error with a message
        return NextResponse.json(
            { error: '"maxPages" must be a number if provided.' },
            { status: 400 }
        );
    }

    try {
        // Let the crawler own the real validation (domain + maxPages rules)
        const siteMap = await crawl(url, { maxPages });

        const elapsedMs = Date.now() - startedAt;
        const pagesCrawled = Object.keys(siteMap).length;

        return NextResponse.json(
            {
                siteMap,
                stats: {
                    pagesCrawled,
                    elapsedMs
                }
            },
            { status: 200 }
        );

    } catch (err) {
        // Handle errors and map them to user-friendly messages
        let message = "Unknown error";
        // If the error is an instance of Error, set the message to the error message
        if (err instanceof Error) {
            message = err.message;
        } else if (typeof err === "string") {
            message = err;
        }

        // Map known "bad input" errors to 400
        const isInputError =
            message.includes("Start URL must belong to domain") ||
            message.includes("Max pages must be a positive number");

        if (isInputError) {
            return NextResponse.json(
                { error: message },
                { status: 400 }
            );
        }

        console.error("Crawl failed:", message, err);

        return NextResponse.json(
            {
                error: "Unexpected error while crawling. Please try again later or with a different URL."
            },
            { status: 500 }
        );
    }
}