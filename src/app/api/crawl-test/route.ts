import { NextResponse } from "next/server";
import { crawl } from "@/lib/crawler";

// Ensure we run on the Node.js runtime (not Edge)
export const runtime = "nodejs";

/**
 * GET /api/crawl-test
 * Test the crawl function
 * @returns A JSON response containing the site map
 */
export async function GET() {
    try {
        const siteMap = await crawl("https://flintk12.com", { maxPages: 5 });
        return NextResponse.json(siteMap, { status: 200 });
    } catch (err) {
        console.error("Crawl failed:", err);
        return NextResponse.json(
            { error: "Crawl failed", details: String(err) },
            { status: 500 }
        );
    }
}