import { NextRequest, NextResponse } from "next/server";
import { getBackendDb } from "@/lib/backend";

export const dynamic = "force-dynamic";

interface ModuleRow {
  id: string; collection_id: string; filename: string; widget_id: string | null; title: string | null;
  description: string | null; version: string | null; author: string | null;
  required_version: string | null; file_size: number; updated_at: number | null;
  oss_key: string | null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  // Public subscription endpoint: Forward clients do not consistently send a
  // User-Agent containing "Forward" (some mobile/runtime import paths use
  // Dart/CF/browser-like agents). Do not UA-gate this route, otherwise the
  // generated collection link cannot be imported.
  const { slug } = await params;
  const db = await getBackendDb();
  const aliasOnlyMap: Record<string, string | undefined> = {
    "jin-widgets-xvideos": "jin.forward.xvideos",
    "jin-widgets-xvideos-raw": "jin.forward.xvideos",
    "jin-widgets-xvideos-file": "jin.forward.xvideos",
  };
  const aliasOnlyLists: Record<string, string[] | undefined> = {
    "jin-widgets-first5": ["jin.forward.91porna.v2", "jin.forward.123av", "jin.forward.badnews.dm.body", "jin.forward.beeg", "jin.forward.hanime2"],
    "jin-widgets-last4": ["jin.forward.missav", "jin.forward.pornhub", "jin.forward.rou.video", "jin.forward.xvideos"],
    "jin-widgets-pair-a": ["jin.forward.91porna.v2", "jin.forward.123av"],
    "jin-widgets-pair-b": ["jin.forward.badnews.dm.body", "jin.forward.beeg"],
    "jin-widgets-badnews": ["jin.forward.badnews.dm.body"],
    "jin-widgets-beeg": ["jin.forward.beeg"],
    "jin-widgets-beeg-xvideos": ["jin.forward.beeg", "jin.forward.xvideos"],
    "jin-widgets-pair-c": ["jin.forward.hanime2", "jin.forward.missav"],
    "jin-widgets-pair-d": ["jin.forward.pornhub", "jin.forward.rou.video"],
    "jin-widgets-pair-e": ["jin.forward.xvideos"],
    "jin-widgets-proxy-img": ["jin.forward.91porna.v2"],
    "jin-widgets-proxy-hls": ["jin.forward.123av", "jin.forward.beeg", "jin.forward.missav", "jin.forward.rou.video"],
    "jin-widgets-proxy-all": ["jin.forward.91porna.v2", "jin.forward.123av", "jin.forward.beeg", "jin.forward.missav", "jin.forward.rou.video"],
  };
  const isJinAlias = slug === "jin-widgets" || slug === "jin-widgets-safe" || aliasOnlyMap[slug] || aliasOnlyLists[slug];
  const collectionSlug = isJinAlias ? "9gGwC_iYuq" : slug;
  const collection = await db.prepare("SELECT * FROM collections WHERE slug = ?").get(collectionSlug) as Record<string, unknown> | undefined;
  if (!collection) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const requestedSafe = request.nextUrl.searchParams.get("safe") === "1";
  const requestedOnly = request.nextUrl.searchParams.get("only") || aliasOnlyMap[slug];
  const requestedSkip = new Set(
    (request.nextUrl.searchParams.get("skip") || "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean)
  );

  let modules = await db.prepare(
    "SELECT id, collection_id, filename, widget_id, title, description, version, author, required_version, file_size, updated_at, oss_key FROM modules WHERE collection_id = ? ORDER BY created_at"
  ).all(collection.id) as ModuleRow[];

  if (requestedOnly) {
    modules = modules.filter((m) => m.widget_id === requestedOnly || m.id === requestedOnly || m.filename === requestedOnly);
  }
  const aliasList = aliasOnlyLists[slug];
  if (aliasList) {
    const allowed = new Set(aliasList);
    modules = modules.filter((m) => allowed.has(m.widget_id || "") || allowed.has(m.id) || allowed.has(m.filename));
  }
  if (requestedSafe || slug === "jin-widgets-safe") {
    // Compatibility view excluding xvideos for quick import isolation.
    requestedSkip.add("jin.forward.xvideos");
  }
  if (requestedSkip.size) {
    modules = modules.filter((m) => !requestedSkip.has(m.widget_id || m.id) && !requestedSkip.has(m.filename));
  }

  const siteUrl = (process.env.SITE_URL || `${request.headers.get("x-forwarded-proto") || "https"}://${request.headers.get("host") || request.nextUrl.host}`).replace(/\/$/, "");

  const fwd = {
    title: collection.title,
    description: collection.description,
    icon: collection.icon_url || "",
    widgets: modules.map((m) => ({
      id: m.widget_id || m.id,
      title: m.title || m.filename,
      description: m.description || "",
      requiredVersion: m.required_version || "0.0.1",
      version: m.version || "1.0.0",
      author: m.author || "",
      url: (() => {
        // Forward validates module info more reliably when the URL path ends
        // with the actual .js filename. Keep it query-free and route the
        // request through our raw module endpoint.
        if (slug === "jin-widgets-xvideos-raw") {
          return `${siteUrl}/api/modules/${m.id}/raw`;
        }
        const versionedFilename = m.updated_at ? `${m.updated_at}-${m.filename}` : m.filename;
        return `${siteUrl}/api/modules/${m.id}/raw/${encodeURIComponent(versionedFilename)}`;
      })(),
    })),
  };

  return new NextResponse(JSON.stringify(fwd, null, 2), {
    headers: {
      // Match the official GitHub-hosted .fwd files more closely. Some mobile
      // import paths appear stricter with local/network source handling than
      // ordinary browsers/curl.
      "Content-Type": "text/plain; charset=utf-8",
      // Keep collection manifests fresh but CDN-cacheable. Module URLs include
      // updated_at in the filename path, so changed code busts long-lived caches.
      "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
