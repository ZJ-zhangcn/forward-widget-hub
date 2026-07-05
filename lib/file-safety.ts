export function safeFilename(name: string, fallback = "widget.js"): string {
  const base = name.split(/[\\/]/).pop()?.trim() || fallback;
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^\.+/, "");
  return cleaned || fallback;
}
