export type CollectionVisibility = "public" | "unlisted" | "private";

export function normalizeVisibility(value: unknown): CollectionVisibility {
  return value === "private" || value === "unlisted" || value === "public" ? value : "public";
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
