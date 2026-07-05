import { NextRequest, NextResponse } from "next/server";
import { getBackendDb, getBackendStore } from "@/lib/backend";

export const dynamic = "force-dynamic";

interface ModuleRow { id: string; collection_id: string; filename: string; is_encrypted: number; oss_key: string | null; }

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; filename: string }> }
) {
  // Compatibility endpoint: Forward validates module info more reliably when
  // the widget URL path ends with a .js filename instead of a bare /raw path.
  const { id } = await params;
  const db = await getBackendDb();
  const mod = await db.prepare("SELECT id, collection_id, filename, is_encrypted, oss_key FROM modules WHERE id = ?").get(id) as ModuleRow | undefined;
  if (!mod) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const store = await getBackendStore();
  const storageKey = mod.oss_key || mod.filename;
  const content = await store.read(mod.collection_id, storageKey);
  if (!content) return NextResponse.json({ error: "File not found" }, { status: 404 });

  const contentType = mod.is_encrypted ? "application/octet-stream" : "application/javascript; charset=utf-8";

  return new NextResponse(new Uint8Array(content), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(mod.filename)}"; filename*=UTF-8''${encodeURIComponent(mod.filename)}`,
      // Versioned .js URL path from the .fwd manifest makes this safe for
      // long CDN/browser caching; updates change the filename segment.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
