import { NextRequest, NextResponse } from "next/server";
import { getBackendDb } from "@/lib/backend";

export const dynamic = "force-dynamic";

interface ModuleRow {
  id: string;
  filename: string;
  widget_id: string | null;
  title: string | null;
  description: string | null;
  version: string | null;
  author: string | null;
  file_size: number;
  is_encrypted: number;
  source_url: string | null;
  created_at: number;
}

function getConfiguredSlugs(): string[] {
  const raw = process.env.PUBLIC_COLLECTION_SLUGS || process.env.PUBLIC_COLLECTION_SLUG || "";
  return raw
    .split(/[\s,]+/)
    .map((slug) => slug.trim())
    .filter(Boolean)
    .filter((slug, index, all) => all.indexOf(slug) === index);
}

function shouldShowAll(slugs: string[]): boolean {
  return slugs.length === 0 || slugs.some((slug) => slug.toLowerCase() === "all" || slug === "*");
}

function getSiteUrl(request: NextRequest): string {
  const proto = request.headers.get("x-forwarded-proto") || "https";
  const host = request.headers.get("host") || request.nextUrl.host;
  return `${proto}://${host}`;
}

export async function GET(request: NextRequest) {
  const configuredSlugs = getConfiguredSlugs();
  const showAll = shouldShowAll(configuredSlugs);
  const db = await getBackendDb();
  const siteUrl = getSiteUrl(request);
  const collections = [];

  const collectionRows = showAll
    ? await db.prepare(
      "SELECT c.* FROM collections c WHERE COALESCE(c.visibility, 'public') = 'public' AND EXISTS (SELECT 1 FROM modules m WHERE m.collection_id = c.id) ORDER BY c.updated_at DESC, c.created_at DESC"
    ).all<Record<string, unknown>>()
    : await Promise.all(
      configuredSlugs.map((slug) =>
        db.prepare("SELECT * FROM collections WHERE slug = ?").get(slug) as Promise<Record<string, unknown> | undefined>
      )
    );

  for (const collection of collectionRows.filter(Boolean) as Record<string, unknown>[]) {
    const modules = await db.prepare(
      "SELECT id, filename, widget_id, title, description, version, author, file_size, is_encrypted, source_url, created_at FROM modules WHERE collection_id = ? ORDER BY created_at"
    ).all<ModuleRow>(collection.id);
    if (modules.length === 0) continue;

    collections.push({
      ...collection,
      fwdUrl: `${siteUrl}/api/collections/${collection.slug}/fwd`,
      pageUrl: `${siteUrl}/c/${collection.slug}`,
      modules,
    });
  }

  return NextResponse.json(
    {
      collections,
      configured: configuredSlugs.length > 0,
      mode: showAll ? "all" : "configured",
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
