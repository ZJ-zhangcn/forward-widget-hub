export const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  token_hash TEXT UNIQUE NOT NULL,
  token_prefix TEXT NOT NULL,
  name TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  icon_url TEXT DEFAULT '',
  source_url TEXT,
  visibility TEXT DEFAULT 'public',
  show_on_home INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS modules (
  id TEXT PRIMARY KEY,
  collection_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  widget_id TEXT,
  title TEXT,
  description TEXT DEFAULT '',
  version TEXT,
  author TEXT,
  required_version TEXT,
  file_size INTEGER DEFAULT 0,
  is_encrypted INTEGER DEFAULT 0,
  source_url TEXT,
  oss_key TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_collections_user_id ON collections(user_id);
CREATE INDEX IF NOT EXISTS idx_collections_slug ON collections(slug);
CREATE INDEX IF NOT EXISTS idx_modules_collection_id ON modules(collection_id);
CREATE INDEX IF NOT EXISTS idx_users_token_prefix ON users(token_prefix);

CREATE TABLE IF NOT EXISTS module_versions (
  id TEXT PRIMARY KEY,
  module_id TEXT NOT NULL,
  collection_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  title TEXT,
  version TEXT,
  file_size INTEGER DEFAULT 0,
  content_base64 TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE,
  FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_module_versions_module ON module_versions(module_id, created_at DESC);
`;

// Migration for existing databases that lack the required_version column
export const MIGRATIONS = [
  `ALTER TABLE modules ADD COLUMN required_version TEXT;`,
  `ALTER TABLE collections ADD COLUMN source_url TEXT;`,
  `ALTER TABLE modules ADD COLUMN source_url TEXT;`,
  `ALTER TABLE modules ADD COLUMN oss_key TEXT;`,
  `ALTER TABLE collections ADD COLUMN visibility TEXT DEFAULT 'public';`,
  `ALTER TABLE collections ADD COLUMN show_on_home INTEGER NOT NULL DEFAULT 1;`,
  `CREATE TABLE IF NOT EXISTS module_versions (id TEXT PRIMARY KEY, module_id TEXT NOT NULL, collection_id TEXT NOT NULL, filename TEXT NOT NULL, title TEXT, version TEXT, file_size INTEGER DEFAULT 0, content_base64 TEXT NOT NULL, created_at INTEGER DEFAULT (unixepoch()), FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE, FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE);`,
  `CREATE INDEX IF NOT EXISTS idx_module_versions_module ON module_versions(module_id, created_at DESC);`,
];

export function applyMigrations(exec: (sql: string) => void) {
  for (const sql of MIGRATIONS) {
    try { exec(sql); } catch { /* column already exists */ }
  }
}
