import { CRAWLER_CONFIG } from "./config";

/**
 * Check if a hostname belongs to the allowed domain or any of its subdomains
 * @param hostname - The hostname to check
 * @param allowedDomain - The allowed domain (defaults to CRAWLER_CONFIG.ALLOWED_DOMAIN)
 * @returns True if the hostname belongs to the allowed domain, false otherwise
 */
export function isAllowedDomain(
  hostname: string,
  allowedDomain: string = CRAWLER_CONFIG.ALLOWED_DOMAIN
): boolean {
  // Normalize the hostname by removing www.
  const host = hostname.toLowerCase().replace(/^www\./, "");
  // Check if the hostname is the allowed domain or a subdomain
  return host === allowedDomain || host.endsWith(`.${allowedDomain}`);
}

/**
 * Resolve a relative or absolute URL to an absolute URL using a base URL
 * @param href - The URL to resolve (can be relative or absolute)
 * @param baseUrl - The base URL to use for resolving relative URLs
 * @returns The absolute URL as a string, or null if the URL is invalid
 */
export function resolveAbsoluteUrl(href: string, baseUrl: string): string | null {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null; // Invalid URL
  }
}

/**
 * Normalize the URL to remove query parameters, fragments, and trailing slashes
 * Ensures the URL belongs to the allowed domain or any of its subdomains
 * @param rawUrl - The URL to normalize
 * @param allowedDomain - The allowed domain (defaults to CRAWLER_CONFIG.ALLOWED_DOMAIN)
 * @returns The normalized URL or null if it is not valid or not in the allowed domain
 */
export function normalizeUrl(
  rawUrl: string,
  allowedDomain: string = CRAWLER_CONFIG.ALLOWED_DOMAIN
): string | null {

  rawUrl = rawUrl.trim();

  let url: URL;

  try {
    // Parse the URL to get hostname, path, etc.
    // If rawUrl is relative, this will throw unless you supply a base.
    // All relative URLs should be converted to absolute URLs BEFORE they reach this function.
    url = new URL(rawUrl);
  } catch {
    return null; // Invalid URL
  }

  // Only accept http/https
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return null;
  }

  // Enforce allowed domain + subdomains
  if (!isAllowedDomain(url.hostname, allowedDomain)) {
    return null; // Skip external domain
  }

  // Remove query parameters and fragments
  url.search = "";
  url.hash = "";

  // Remove trailing slash unless it's the root
  if (url.pathname.endsWith("/") && url.pathname !== "/") {
    url.pathname = url.pathname.slice(0, -1);
  }

  return url.toString();
}

