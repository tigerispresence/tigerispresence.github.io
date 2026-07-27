import fs from "fs";
import path from "path";
import crypto from "crypto";
import os from "os";

/**
 * Filesystem cache, carried over unchanged from the original routes.
 *
 * NOTE: this is a stopgap and is replaced in the caching phase. On Vercel the
 * deployment filesystem is read-only outside /tmp, and /tmp itself is
 * per-instance and wiped on cold start, so the hit rate in production is close
 * to zero. It is kept here only so this refactor stays behaviour-identical.
 */
export class FileCache {
  private readonly dir: string;

  constructor(namespace: string, private readonly ttlMs: number) {
    this.dir =
      process.env.NODE_ENV === "production"
        ? path.join(os.tmpdir(), namespace)
        : path.resolve(process.cwd(), ".cache", namespace);
  }

  private pathFor(key: string): string {
    const hash = crypto.createHash("md5").update(key).digest("hex");
    return path.join(this.dir, `${hash}.json`);
  }

  read<T>(key: string): T | null {
    try {
      const file = this.pathFor(key);
      if (!fs.existsSync(file)) return null;
      const cached = JSON.parse(fs.readFileSync(file, "utf8"));
      if (Date.now() - cached.timestamp >= this.ttlMs) return null;
      return cached.data as T;
    } catch (e) {
      console.warn("[cache] read failed:", e);
      return null;
    }
  }

  write(key: string, data: unknown): void {
    try {
      if (!fs.existsSync(this.dir)) fs.mkdirSync(this.dir, { recursive: true });
      fs.writeFileSync(
        this.pathFor(key),
        JSON.stringify({ timestamp: Date.now(), data }),
      );
    } catch (e) {
      console.error("[cache] write failed:", e);
    }
  }
}
