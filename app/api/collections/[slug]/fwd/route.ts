import { NextRequest, NextResponse } from "next/server";
import { getBackendDb } from "@/lib/backend";
import { resolveCollectionAlias } from "@/lib/aliases";
import { verifyAdmin } from "@/lib/admin-auth";

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
  const alias = resolveCollectionAlias(slug);
  const collectionSlug = alias?.targetSlug || slug;
  const collection = await db.prepare("SELECT * FROM collections WHERE slug = ?").get(collectionSlug) as Record<string, unknown> | undefined;
  if (!collection) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (collection.visibility === "private" && !(await verifyAdmin(request))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const requestedSafe = request.nextUrl.searchParams.get("safe") === "1" || alias?.safe === true;
  const requestedOnly = request.nextUrl.searchParams.get("only") || alias?.only;
  const requestedSkip = new Set([
    ...(alias?.skip || []),
    ...(request.nextUrl.searchParams.get("skip") || "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean),
  ]);

  let modules = await db.prepare(
    "SELECT id, collection_id, filename, widget_id, title, description, version, author, required_version, file_size, updated_at, oss_key FROM modules WHERE collection_id = ? ORDER BY created_at"
  ).all(collection.id) as ModuleRow[];

  if (requestedOnly) {
    modules = modules.filter((m) => m.widget_id === requestedOnly || m.id === requestedOnly || m.filename === requestedOnly);
  }
  const aliasList = alias?.list;
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
