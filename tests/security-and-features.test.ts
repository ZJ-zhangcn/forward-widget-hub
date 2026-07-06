import { describe, expect, it, vi, beforeEach } from "vitest";
import { parseWidgetMetadata } from "../lib/parser";
import { validateRemoteFetchUrl, fetchRemoteUrl } from "../lib/url-safety";
import { verifyAdmin } from "../lib/admin-auth";
import { NextRequest } from "next/server";
import { hasValidAccessCookie, isAccessPasswordConfigured } from "../lib/access-password";
import { resolveCollectionAlias } from "../lib/aliases";
import { normalizeShowOnHome, normalizeVisibility, canCreateCollection, canAddModules } from "../lib/policy";
import { safeFilename } from "../lib/file-safety";

describe("WidgetMetadata parser", () => {
  it("parses common Forward widget metadata without executing code", () => {
    const meta = parseWidgetMetadata(`
      const WidgetMetadata = {
        id: 'demo.widget',
        title: '示例组件',
        description: 'desc',
        version: '1.2.3',
        author: 'Jin',
        requiredVersion: '0.0.1',
      };
    `);

    expect(meta).toMatchObject({
      id: "demo.widget",
      title: "示例组件",
      version: "1.2.3",
      author: "Jin",
      requiredVersion: "0.0.1",
    });
  });
});

describe("remote URL safety", () => {
  it("allows normal http/https public URLs", () => {
    expect(() => validateRemoteFetchUrl("https://raw.githubusercontent.com/a/b/main/widget.js")).not.toThrow();
    expect(() => validateRemoteFetchUrl("http://example.com/widget.fwd")).not.toThrow();
  });

  it("blocks SSRF-prone schemes and private/local targets", () => {
    const blocked = [
      "file:///etc/passwd",
      "ftp://example.com/a.js",
      "http://localhost/a.js",
      "http://127.0.0.1/a.js",
      "http://10.0.0.5/a.js",
      "http://172.16.1.1/a.js",
      "http://192.168.1.2/a.js",
      "http://169.254.169.254/latest/meta-data",
      "http://[::1]/a.js",
    ];
    for (const url of blocked) {
      expect(() => validateRemoteFetchUrl(url), url).toThrow();
    }
  });
  it("blocks redirect hops to private/local targets", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 302, headers: { location: "http://127.0.0.1/admin" } }),
    );

    await expect(fetchRemoteUrl("https://example.com/widget.js")).rejects.toThrow("Private or local URLs are not allowed");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockRestore();
  });
});

describe("admin auth helpers", () => {
  beforeEach(() => vi.unstubAllEnvs());

  it("returns null only when admin authentication succeeds", async () => {
    vi.stubEnv("ADMIN_PASSWORD", "admin-secret");
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("admin-secret"));
    const cookie = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");

    const valid = new NextRequest("https://example.com/admin", { headers: { cookie: `fwh_admin=${cookie}` } });
    const invalid = new NextRequest("https://example.com/admin");

    expect(await verifyAdmin(valid)).toBeNull();
    expect(await verifyAdmin(invalid)).toBeInstanceOf(Response);
  });
});

describe("access password helpers", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("detects configured access password", () => {
    vi.stubEnv("ACCESS_PASSWORD", "secret");
    expect(isAccessPasswordConfigured()).toBe(true);
  });

  it("accepts only the signed password hash cookie", async () => {
    vi.stubEnv("ACCESS_PASSWORD", "secret");
    const validHash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("secret"));
    const cookie = Array.from(new Uint8Array(validHash)).map((b) => b.toString(16).padStart(2, "0")).join("");
    expect(await hasValidAccessCookie(cookie)).toBe(true);
    expect(await hasValidAccessCookie("wrong")).toBe(false);
  });
});

describe("collection aliases", () => {
  beforeEach(() => vi.unstubAllEnvs());

  it("resolves built-in personal aliases outside the route handler", () => {
    expect(resolveCollectionAlias("jin-widgets-safe")).toMatchObject({ targetSlug: "9gGwC_iYuq", safe: true });
    expect(resolveCollectionAlias("jin-widgets-xvideos")).toMatchObject({ targetSlug: "9gGwC_iYuq", only: "jin.forward.xvideos" });
  });

  it("allows environment-defined aliases to replace hardcoded route edits", () => {
    vi.stubEnv("COLLECTION_ALIASES", JSON.stringify({
      demo: { target: "abc123", only: "widget.one", skip: ["widget.two"], safe: true },
    }));
    expect(resolveCollectionAlias("demo")).toEqual({
      targetSlug: "abc123",
      only: "widget.one",
      skip: ["widget.two"],
      safe: true,
      list: undefined,
    });
  });
});

describe("file safety", () => {
  it("sanitizes filenames and path-like identifiers", () => {
    expect(safeFilename("../../etc/passwd", "widget.js")).toBe("passwd");
    expect(safeFilename("..", "collection")).toBe("collection");
    expect(safeFilename("my widget?.js", "widget.js")).toBe("my_widget_.js");
  });
});

describe("policy helpers", () => {
  beforeEach(() => vi.unstubAllEnvs());

  it("normalizes collection visibility", () => {
    expect(normalizeVisibility("private")).toBe("private");
    expect(normalizeVisibility("unlisted")).toBe("unlisted");
    expect(normalizeVisibility("public")).toBe("public");
    expect(normalizeVisibility("bad")).toBe("public");
  });

  it("normalizes home page collection display flag", () => {
    expect(normalizeShowOnHome(false)).toBe(0);
    expect(normalizeShowOnHome("off")).toBe(0);
    expect(normalizeShowOnHome("0")).toBe(0);
    expect(normalizeShowOnHome(true)).toBe(1);
    expect(normalizeShowOnHome("yes")).toBe(1);
    expect(normalizeShowOnHome(undefined, 0)).toBe(0);
  });

  it("enforces optional collection and module quotas", () => {
    vi.stubEnv("MAX_COLLECTIONS_PER_USER", "2");
    vi.stubEnv("MAX_MODULES_PER_COLLECTION", "3");
    expect(canCreateCollection(1)).toEqual({ allowed: true });
    expect(canCreateCollection(2)).toMatchObject({ allowed: false });
    expect(canAddModules(1, 2)).toEqual({ allowed: true });
    expect(canAddModules(2, 2)).toMatchObject({ allowed: false });
  });
});
