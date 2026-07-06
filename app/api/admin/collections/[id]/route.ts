import { NextRequest, NextResponse } from "next/server";
import { getBackendDb, getBackendStore } from "@/lib/backend";
import { verifyAdmin } from "@/lib/admin-auth";
import { normalizeShowOnHome, normalizeVisibility } from "@/lib/policy";

function normalizeOptional(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await verifyAdmin(request);
  if (denied) return denied;

  const { id } = await params;
  const body = await request.json().catch(() => null) as {
    title?: string;
    description?: string;
    slug?: string;
    icon_url?: string;
    source_url?: string;
    visibility?: string;
    show_on_home?: boolean | number | string;
  } | null;

  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const iconUrl = normalizeOptional(body.icon_url);
  const sourceUrl = normalizeOptional(body.source_url);

  if (!title) return NextResponse.json({ error: "Title required" }, { status: 400 });
  if (!slug) return NextResponse.json({ error: "Slug required" }, { status: 400 });
  if (!/^[A-Za-z0-9_-]{3,64}$/.test(slug)) {
    return NextResponse.json({ error: "Slug must be 3-64 chars: letters, numbers, _ or -" }, { status: 400 });
  }

  const db = await getBackendDb();
  const collection = (await db
    .prepare("SELECT id, slug, visibility, show_on_home FROM collections WHERE id = ?")
    .get(id)) as { id: string; slug: string; visibility?: string | null; show_on_home?: number | null } | undefined;

  if (!collection) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const visibility = normalizeVisibility(body.visibility ?? collection.visibility ?? "public");
  const showOnHome = normalizeShowOnHome(body.show_on_home, Number(collection.show_on_home ?? 1));

  const duplicate = (await db
    .prepare("SELECT id FROM collections WHERE slug = ? AND id <> ?")
    .get(slug, id)) as { id: string } | undefined;

  if (duplicate) return NextResponse.json({ error: "Slug already exists" }, { status: 409 });

  await db.prepare(
    "UPDATE collections SET title = ?, description = ?, slug = ?, icon_url = ?, source_url = ?, visibility = ?, show_on_home = ?, updated_at = unixepoch() WHERE id = ?"
  ).run(title, description, slug, iconUrl || "", sourceUrl, visibility, showOnHome, id);

  return NextResponse.json({ success: true, collection: { id, title, description, slug, icon_url: iconUrl || "", source_url: sourceUrl, visibility, show_on_home: showOnHome } });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await verifyAdmin(request);
  if (denied) return denied;

  const { id } = await params;
  const db = await getBackendDb();

  const collection = (await db
    .prepare("SELECT id FROM collections WHERE id = ?")
    .get(id)) as { id: string } | undefined;

  if (!collection) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.prepare("DELETE FROM module_versions WHERE collection_id = ?").run(id);
  await db.prepare("DELETE FROM modules WHERE collection_id = ?").run(id);
  await db.prepare("DELETE FROM collections WHERE id = ?").run(id);
  const store = await getBackendStore();
  await store.removeCollection(id);

  return NextResponse.json({ success: true });
}
