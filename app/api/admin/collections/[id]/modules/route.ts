import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getBackendDb, getBackendStore } from "@/lib/backend";
import { verifyAdmin } from "@/lib/admin-auth";
import { isEncrypted, parseWidgetMetadata } from "@/lib/parser";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await verifyAdmin(request);
  if (denied) return denied;

  const { id } = await params;
  const db = await getBackendDb();
  const collection = await db
    .prepare("SELECT id FROM collections WHERE id = ?")
    .get<{ id: string }>(id);

  if (!collection) return NextResponse.json({ error: "Collection not found" }, { status: 404 });

  const formData = await request.formData();
  const files = formData.getAll("files") as File[];
  if (!files.length) return NextResponse.json({ error: "No files" }, { status: 400 });

  for (const file of files) {
    if (!file.name.endsWith(".js")) {
      return NextResponse.json({ error: `File ${file.name} must be .js` }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: `File ${file.name} exceeds 5MB limit` }, { status: 413 });
    }
  }

  const store = await getBackendStore();
  const modules: Array<{ id: string; filename: string; title: string; encrypted: boolean }> = [];

  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const encrypted = isEncrypted(buffer);
    const meta = encrypted ? null : parseWidgetMetadata(buffer.toString("utf8"));
    const moduleId = nanoid();
    const filename = file.name;
    const title = meta?.title || filename.replace(/\.js$/i, "");

    await db.prepare(
      `INSERT INTO modules (id, collection_id, filename, widget_id, title, description, version, author, required_version, file_size, is_encrypted, source_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      moduleId,
      id,
      filename,
      meta?.id || null,
      title,
      meta?.description || "",
      meta?.version || null,
      meta?.author || null,
      meta?.requiredVersion || null,
      buffer.length,
      encrypted ? 1 : 0,
      null,
    );

    const ossKey = await store.save(id, filename, buffer);
    if (ossKey) await db.prepare("UPDATE modules SET oss_key = ? WHERE id = ?").run(ossKey, moduleId);
    modules.push({ id: moduleId, filename, title, encrypted });
  }

  await db.prepare("UPDATE collections SET updated_at = unixepoch() WHERE id = ?").run(id);

  return NextResponse.json({ success: true, modules });
}
