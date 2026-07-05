import { NextRequest, NextResponse } from "next/server";
import { getBackendDb, getBackendStore } from "@/lib/backend";
import { verifyAdmin } from "@/lib/admin-auth";
import { nanoid } from "nanoid";

interface BackupPayload {
  format?: string;
  exported_at?: string;
  users?: Record<string, unknown>[];
  collections?: Record<string, unknown>[];
  modules?: Array<Record<string, unknown> & { content_base64?: string | null }>;
  module_versions?: Record<string, unknown>[];
}

const FORMAT = "forward-widget-hub-backup-v1";

export async function GET(request: NextRequest) {
  const denied = await verifyAdmin(request);
  if (denied) return denied;

  const db = await getBackendDb();
  const store = await getBackendStore();
  const users = await db.prepare("SELECT id, token_hash, token_prefix, name, created_at FROM users ORDER BY created_at").all();
  const collections = await db.prepare("SELECT * FROM collections ORDER BY created_at").all();
  const modules = await db.prepare("SELECT * FROM modules ORDER BY created_at").all<Record<string, unknown>>();
  const module_versions = await db.prepare("SELECT id, module_id, collection_id, filename, title, version, file_size, content_base64, created_at FROM module_versions ORDER BY created_at").all();

  const modulesWithContent = await Promise.all(modules.map(async (m) => {
    const collectionId = String(m.collection_id || "");
    const filename = String(m.oss_key || m.filename || "");
    const content = collectionId && filename ? await store.read(collectionId, filename) : null;
    return { ...m, content_base64: content ? content.toString("base64") : null };
  }));

  return NextResponse.json({
    format: FORMAT,
    exported_at: new Date().toISOString(),
    users,
    collections,
    modules: modulesWithContent,
    module_versions,
  }, {
    headers: {
      "Content-Disposition": `attachment; filename="forward-widget-hub-backup-${Date.now()}.json"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(request: NextRequest) {
  const denied = await verifyAdmin(request);
  if (denied) return denied;

  const payload = await request.json().catch(() => null) as BackupPayload | null;
  if (!payload || payload.format !== FORMAT) {
    return NextResponse.json({ error: "Invalid backup format" }, { status: 400 });
  }

  const db = await getBackendDb();
  const store = await getBackendStore();
  const users = Array.isArray(payload.users) ? payload.users : [];
  const collections = Array.isArray(payload.collections) ? payload.collections : [];
  const modules = Array.isArray(payload.modules) ? payload.modules : [];
  const versions = Array.isArray(payload.module_versions) ? payload.module_versions : [];

  for (const u of users) {
    await db.prepare("INSERT OR IGNORE INTO users (id, token_hash, token_prefix, name, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(u.id || nanoid(), u.token_hash, u.token_prefix, u.name || null, u.created_at || Math.floor(Date.now() / 1000));
  }

  for (const c of collections) {
    await db.prepare(`INSERT OR REPLACE INTO collections (id, user_id, slug, title, description, icon_url, source_url, visibility, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      c.id, c.user_id, c.slug, c.title, c.description || "", c.icon_url || "", c.source_url || null, c.visibility || "public", c.created_at || Math.floor(Date.now() / 1000), c.updated_at || Math.floor(Date.now() / 1000)
    );
  }

  for (const m of modules) {
    const moduleId = String(m.id || nanoid());
    await db.prepare(`INSERT OR REPLACE INTO modules (id, collection_id, filename, widget_id, title, description, version, author, required_version, file_size, is_encrypted, source_url, oss_key, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      moduleId, m.collection_id, m.filename, m.widget_id || null, m.title || null, m.description || "", m.version || null, m.author || null, m.required_version || null, m.file_size || 0, m.is_encrypted || 0, m.source_url || null, m.oss_key || null, m.created_at || Math.floor(Date.now() / 1000), m.updated_at || Math.floor(Date.now() / 1000)
    );
    if (typeof m.content_base64 === "string" && m.collection_id && m.filename) {
      await store.save(String(m.collection_id), String(m.oss_key || m.filename), Buffer.from(m.content_base64, "base64"));
    }
  }

  for (const v of versions) {
    if (!v.id || !v.module_id || !v.collection_id || !v.filename || !v.content_base64) continue;
    await db.prepare(`INSERT OR REPLACE INTO module_versions (id, module_id, collection_id, filename, title, version, file_size, content_base64, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(v.id, v.module_id, v.collection_id, v.filename, v.title || null, v.version || null, v.file_size || 0, v.content_base64, v.created_at || Math.floor(Date.now() / 1000));
  }

  return NextResponse.json({ success: true, imported: { users: users.length, collections: collections.length, modules: modules.length, versions: versions.length } });
}
