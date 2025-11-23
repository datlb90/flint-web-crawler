/// <reference types="jest" />

import { crawl } from "../crawler";
import { DomainError, ValidationError } from "../errors";
import { IExtractor, ExtractResult } from "../extractor";
import { CRAWLER_CONFIG } from "../config";
import { normalizeUrl } from "../urlUtils";

// Replaces the global fetch with a Jest mock to avoid actual network requests
global.fetch = jest.fn();

// Mock extractor for testing
class MockExtractor implements IExtractor {
  // Uses a Map to store predefined results per URL.
  private mockResults: Map<string, ExtractResult> = new Map();
  // Pre-configures results for a URL.
  setResult(url: string, result: ExtractResult) {
    this.mockResults.set(url, result);
  }
  // Returns the predefined result for a URL, or an empty result if no result is found.
  extract(pageUrl: string, html: string, allowedDomain?: string): ExtractResult {
    return this.mockResults.get(pageUrl) || { links: [], assets: [] };
  }
}

/**
 * Create a mock fetch response for testing
 * @param url - The URL of the response
 * @param html - The HTML content of the response
 * @param options - lets us override ok, status, and content-type for different test scenarios
 * @returns A mock fetch response object with the given URL, HTML content, and options
 */
function createMockResponse(
  url: string,
  html: string,
  options: { ok?: boolean; status?: number; contentType?: string } = {}
) {
  return {
    url,
    ok: options.ok ?? true,
    status: options.status ?? 200,
    headers: new Headers({
      "content-type": options.contentType ?? "text/html",
    }),
    text: jest.fn().mockResolvedValue(html),
  };
}

describe("crawler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });

  describe("domain validation", () => {
    it("should throw DomainError for invalid domain", async () => {
      await expect(
        crawl("https://example.com", { allowedDomain: "flintk12.com" })
      ).rejects.toThrow(DomainError);
    });

    it("should accept valid domain", async () => {
      const mockExtractor = new MockExtractor();
      const baseUrl = "https://www.flintk12.com";
      const normalizedBaseUrl = normalizeUrl(baseUrl, "flintk12.com")!;
      mockExtractor.setResult(normalizedBaseUrl, { links: [], assets: [] });

      (global.fetch as jest.Mock).mockResolvedValue(
        createMockResponse(baseUrl, "<html></html>")
      );

      const result = await crawl(baseUrl, {
        extractor: mockExtractor,
        maxPages: 1,
      });

      expect(result).toBeDefined();
    });
  });

  describe("maxPages limit", () => {
    it("should respect maxPages limit", async () => {
      const mockExtractor = new MockExtractor();
      const domain = CRAWLER_CONFIG.ALLOWED_DOMAIN;
      const baseUrl = `https://www.${domain}`;
      const normalizedBaseUrl = normalizeUrl(baseUrl, domain)!;

      // Create a chain of pages
      mockExtractor.setResult(normalizedBaseUrl, {
        links: [`${baseUrl}/page1`, `${baseUrl}/page2`],
        assets: [],
      });
      mockExtractor.setResult(`${baseUrl}/page1`, {
        links: [`${baseUrl}/page3`],
        assets: [],
      });
      mockExtractor.setResult(`${baseUrl}/page2`, { links: [], assets: [] });
      mockExtractor.setResult(`${baseUrl}/page3`, { links: [], assets: [] });

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(createMockResponse(baseUrl, "<html></html>"))
        .mockResolvedValueOnce(createMockResponse(`${baseUrl}/page1`, "<html></html>"))
        .mockResolvedValueOnce(createMockResponse(`${baseUrl}/page2`, "<html></html>"));

      const result = await crawl(baseUrl, {
        extractor: mockExtractor,
        maxPages: 3,
      });

      expect(Object.keys(result).length).toBeLessThanOrEqual(3);
    });

    it("should use default maxPages if not provided", async () => {
      const mockExtractor = new MockExtractor();
      const domain = CRAWLER_CONFIG.ALLOWED_DOMAIN;
      const baseUrl = `https://www.${domain}`;
      const normalizedBaseUrl = normalizeUrl(baseUrl, domain)!;

      mockExtractor.setResult(normalizedBaseUrl, { links: [], assets: [] });

      (global.fetch as jest.Mock).mockResolvedValue(
        createMockResponse(baseUrl, "<html></html>")
      );

      const result = await crawl(baseUrl, {
        extractor: mockExtractor,
      });

      expect(result).toBeDefined();
    });

    it("should throw ValidationError for invalid maxPages", async () => {
      await expect(
        crawl("https://www.flintk12.com", { maxPages: -1 })
      ).rejects.toThrow(ValidationError);

      await expect(
        crawl("https://www.flintk12.com", { maxPages: 0 })
      ).rejects.toThrow(ValidationError);

      await expect(
        crawl("https://www.flintk12.com", { maxPages: NaN })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe("BFS traversal", () => {
    it("should crawl pages in BFS order", async () => {
      const mockExtractor = new MockExtractor();
      const domain = CRAWLER_CONFIG.ALLOWED_DOMAIN;
      const baseUrl = `https://www.${domain}`;
      const normalizedBaseUrl = normalizeUrl(baseUrl, domain)!;

      // Create a tree structure: root -> page1, page2 -> page3
      mockExtractor.setResult(normalizedBaseUrl, {
        links: [`${baseUrl}/page1`, `${baseUrl}/page2`],
        assets: [],
      });
      mockExtractor.setResult(`${baseUrl}/page1`, { links: [], assets: [] });
      mockExtractor.setResult(`${baseUrl}/page2`, {
        links: [`${baseUrl}/page3`],
        assets: [],
      });
      mockExtractor.setResult(`${baseUrl}/page3`, { links: [], assets: [] });

      // Tracks the order of fetch calls to verify BFS traversal
      const fetchOrder: string[] = [];
      // Mock the fetch function to track the order of calls and return the mock response
      // Every time the crawler calls fetch(url), fetchOrder.push(url) records that URL and returns a fake response
      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        fetchOrder.push(url);
        return Promise.resolve(createMockResponse(url, "<html></html>"));
      });

      await crawl(baseUrl, {
        extractor: mockExtractor,
        maxPages: 4,
      });

      // BFS order: root, then page1 and page2 (same level), then page3
      expect(fetchOrder[0]).toBe(normalizedBaseUrl);
      expect(fetchOrder.slice(1, 3)).toContain(`${baseUrl}/page1`);
      expect(fetchOrder.slice(1, 3)).toContain(`${baseUrl}/page2`);
      expect(fetchOrder[3]).toBe(`${baseUrl}/page3`);
    });

    it("should prevent revisiting pages", async () => {
      const mockExtractor = new MockExtractor();
      const domain = CRAWLER_CONFIG.ALLOWED_DOMAIN;
      const baseUrl = `https://www.${domain}`;
      const normalizedBaseUrl = normalizeUrl(baseUrl, domain)!;

      // Create a cycle: root -> page1 -> root
      mockExtractor.setResult(normalizedBaseUrl, {
        links: [`${baseUrl}/page1`],
        assets: [],
      });
      mockExtractor.setResult(`${baseUrl}/page1`, {
        links: [normalizedBaseUrl], // Cycle back to root (use normalized URL)
        assets: [],
      });

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(createMockResponse(baseUrl, "<html></html>"))
        .mockResolvedValueOnce(createMockResponse(`${baseUrl}/page1`, "<html></html>"));

      const result = await crawl(baseUrl, {
        extractor: mockExtractor,
        maxPages: 10,
      });

      // Should only crawl each page once
      expect(Object.keys(result).length).toBe(2);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("error handling", () => {

    it("should skip non-HTML content", async () => {
      const mockExtractor = new MockExtractor();
      const domain = CRAWLER_CONFIG.ALLOWED_DOMAIN;
      const baseUrl = `https://www.${domain}`;
      const normalizedBaseUrl = normalizeUrl(baseUrl, domain)!;

      mockExtractor.setResult(normalizedBaseUrl, {
        links: [`${baseUrl}/page1`, `${baseUrl}/pdf`],
        assets: [],
      });
      mockExtractor.setResult(`${baseUrl}/page1`, { links: [], assets: [] });

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(createMockResponse(baseUrl, "<html></html>"))
        .mockResolvedValueOnce(
          createMockResponse(`${baseUrl}/page1`, "<html></html>")
        )
        .mockResolvedValueOnce(
          createMockResponse(`${baseUrl}/pdf`, "PDF content", {
            contentType: "application/pdf",
          })
        );

      const result = await crawl(baseUrl, {
        extractor: mockExtractor,
        maxPages: 10,
      });

      // Should not include PDF in results
      expect(result[`${baseUrl}/pdf`]).toBeUndefined();
      expect(result[`${baseUrl}/page1`]).toBeDefined();
    });

    it("should skip HTTP error responses", async () => {
      const mockExtractor = new MockExtractor();
      const domain = CRAWLER_CONFIG.ALLOWED_DOMAIN;
      const baseUrl = `https://www.${domain}`;
      const normalizedBaseUrl = normalizeUrl(baseUrl, domain)!;

      mockExtractor.setResult(normalizedBaseUrl, {
        links: [`${baseUrl}/page1`, `${baseUrl}/error`],
        assets: [],
      });
      mockExtractor.setResult(`${baseUrl}/page1`, { links: [], assets: [] });

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(createMockResponse(baseUrl, "<html></html>"))
        .mockResolvedValueOnce(
          createMockResponse(`${baseUrl}/page1`, "<html></html>")
        )
        .mockResolvedValueOnce(
          createMockResponse(`${baseUrl}/error`, "<html></html>", {
            ok: false,
            status: 404,
          })
        );

      const result = await crawl(baseUrl, {
        extractor: mockExtractor,
        maxPages: 10,
      });

      // Should not include error page in results
      expect(result[`${baseUrl}/error`]).toBeUndefined();
      expect(result[`${baseUrl}/page1`]).toBeDefined();
    });

    it("should skip redirects to external domains", async () => {
      const mockExtractor = new MockExtractor();
      const domain = CRAWLER_CONFIG.ALLOWED_DOMAIN;
      const baseUrl = `https://www.${domain}`;
      const normalizedBaseUrl = normalizeUrl(baseUrl, domain)!;

      mockExtractor.setResult(normalizedBaseUrl, {
        links: [`${baseUrl}/redirect`],
        assets: [],
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce(
        createMockResponse(baseUrl, "<html></html>")
      );
      // Redirect to external domain
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        createMockResponse("https://external.com", "<html></html>")
      );

      const result = await crawl(baseUrl, {
        extractor: mockExtractor,
        maxPages: 10,
      });

      // Should not include external redirect in results
      expect(result["https://external.com"]).toBeUndefined();
    });
  });

});

