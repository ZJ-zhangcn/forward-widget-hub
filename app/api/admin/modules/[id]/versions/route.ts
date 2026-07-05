import { NextRequest, NextResponse } from "next/server";
import { getBackendDb, getBackendStore } from "@/lib/backend";
import { verifyAdmin } from "@/lib/admin-auth";
import { parseWidgetMetadata } from "@/lib/parser";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await verifyAdmin(request);
  if (denied) return denied;

  const { id } = await params;
  const db = await getBackendDb();
  const versions = await db.prepare(
    "SELECT id, module_id, filename, title, version, file_size, created_at FROM module_versions WHERE module_id = ? ORDER BY created_at DESC LIMIT 20"
  ).all(id);
  return NextResponse.json({ versions });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await verifyAdmin(request);
  if (denied) return denied;

  const { id } = await params;
  const { versionId } = await request.json().catch(() => ({}));
  if (!versionId || typeof versionId !== "string") {
    return NextResponse.json({ error: "versionId required" }, { status: 400 });
  }

  const db = await getBackendDb();
  const current = await db.prepare("SELECT id, collection_id, filename, oss_key FROM modules WHERE id = ?").get(id) as { id: string; collection_id: string; filename: string; oss_key: string | null } | undefined;
  if (!current) return NextResponse.json({ error: "Module not found" }, { status: 404 });

  const version = await db.prepare("SELECT * FROM module_versions WHERE id = ? AND module_id = ?").get(versionId, id) as { id: string; filename: string; content_base64: string } | undefined;
  if (!version) return NextResponse.json({ error: "Version not found" }, { status: 404 });

  const buffer = Buffer.from(version.content_base64, "base64");
  const meta = parseWidgetMetadata(buffer.toString("utf8"));
  const store = await getBackendStore();
  const ossKey = await store.save(current.collection_id, current.filename, buffer);

  await db.prepare(
    "UPDATE modules SET file_size = ?, title = ?, version = ?, author = ?, description = ?, oss_key = ?, updated_at = unixepoch() WHERE id = ?"
  ).run(buffer.length, meta?.title || current.filename, meta?.version || null, meta?.author || null, meta?.description || null, ossKey || current.oss_key, id);

  return NextResponse.json({ success: true });
}
