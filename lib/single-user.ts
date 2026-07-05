import { nanoid } from "nanoid";
import { getBackendDb } from "./backend";
import { getTokenPrefix, hashToken } from "./auth";

function truthy(value: string | undefined): boolean {
  return ["1", "true", "yes", "on"].includes((value || "").toLowerCase());
}

function falsy(value: string | undefined): boolean {
  return ["0", "false", "no", "off"].includes((value || "").toLowerCase());
}

export function isSingleUserMode(): boolean {
  return truthy(process.env.SINGLE_USER_MODE);
}

export function getSingleUserToken(): string | null {
  if (!isSingleUserMode()) return null;
  const token = process.env.OWNER_TOKEN || process.env.SINGLE_USER_TOKEN;
  const trimmed = token?.trim();
  return trimmed || null;
}

export function shouldClaimExistingCollections(): boolean {
  // In single-user self-hosted deployments, old uploads may have been created
  // under browser-local tokens. Default to claiming them so password login shows
  // the full library on every device. Set SINGLE_USER_CLAIM_EXISTING=false to opt out.
  return isSingleUserMode() && !falsy(process.env.SINGLE_USER_CLAIM_EXISTING);
}

export async function ensureSingleUser(token = getSingleUserToken()): Promise<{ userId: string; token: string } | null> {
  if (!token) return null;

  const db = await getBackendDb();
  const hash = hashToken(token);
  let user = await db.prepare("SELECT id FROM users WHERE token_hash = ?").get<{ id: string }>(hash);

  if (!user) {
    const userId = nanoid();
    await db
      .prepare("INSERT INTO users (id, token_hash, token_prefix, name) VALUES (?, ?, ?, ?)")
      .run(userId, hash, getTokenPrefix(token), "Single User");
    user = { id: userId };
  }

  if (shouldClaimExistingCollections()) {
    await db.prepare("UPDATE collections SET user_id = ? WHERE user_id <> ?").run(user.id, user.id);
  }

  return { userId: user.id, token };
}
