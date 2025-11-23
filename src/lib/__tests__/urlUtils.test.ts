/// <reference types="jest" />

import { isAllowedDomain, normalizeUrl, resolveAbsoluteUrl } from "../urlUtils";
import { CRAWLER_CONFIG } from "../config";

describe("urlUtils", () => {
    describe("isAllowedDomain", () => {
        const defaultDomain = CRAWLER_CONFIG.ALLOWED_DOMAIN;

        it("should return true for exact domain match", () => {
            expect(isAllowedDomain("flintk12.com", defaultDomain)).toBe(true);
        });

        it("should return true for exact domain match (case insensitive)", () => {
            expect(isAllowedDomain("FLINTK12.COM", defaultDomain)).toBe(true);
            expect(isAllowedDomain("FlintK12.Com", defaultDomain)).toBe(true);
        });

        it("should return true for subdomain", () => {
            expect(isAllowedDomain("www.flintk12.com", defaultDomain)).toBe(true);
            expect(isAllowedDomain("blog.flintk12.com", defaultDomain)).toBe(true);
            expect(isAllowedDomain("sub.domain.flintk12.com", defaultDomain)).toBe(true);
        });

        it("should normalize www. prefix", () => {
            expect(isAllowedDomain("www.flintk12.com", defaultDomain)).toBe(true);
            expect(isAllowedDomain("WWW.flintk12.com", defaultDomain)).toBe(true);
        });

        it("should return false for different domain", () => {
            expect(isAllowedDomain("example.com", defaultDomain)).toBe(false);
            expect(isAllowedDomain("google.com", defaultDomain)).toBe(false);
        });

        it("should return false for domain that ends with but is not subdomain", () => {
            expect(isAllowedDomain("notflintk12.com", defaultDomain)).toBe(false);
            expect(isAllowedDomain("fakeflintk12.com", defaultDomain)).toBe(false);
        });

        it("should return false for empty hostname", () => {
            expect(isAllowedDomain("", defaultDomain)).toBe(false);
        });

        it("should work with custom domain", () => {
            expect(isAllowedDomain("example.com", "example.com")).toBe(true);
            expect(isAllowedDomain("www.example.com", "example.com")).toBe(true);
            expect(isAllowedDomain("sub.example.com", "example.com")).toBe(true);
            expect(isAllowedDomain("other.com", "example.com")).toBe(false);
        });
    });

    describe("resolveAbsoluteUrl", () => {
        const baseUrl = "https://www.flintk12.com/page";

        it("should resolve relative URLs", () => {
            expect(resolveAbsoluteUrl("/about", baseUrl)).toBe("https://www.flintk12.com/about");
            expect(resolveAbsoluteUrl("contact", baseUrl)).toBe("https://www.flintk12.com/contact");
            expect(resolveAbsoluteUrl("../parent", baseUrl)).toBe("https://www.flintk12.com/parent");
        });

        it("should return absolute URLs as-is", () => {
            const absoluteUrl = "https://www.flintk12.com/absolute";
            expect(resolveAbsoluteUrl(absoluteUrl, baseUrl)).toBe(absoluteUrl);
        });

        it("should handle different base URL protocols", () => {
            expect(resolveAbsoluteUrl("/path", "http://example.com")).toBe("http://example.com/path");
            expect(resolveAbsoluteUrl("/path", "https://example.com")).toBe("https://example.com/path");
        });

        it("should return null for invalid URLs", () => {
            expect(resolveAbsoluteUrl("not a url", baseUrl)).toBeNull();
            expect(resolveAbsoluteUrl("://invalid", baseUrl)).toBeNull();
        });

        it("should handle relative URLs with query parameters", () => {
            expect(resolveAbsoluteUrl("/page?foo=bar", baseUrl)).toBe("https://www.flintk12.com/page?foo=bar");
        });

        it("should handle relative URLs with fragments", () => {
            expect(resolveAbsoluteUrl("/page#section", baseUrl)).toBe("https://www.flintk12.com/page#section");
        });
    });

    describe("normalizeUrl", () => {
        const defaultDomain = CRAWLER_CONFIG.ALLOWED_DOMAIN;

        it("should normalize valid URLs", () => {
            expect(normalizeUrl("https://www.flintk12.com/page", defaultDomain)).toBe("https://www.flintk12.com/page");
            expect(normalizeUrl("http://flintk12.com/page", defaultDomain)).toBe("http://flintk12.com/page");
        });

        it("should remove query parameters", () => {
            expect(normalizeUrl("https://www.flintk12.com/page?foo=bar&baz=qux", defaultDomain)).toBe(
                "https://www.flintk12.com/page"
            );
        });

        it("should remove fragments", () => {
            expect(normalizeUrl("https://www.flintk12.com/page#section", defaultDomain)).toBe(
                "https://www.flintk12.com/page"
            );
        });

        it("should remove both query parameters and fragments", () => {
            expect(normalizeUrl("https://www.flintk12.com/page?foo=bar#section", defaultDomain)).toBe(
                "https://www.flintk12.com/page"
            );
        });

        it("should remove trailing slash except for root", () => {
            expect(normalizeUrl("https://www.flintk12.com/page/", defaultDomain)).toBe("https://www.flintk12.com/page");
            expect(normalizeUrl("https://www.flintk12.com/", defaultDomain)).toBe("https://www.flintk12.com/");
        });

        it("should trim whitespace", () => {
            expect(normalizeUrl("  https://www.flintk12.com/page  ", defaultDomain)).toBe(
                "https://www.flintk12.com/page"
            );
        });

        it("should return null for invalid URLs", () => {
            expect(normalizeUrl("not a url", defaultDomain)).toBeNull();
            expect(normalizeUrl("://invalid", defaultDomain)).toBeNull();
        });

        it("should return null for non-HTTP protocols", () => {
            expect(normalizeUrl("ftp://flintk12.com/file", defaultDomain)).toBeNull();
            expect(normalizeUrl("file:///path/to/file", defaultDomain)).toBeNull();
            expect(normalizeUrl("mailto:test@flintk12.com", defaultDomain)).toBeNull();
        });

        it("should return null for external domains", () => {
            expect(normalizeUrl("https://example.com/page", defaultDomain)).toBeNull();
            expect(normalizeUrl("https://google.com", defaultDomain)).toBeNull();
        });

        it("should accept subdomains of allowed domain", () => {
            expect(normalizeUrl("https://www.flintk12.com/page", defaultDomain)).toBe("https://www.flintk12.com/page");
            expect(normalizeUrl("https://blog.flintk12.com/page", defaultDomain)).toBe("https://blog.flintk12.com/page");
        });

        it("should work with custom domain", () => {
            expect(normalizeUrl("https://example.com/page", "example.com")).toBe("https://example.com/page");
            expect(normalizeUrl("https://www.example.com/page", "example.com")).toBe("https://www.example.com/page");
            expect(normalizeUrl("https://other.com/page", "example.com")).toBeNull();
        });

        it("should preserve port numbers", () => {
            expect(normalizeUrl("https://www.flintk12.com:8080/page", defaultDomain)).toBe(
                "https://www.flintk12.com:8080/page"
            );
        });

        it("should handle URLs with paths, query, and fragment", () => {
            const result = normalizeUrl(
                "https://www.flintk12.com/path/to/page?param=value#anchor",
                defaultDomain
            );
            expect(result).toBe("https://www.flintk12.com/path/to/page");
        });

        it("should handle case-insensitive domain matching", () => {
            expect(normalizeUrl("https://WWW.FLINTK12.COM/page", defaultDomain)).toBe("https://www.flintk12.com/page");
        });
    });
});

