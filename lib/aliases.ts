export interface CollectionAlias {
  targetSlug: string;
  only?: string;
  list?: string[];
  skip?: string[];
  safe?: boolean;
}

type AliasInput = string | {
  target?: string;
  targetSlug?: string;
  only?: string;
  list?: string[];
  skip?: string[];
  safe?: boolean;
};

const DEFAULT_TARGET = "9gGwC_iYuq";

const builtInAliases: Record<string, CollectionAlias> = {
  "jin-widgets": { targetSlug: DEFAULT_TARGET },
  "jin-widgets-safe": { targetSlug: DEFAULT_TARGET, safe: true },
  "jin-widgets-xvideos": { targetSlug: DEFAULT_TARGET, only: "jin.forward.xvideos" },
  "jin-widgets-xvideos-raw": { targetSlug: DEFAULT_TARGET, only: "jin.forward.xvideos" },
  "jin-widgets-xvideos-file": { targetSlug: DEFAULT_TARGET, only: "jin.forward.xvideos" },
  "jin-widgets-first5": { targetSlug: DEFAULT_TARGET, list: ["jin.forward.91porna.v2", "jin.forward.123av", "jin.forward.badnews.dm.body", "jin.forward.beeg", "jin.forward.hanime2"] },
  "jin-widgets-last4": { targetSlug: DEFAULT_TARGET, list: ["jin.forward.missav", "jin.forward.pornhub", "jin.forward.rou.video", "jin.forward.xvideos"] },
  "jin-widgets-pair-a": { targetSlug: DEFAULT_TARGET, list: ["jin.forward.91porna.v2", "jin.forward.123av"] },
  "jin-widgets-pair-b": { targetSlug: DEFAULT_TARGET, list: ["jin.forward.badnews.dm.body", "jin.forward.beeg"] },
  "jin-widgets-badnews": { targetSlug: DEFAULT_TARGET, list: ["jin.forward.badnews.dm.body"] },
  "jin-widgets-beeg": { targetSlug: DEFAULT_TARGET, list: ["jin.forward.beeg"] },
  "jin-widgets-beeg-xvideos": { targetSlug: DEFAULT_TARGET, list: ["jin.forward.beeg", "jin.forward.xvideos"] },
  "jin-widgets-pair-c": { targetSlug: DEFAULT_TARGET, list: ["jin.forward.hanime2", "jin.forward.missav"] },
  "jin-widgets-pair-d": { targetSlug: DEFAULT_TARGET, list: ["jin.forward.pornhub", "jin.forward.rou.video"] },
  "jin-widgets-pair-e": { targetSlug: DEFAULT_TARGET, list: ["jin.forward.xvideos"] },
  "jin-widgets-proxy-img": { targetSlug: DEFAULT_TARGET, list: ["jin.forward.91porna.v2"] },
  "jin-widgets-proxy-hls": { targetSlug: DEFAULT_TARGET, list: ["jin.forward.123av", "jin.forward.beeg", "jin.forward.missav", "jin.forward.rou.video"] },
  "jin-widgets-proxy-all": { targetSlug: DEFAULT_TARGET, list: ["jin.forward.91porna.v2", "jin.forward.123av", "jin.forward.beeg", "jin.forward.missav", "jin.forward.rou.video"] },
};

function normalizeAlias(input: AliasInput): CollectionAlias | null {
  if (typeof input === "string") return { targetSlug: input };
  const targetSlug = input.targetSlug || input.target;
  if (!targetSlug) return null;
  return {
    targetSlug,
    only: typeof input.only === "string" ? input.only : undefined,
    list: Array.isArray(input.list) ? input.list.filter((v): v is string => typeof v === "string") : undefined,
    skip: Array.isArray(input.skip) ? input.skip.filter((v): v is string => typeof v === "string") : undefined,
    safe: input.safe === true,
  };
}

function envAliases(): Record<string, CollectionAlias> {
  const raw = process.env.COLLECTION_ALIASES;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, AliasInput>;
    return Object.fromEntries(
      Object.entries(parsed)
        .map(([slug, input]) => [slug, normalizeAlias(input)] as const)
        .filter((entry): entry is [string, CollectionAlias] => Boolean(entry[1]))
    );
  } catch {
    return {};
  }
}

export function resolveCollectionAlias(slug: string): CollectionAlias | null {
  return envAliases()[slug] || builtInAliases[slug] || null;
}
