import { NextRequest } from "next/server";

export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function isAccessPasswordConfigured(): boolean {
  return Boolean(process.env.ACCESS_PASSWORD);
}

export async function hasValidAccessCookie(cookieValue: string | undefined | null): Promise<boolean> {
  const password = process.env.ACCESS_PASSWORD;
  if (!password) return true;
  if (!cookieValue) return false;
  return cookieValue === await sha256Hex(password);
}

export async function requestHasValidAccessCookie(req: NextRequest): Promise<boolean> {
  return hasValidAccessCookie(req.cookies.get("fwh_access")?.value);
}
