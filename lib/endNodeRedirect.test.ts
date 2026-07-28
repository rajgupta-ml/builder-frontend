import { describe, expect, test } from "bun:test";
import { screenerStatusForOutcome, buildEndNodeScreenerRedirect, updateScreenerRedirectStatus } from "./endNodeRedirect";

describe("screenerStatusForOutcome", () => {
    test("completed / empty / undefined -> complete", () => {
        expect(screenerStatusForOutcome("completed")).toBe("complete");
        expect(screenerStatusForOutcome("")).toBe("complete");
        expect(screenerStatusForOutcome(undefined)).toBe("complete");
    });

    test("quality_terminate -> quality_terminate", () => {
        expect(screenerStatusForOutcome("quality_terminate")).toBe("quality_terminate");
    });

    test("disqualified / security_terminate / unknown -> terminated", () => {
        expect(screenerStatusForOutcome("disqualified")).toBe("terminated");
        expect(screenerStatusForOutcome("security_terminate")).toBe("terminated");
        expect(screenerStatusForOutcome("whatever")).toBe("terminated");
    });
});

describe("buildEndNodeScreenerRedirect", () => {
    test("builds the callback url for the outcome with a transactionid placeholder", () => {
        expect(buildEndNodeScreenerRedirect("completed", "http://localhost:8787")).toBe(
            "http://localhost:8787/screener/callback?transactionid=[transactionid]&status=complete"
        );
        expect(buildEndNodeScreenerRedirect("disqualified", "http://localhost:8787")).toBe(
            "http://localhost:8787/screener/callback?transactionid=[transactionid]&status=terminated"
        );
    });

    test("strips a trailing slash from the base url", () => {
        expect(buildEndNodeScreenerRedirect("completed", "http://localhost:8787/")).toBe(
            "http://localhost:8787/screener/callback?transactionid=[transactionid]&status=complete"
        );
    });
});

describe("updateScreenerRedirectStatus", () => {
    test("swaps only the status on a screener callback URL, preserving base and transactionid", () => {
        const url = "http://localhost:8787/screener/callback?transactionid=[transactionid]&status=complete";
        expect(updateScreenerRedirectStatus(url, "security_terminate")).toBe(
            "http://localhost:8787/screener/callback?transactionid=[transactionid]&status=terminated"
        );
    });

    test("preserves a custom/production base url", () => {
        const url = "https://screener.example.com/screener/callback?transactionid=[transactionid]&status=complete";
        expect(updateScreenerRedirectStatus(url, "disqualified")).toBe(
            "https://screener.example.com/screener/callback?transactionid=[transactionid]&status=terminated"
        );
    });

    test("swaps status regardless of its position among params", () => {
        const url = "http://localhost:8787/screener/callback?status=complete&transactionid=[transactionid]";
        expect(updateScreenerRedirectStatus(url, "quality_terminate")).toBe(
            "http://localhost:8787/screener/callback?status=quality_terminate&transactionid=[transactionid]"
        );
    });

    test("returns null for a URL that is not a screener callback (custom URL is left untouched)", () => {
        expect(updateScreenerRedirectStatus("https://custom.example/thanks", "completed")).toBeNull();
    });

    test("returns null for empty or missing URLs", () => {
        expect(updateScreenerRedirectStatus("", "completed")).toBeNull();
        expect(updateScreenerRedirectStatus(undefined, "completed")).toBeNull();
    });
});
