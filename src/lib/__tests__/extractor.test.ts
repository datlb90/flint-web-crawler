/// <reference types="jest" />

import { CheerioExtractor } from "../extractor";
import { CRAWLER_CONFIG } from "../config";

describe("CheerioExtractor", () => {
  const extractor = new CheerioExtractor();
  const baseUrl = "https://www.flintk12.com/page";
  const defaultDomain = CRAWLER_CONFIG.ALLOWED_DOMAIN;

  describe("link extraction", () => {
    it("should extract internal links from <a> tags", () => {
      const html = `
        <html>
          <body>
            <a href="/about">About</a>
            <a href="/contact">Contact</a>
            <a href="https://www.flintk12.com/services">Services</a>
          </body>
        </html>
      `;

      const result = extractor.extract(baseUrl, html, defaultDomain);

      expect(result.links).toContain("https://www.flintk12.com/about");
      expect(result.links).toContain("https://www.flintk12.com/contact");
      expect(result.links).toContain("https://www.flintk12.com/services");
    });

    it("should skip anchor links", () => {
      const html = `
        <html>
          <body>
            <a href="#section">Section</a>
            <a href="/page">Page</a>
          </body>
        </html>
      `;

      const result = extractor.extract(baseUrl, html, defaultDomain);

      expect(result.links).not.toContain("#section");
      expect(result.links).toContain("https://www.flintk12.com/page");
    });

    it("should skip mailto links", () => {
      const html = `
        <html>
          <body>
            <a href="mailto:test@example.com">Email</a>
            <a href="/page">Page</a>
          </body>
        </html>
      `;

      const result = extractor.extract(baseUrl, html, defaultDomain);

      expect(result.links).not.toContain("mailto:test@example.com");
      expect(result.links).toContain("https://www.flintk12.com/page");
    });

    it("should skip tel links", () => {
      const html = `
        <html>
          <body>
            <a href="tel:+1234567890">Phone</a>
            <a href="/page">Page</a>
          </body>
        </html>
      `;

      const result = extractor.extract(baseUrl, html, defaultDomain);

      expect(result.links).not.toContain("tel:+1234567890");
      expect(result.links).toContain("https://www.flintk12.com/page");
    });

    it("should skip javascript links", () => {
      const html = `
        <html>
          <body>
            <a href="javascript:void(0)">Click</a>
            <a href="/page">Page</a>
          </body>
        </html>
      `;

      const result = extractor.extract(baseUrl, html, defaultDomain);

      expect(result.links).not.toContain("javascript:void(0)");
      expect(result.links).toContain("https://www.flintk12.com/page");
    });

    it("should filter links by domain", () => {
      const html = `
        <html>
          <body>
            <a href="/internal">Internal</a>
            <a href="https://external.com/page">External</a>
          </body>
        </html>
      `;

      const result = extractor.extract(baseUrl, html, defaultDomain);

      expect(result.links).toContain("https://www.flintk12.com/internal");
      expect(result.links).not.toContain("https://external.com/page");
    });

    it("should handle links without href attribute", () => {
      const html = `
        <html>
          <body>
            <a>No href</a>
            <a href="/page">With href</a>
          </body>
        </html>
      `;

      const result = extractor.extract(baseUrl, html, defaultDomain);

      expect(result.links).toContain("https://www.flintk12.com/page");
      expect(result.links.length).toBe(1);
    });

    it("should return sorted links", () => {
      const html = `
        <html>
          <body>
            <a href="/zebra">Zebra</a>
            <a href="/apple">Apple</a>
            <a href="/banana">Banana</a>
          </body>
        </html>
      `;

      const result = extractor.extract(baseUrl, html, defaultDomain);

      expect(result.links).toEqual([
        "https://www.flintk12.com/apple",
        "https://www.flintk12.com/banana",
        "https://www.flintk12.com/zebra",
      ]);
    });

    it("should deduplicate links", () => {
      const html = `
        <html>
          <body>
            <a href="/page">Link 1</a>
            <a href="/page">Link 2</a>
            <a href="/page">Link 3</a>
          </body>
        </html>
      `;

      const result = extractor.extract(baseUrl, html, defaultDomain);

      expect(result.links).toHaveLength(1);
      expect(result.links[0]).toBe("https://www.flintk12.com/page");
    });
  });

  describe("asset extraction", () => {
    it("should extract script sources", () => {
      const html = `
        <html>
          <body>
            <script src="/js/app.js"></script>
            <script src="https://www.flintk12.com/js/lib.js"></script>
          </body>
        </html>
      `;

      const result = extractor.extract(baseUrl, html, defaultDomain);

      expect(result.assets).toContain("https://www.flintk12.com/js/app.js");
      expect(result.assets).toContain("https://www.flintk12.com/js/lib.js");
    });

    it("should extract image sources", () => {
      const html = `
        <html>
          <body>
            <img src="/images/logo.png" alt="Logo">
            <img src="https://www.flintk12.com/images/banner.jpg" alt="Banner">
          </body>
        </html>
      `;

      const result = extractor.extract(baseUrl, html, defaultDomain);

      expect(result.assets).toContain("https://www.flintk12.com/images/logo.png");
      expect(result.assets).toContain("https://www.flintk12.com/images/banner.jpg");
    });

    it("should extract CSS stylesheets", () => {
      const html = `
        <html>
          <head>
            <link rel="stylesheet" href="/css/main.css">
            <link rel="stylesheet" href="https://www.flintk12.com/css/theme.css">
          </head>
        </html>
      `;

      const result = extractor.extract(baseUrl, html, defaultDomain);

      expect(result.assets).toContain("https://www.flintk12.com/css/main.css");
      expect(result.assets).toContain("https://www.flintk12.com/css/theme.css");
    });

    it("should not extract non-stylesheet links", () => {
      const html = `
        <html>
          <head>
            <link rel="icon" href="/favicon.ico">
            <link rel="stylesheet" href="/css/main.css">
          </head>
        </html>
      `;

      const result = extractor.extract(baseUrl, html, defaultDomain);

      expect(result.assets).not.toContain("https://www.flintk12.com/favicon.ico");
      expect(result.assets).toContain("https://www.flintk12.com/css/main.css");
    });

    it("should handle assets without src/href attributes", () => {
      const html = `
        <html>
          <body>
            <script></script>
            <img alt="No src">
            <link rel="stylesheet">
          </body>
        </html>
      `;

      const result = extractor.extract(baseUrl, html, defaultDomain);

      expect(result.assets).toHaveLength(0);
    });

    it("should return sorted assets", () => {
      const html = `
        <html>
          <body>
            <script src="/z.js"></script>
            <script src="/a.js"></script>
            <script src="/m.js"></script>
          </body>
        </html>
      `;

      const result = extractor.extract(baseUrl, html, defaultDomain);

      expect(result.assets).toEqual([
        "https://www.flintk12.com/a.js",
        "https://www.flintk12.com/m.js",
        "https://www.flintk12.com/z.js",
      ]);
    });

    it("should deduplicate assets", () => {
      const html = `
        <html>
          <body>
            <script src="/app.js"></script>
            <script src="/app.js"></script>
            <img src="/logo.png">
            <img src="/logo.png">
          </body>
        </html>
      `;

      const result = extractor.extract(baseUrl, html, defaultDomain);

      expect(result.assets).toHaveLength(2);
      expect(result.assets).toContain("https://www.flintk12.com/app.js");
      expect(result.assets).toContain("https://www.flintk12.com/logo.png");
    });

  });

  describe("edge cases", () => {
    it("should handle empty HTML", () => {
      const result = extractor.extract(baseUrl, "", defaultDomain);

      expect(result.links).toEqual([]);
      expect(result.assets).toEqual([]);
    });

    it("should handle HTML with no links or assets", () => {
      const html = "<html><body><p>Just text</p></body></html>";

      const result = extractor.extract(baseUrl, html, defaultDomain);

      expect(result.links).toEqual([]);
      expect(result.assets).toEqual([]);
    });

    it("should handle invalid URLs gracefully", () => {
      const html = `
        <html>
          <body>
            <a href="not a url">Invalid</a>
            <a href="/valid">Valid</a>
          </body>
        </html>
      `;

      const result = extractor.extract(baseUrl, html, defaultDomain);

      expect(result.links).toContain("https://www.flintk12.com/valid");
      expect(result.links).not.toContain("not a url");
    });

    it("should handle custom domain", () => {
      const html = `
        <html>
          <body>
            <a href="/page">Page</a>
            <a href="https://external.com/external">External</a>
          </body>
        </html>
      `;

      const result = extractor.extract("https://example.com/base", html, "example.com");

      expect(result.links).toContain("https://example.com/page");
      expect(result.links).not.toContain("https://external.com/external"); // External to example.com
    });
  });
});

