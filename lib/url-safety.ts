const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;

function parseHostnameToIPv4(hostname: string): number[] | null {
  const parts = hostname.split(".");
  if (parts.length !== 4) return null;
  const nums = parts.map((part) => Number(part));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return nums;
}

function isPrivateIPv4(parts: number[]): boolean {
  const [a, b] = parts;
  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) ||
    a === 0 ||
    a >= 224
  );
}

function isLocalHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/\.$/, "").replace(/^\[(.*)\]$/, "$1");
  if (["localhost", "0", "0.0.0.0"].includes(normalized)) return true;
  if (normalized.endsWith(".localhost") || normalized.endsWith(".local")) return true;
  if (normalized === "::1" || normalized.startsWith("fe80:") || normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  const ipv4 = parseHostnameToIPv4(normalized);
  return ipv4 ? isPrivateIPv4(ipv4) : false;
}

export function validateRemoteFetchUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Invalid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http/https URLs are allowed");
  }
  if (!url.hostname || isLocalHostname(url.hostname)) {
    throw new Error("Private or local URLs are not allowed");
  }
  if (url.username || url.password) {
    throw new Error("URLs with embedded credentials are not allowed");
  }
  return url;
}

export function assertAllowedContentLength(contentLength: string | null, maxBytes = DEFAULT_MAX_BYTES) {
  if (!contentLength) return;
  const size = Number(contentLength);
  if (Number.isFinite(size) && size > maxBytes) {
    throw new Error(`Remote file exceeds ${Math.round(maxBytes / 1024 / 1024)}MB limit`);
  }
}

export function getMaxRemoteBytes(): number {
  const configured = Number(process.env.MAX_REMOTE_FILE_BYTES || "");
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_MAX_BYTES;
}
