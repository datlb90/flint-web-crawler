// Bundle this component for the browser, allow hooks and interactivity
"use client";

import React, { useState } from "react";

import type {
  CrawlSuccessResponse,
  CrawlResponse,
} from "@/lib/crawlTypes";
import { CRAWLER_CONFIG } from "@/lib/config";

export default function HomePage() {
  // These useState calls are how we store form values, loading state, errors, and API results in a React component
  // When we call the setSomething functions, React re-renders the component with the new values, and the UI updates on screen
  const [url, setUrl] = useState("https://www.flintk12.com");
  const [maxPages, setMaxPages] = useState("10");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<CrawlSuccessResponse | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMessage(null);
    setResult(null);

    try {
      const body: { url: string; maxPages?: number } = { url: url.trim() };
      const parsedMaxPages = Number(maxPages);
      if (!Number.isNaN(parsedMaxPages) && parsedMaxPages > 0) {
        body.maxPages = parsedMaxPages;
      }

      const res = await fetch("/api/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = (await res.json()) as CrawlResponse;
      if (!res.ok || "error" in data) {
        throw new Error(
          "error" in data ? data.error : `Request failed with status ${res.status}`
        );
      }

      setResult(data);
      setStatus("success");
    } catch (err) {
      let message = "Something went wrong.";

      if (err instanceof Error) {
        message = err.message;
      } else if (typeof err === "string") {
        message = err;
      }

      setErrorMessage(message);
      setStatus("error");
    }
  }
  const isLoading = status === "loading";

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Flint Web Crawler
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Crawl pages inside <code>flintk12.com</code>, discover links, and inspect static assets.
          </p>
        </header>

        {/* This is the form section that contains the form for the user to input the starting URL and max pages */}
        <section className="mb-8 rounded-lg bg-white p-4 shadow-sm">
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-4 md:flex-row md:items-end"
          >
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Starting URL
              </label>
              <input
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="https://www.flintk12.com/..."
              />
            </div>

            <div className="w-full md:w-40">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Max pages
              </label>
              <input
                type="number"
                min={1}
                max={CRAWLER_CONFIG.MAX_PAGES_HARD_LIMIT}
                value={maxPages}
                onChange={(e) => setMaxPages(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="e.g. 10"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !url.trim()}
              className={`inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-white shadow-sm ${isLoading || !url.trim()
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700"
                }`}
            >
              {isLoading ? "Crawling..." : "Crawl"}
            </button>
          </form>

          {/* This is the status and error section that displays the status and error messages */}
          <div className="mt-3 text-sm">
            {(status === "idle" || status === "success") && (
              <p className="text-gray-500">
                Starting URL must be within <code>{CRAWLER_CONFIG.ALLOWED_DOMAIN}</code> (subdomains allowed). Max pages is capped at {CRAWLER_CONFIG.MAX_PAGES_HARD_LIMIT} to keep crawls safe and predictable.
              </p>
            )}
            {status === "loading" && (
              <p className="text-blue-600">Crawling in progress…</p>
            )}
            {status === "error" && errorMessage && (
              <p className="text-red-600">Error: {errorMessage}</p>
            )}
          </div>
        </section>

        {/* This is the results section that displays the summary and site map */}
        {result && (
          <section className="space-y-4">
            {/* This is the summary section that displays the pages crawled, elapsed time, and unique URLs */}
            <div className="rounded-lg bg-white p-4 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">Summary</h2>
              <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-700">
                <div>
                  <span className="font-medium">Pages crawled:</span>{" "}
                  {result.stats.pagesCrawled}
                </div>
                <div>
                  <span className="font-medium">Elapsed time:</span>{" "}
                  {result.stats.elapsedMs} ms
                </div>
                <div>
                  <span className="font-medium">Unique URLs:</span>{" "}
                  {Object.keys(result.siteMap).length}
                </div>
              </div>
            </div>

            {/* This is the site map section that displays the pages and their links and assets */}
            <div className="rounded-lg bg-white p-4 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">
                Site Map ({Object.keys(result.siteMap).length} pages)
              </h2>
              <p className="mt-1 text-xs text-gray-500">
                Click a page to view its outbound links and assets.
              </p>

              <div className="mt-3 max-h-[480px] space-y-2 overflow-auto pr-1">
                {/* This is the loop that displays the pages and their links and assets */}
                {Object.values(result.siteMap).map((page) => (
                  <details
                    key={page.url}
                    className="rounded-md border border-gray-200 bg-gray-50 p-3"
                  >
                    <summary className="cursor-pointer text-sm font-medium text-blue-700">
                      {page.url}
                    </summary>

                    <div className="mt-2 grid gap-4 md:grid-cols-2">
                      <div>
                        <h3 className="text-xs font-semibold uppercase text-gray-500">
                          Internal Links ({page.links.length})
                        </h3>
                        {page.links.length === 0 ? (
                          <p className="mt-1 text-xs text-gray-400">
                            No internal links discovered.
                          </p>
                        ) : (
                          <ul className="mt-1 space-y-1 text-xs text-gray-700">
                            {page.links.map((link, idx) => (
                              <li key={idx} className="break-all">
                                {link}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <div>
                        <h3 className="text-xs font-semibold uppercase text-gray-500">
                          Assets ({page.assets.length})
                        </h3>
                        {page.assets.length === 0 ? (
                          <p className="mt-1 text-xs text-gray-400">
                            No assets discovered.
                          </p>
                        ) : (
                          <ul className="mt-1 space-y-1 text-xs text-gray-700">
                            {page.assets.map((asset, idx) => (
                              <li key={idx} className="break-all">
                                {asset}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </details>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
