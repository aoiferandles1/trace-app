import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

/**
 * The local database: PGlite (Postgres 17 in WebAssembly) with Supabase's
 * own pieces recreated (bootstrap.sql), then every file in
 * supabase/migrations/ applied in order, unchanged, each in its own
 * transaction as the Supabase migration tool does.
 */

const here = import.meta.dirname;
export const ROOT = path.resolve(here, "../../..");
const MIGRATIONS = path.join(ROOT, "supabase/migrations");

export type Database = PGlite;

export function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

export async function createDatabase(opts: { portalSecret?: string; log?: (line: string) => void } = {}): Promise<PGlite> {
  const log = opts.log ?? (() => {});
  const db = await PGlite.create({ extensions: { pgcrypto } });
  await db.exec(readFileSync(path.join(here, "bootstrap.sql"), "utf8"));
  for (const file of migrationFiles()) {
    const started = Date.now();
    const sql = readFileSync(path.join(MIGRATIONS, file), "utf8");
    try {
      await db.exec(`begin;\n${sql}\ncommit;`);
    } catch (error) {
      await db.exec("rollback").catch(() => {});
      const e = error as Error & { position?: string };
      throw new Error(`Migration ${file} failed: ${e.message}${e.position ? ` (at character ${e.position})` : ""}`);
    }
    log(`applied ${file} in ${Date.now() - started} ms`);
  }
  if (opts.portalSecret) {
    // supabase/README.md section 9: only the SHA-256 (lowercase hex) is stored.
    const hash = createHash("sha256").update(opts.portalSecret, "utf8").digest("hex");
    await db.query(
      `insert into private.server_secrets (name, sha256_hex) values ('portal', $1)
       on conflict (name) do update set sha256_hex = excluded.sha256_hex`,
      [hash],
    );
  }
  return db;
}
