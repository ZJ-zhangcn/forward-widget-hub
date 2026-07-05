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

function getSiteUrl(request: NextRequest): string {
  const proto = request.headers.get("x-forwarded-proto") || "https";
  const host = request.headers.get("host") || request.nextUrl.host;
  return `${proto}://${host}`;
}

export async function GET(request: NextRequest) {
  const slugs = getConfiguredSlugs();
  if (slugs.length === 0) {
    return NextResponse.json({ collections: [], configured: false });
  }

  const db = await getBackendDb();
  const siteUrl = getSiteUrl(request);
  const collections = [];

  for (const slug of slugs) {
    const collection = await db.prepare("SELECT * FROM collections WHERE slug = ?").get(slug) as Record<string, unknown> | undefined;
    if (!collection) continue;

    const modules = await db.prepare(
      "SELECT id, filename, widget_id, title, description, version, author, file_size, is_encrypted, source_url, created_at FROM modules WHERE collection_id = ? ORDER BY created_at"
    ).all<ModuleRow>(collection.id);

    collections.push({
      ...collection,
      fwdUrl: `${siteUrl}/api/collections/${collection.slug}/fwd`,
      pageUrl: `${siteUrl}/c/${collection.slug}`,
      modules,
    });
  }

  return NextResponse.json(
    { collections, configured: true },
    { headers: { "Cache-Control": "no-store" } }
  );
}
