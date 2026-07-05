import { NextRequest } from "next/server";
import { sha256Hex } from "./access-password";

export async function hasValidAdminCookie(req: NextRequest): Promise<boolean> {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return false;
  return req.cookies.get("fwh_admin")?.value === await sha256Hex(password);
}
