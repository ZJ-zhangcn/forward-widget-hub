export type CollectionVisibility = "public" | "unlisted" | "private";

export function normalizeVisibility(value: unknown): CollectionVisibility {
  return value === "private" || value === "unlisted" || value === "public" ? value : "public";
}

export function normalizeShowOnHome(value: unknown, fallback = 1): number {
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "number") return value === 0 ? 0 : 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["0", "false", "off", "no"].includes(normalized)) return 0;
    if (["1", "true", "on", "yes"].includes(normalized)) return 1;
  }
  return fallback === 0 ? 0 : 1;
}

function envPositiveInt(name: string): number | null {
  const raw = process.env[name];
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function canCreateCollection(existingCount: number): { allowed: boolean; reason?: string } {
  const max = envPositiveInt("MAX_COLLECTIONS_PER_USER");
  if (max !== null && existingCount >= max) {
    return { allowed: false, reason: `Collection quota exceeded (${max})` };
  }
  return { allowed: true };
}

export function canAddModules(existingCount: number, addingCount: number): { allowed: boolean; reason?: string } {
  const max = envPositiveInt("MAX_MODULES_PER_COLLECTION");
  if (max !== null && existingCount + addingCount > max) {
    return { allowed: false, reason: `Module quota exceeded (${max})` };
  }
  return { allowed: true };
}
