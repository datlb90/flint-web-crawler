import type { SiteMap } from "./crawler";

export type CrawlStats = {
    pagesCrawled: number;
    elapsedMs: number;
};

export type CrawlSuccessResponse = {
    siteMap: SiteMap;
    stats: CrawlStats;
};

export type CrawlErrorResponse = {
    error: string;
};

export type CrawlResponse = CrawlSuccessResponse | CrawlErrorResponse;