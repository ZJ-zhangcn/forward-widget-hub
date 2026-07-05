import { NextRequest, NextResponse } from "next/server";
import { isAccessPasswordConfigured, requestHasValidAccessCookie } from "@/lib/access-password";
import { assertAllowedContentLength, fetchRemoteUrl, getMaxRemoteBytes, validateRemoteFetchUrl } from "@/lib/url-safety";

export async function GET(req: NextRequest) {
  if (isAccessPasswordConfigured() && !(await requestHasValidAccessCookie(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rawUrl = req.nextUrl.searchParams.get("url");
  if (!rawUrl) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  let url: URL;
  try {
    url = validateRemoteFetchUrl(rawUrl);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }

  try {
    const res = await fetchRemoteUrl(url, {
      headers: { "User-Agent": "ForwardWidgetHub/1.0" },
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Remote server returned ${res.status}` },
        { status: 502 }
      );
    }

    assertAllowedContentLength(res.headers.get("content-length"), getMaxRemoteBytes());
    const contentType = res.headers.get("content-type") || "application/octet-stream";
    const body = await res.arrayBuffer();
    if (body.byteLength > getMaxRemoteBytes()) {
      return NextResponse.json({ error: "Remote file exceeds size limit" }, { status: 413 });
    }

    return new NextResponse(body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-cache",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Fetch failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
