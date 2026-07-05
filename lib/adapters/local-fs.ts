import type { Store } from "../backend";
import fs from "fs";
import path from "path";
import { safeFilename } from "../file-safety";

export function createLocalStore(): Store {
  const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
  const MODULES_DIR = path.join(DATA_DIR, "modules");

  fs.mkdirSync(MODULES_DIR, { recursive: true });

  const collectionDir = (collectionId: string) => path.join(MODULES_DIR, safeFilename(collectionId, "collection"));

  return {
    async save(collectionId, filename, content) {
      const dir = collectionDir(collectionId);
      fs.mkdirSync(dir, { recursive: true });
      const safeName = safeFilename(filename);
      fs.writeFileSync(path.join(dir, safeName), content);
    },
    async read(collectionId, filename) {
      const filePath = path.join(collectionDir(collectionId), safeFilename(filename));
      if (!fs.existsSync(filePath)) return null;
      return fs.readFileSync(filePath);
    },
    async remove(collectionId, filename) {
      const filePath = path.join(collectionDir(collectionId), safeFilename(filename));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    },
    async removeCollection(collectionId) {
      const dir = collectionDir(collectionId);
      if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}
