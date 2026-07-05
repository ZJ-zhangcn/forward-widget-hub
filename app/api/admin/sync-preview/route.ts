import { NextRequest, NextResponse } from "next/server";
import { getBackendDb } from "@/lib/backend";
import { verifyAdmin } from "@/lib/admin-auth";

interface IncomingWidget {
  id?: string;
  filename?: string;
  title?: string;
  version?: string;
  source_url?: string;
}

export async function POST(request: NextRequest) {
  const denied = await verifyAdmin(request);
  if (denied) return denied;

  const body = await request.json().catch(() => null) as { collection_id?: string; widgets?: IncomingWidget[] } | null;
  if (!body?.collection_id || !Array.isArray(body.widgets)) {
    return NextResponse.json({ error: "collection_id and widgets[] required" }, { status: 400 });
  }

  const db = await getBackendDb();
  const existing = await db.prepare(
    "SELECT id, filename, widget_id, title, version, source_url FROM modules WHERE collection_id = ? ORDER BY created_at"
  ).all<Record<string, string | null>>(body.collection_id);

  const matchedExisting = new Set<string>();
  const added: IncomingWidget[] = [];
  const updated: Array<{ existing: Record<string, string | null>; incoming: IncomingWidget; changes: string[] }> = [];
  const unchanged: Array<{ existing: Record<string, string | null>; incoming: IncomingWidget }> = [];

  for (const incoming of body.widgets) {
    const match = existing.find((m) =>
      (incoming.source_url && m.source_url === incoming.source_url) ||
      (incoming.id && m.widget_id === incoming.id) ||
      (incoming.filename && m.filename === incoming.filename)
    );
    if (!match) {
      added.push(incoming);
      continue;
    }
    matchedExisting.add(String(match.id));
    const changes = [
      incoming.filename && incoming.filename !== match.filename ? "filename" : null,
      incoming.title && incoming.title !== match.title ? "title" : null,
      incoming.version && incoming.version !== match.version ? "version" : null,
      incoming.source_url && incoming.source_url !== match.source_url ? "source_url" : null,
    ].filter((v): v is string => Boolean(v));
    if (changes.length) updated.push({ existing: match, incoming, changes });
    else unchanged.push({ existing: match, incoming });
  }

  const removed = existing.filter((m) => !matchedExisting.has(String(m.id)));

  return NextResponse.json({
    summary: { added: added.length, updated: updated.length, removed: removed.length, unchanged: unchanged.length },
    added,
    updated,
    removed,
    unchanged,
  });
}
