/**
 * `npm run test:db`: every supabase/tests/*.sql file against the local
 * database (PGlite, all migrations applied). Each file runs in its own
 * transaction and ends with `rollback`; its last result set lists every check
 * with `pass`. One fresh database per file, so a failed file cannot leave
 * anything behind for the next.
 *
 *   npm run test:db                 every file
 *   npm run test:db -- 03 08        only files whose names start with these
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { createDatabase, ROOT } from "./db.ts";

const TESTS = path.join(ROOT, "supabase/tests");
const only = process.argv.slice(2);
const files = readdirSync(TESTS)
  .filter((f) => f.endsWith(".sql"))
  .filter((f) => only.length === 0 || only.some((o) => f.startsWith(o)))
  .sort();

type Row = { n?: number; test: string; pass: boolean; info: string | null };

const started = Date.now();
let passed = 0;
let failed = 0;
let broken = 0;

for (const file of files) {
  const t = Date.now();
  const db = await createDatabase();
  const sql = readFileSync(path.join(TESTS, file), "utf8");
  let rows: Row[] | null = null;
  let error: string | null = null;
  try {
    const results = await db.exec(sql);
    const last = [...results].reverse().find((r) => r.fields.some((f) => f.name === "pass"));
    rows = (last?.rows as Row[] | undefined) ?? null;
    if (!rows) error = "no result set with a `pass` column";
  } catch (e) {
    const err = e as Error & { position?: string; where?: string };
    error = `${err.message}${err.where ? `\n      where: ${err.where}` : ""}`;
  }
  await db.close();
  const ms = Date.now() - t;
  if (error || !rows) {
    broken++;
    console.log(`\n✗ ${file} (${ms} ms): did not finish\n    ${error}`);
    continue;
  }
  const bad = rows.filter((r) => !r.pass);
  passed += rows.length - bad.length;
  failed += bad.length;
  console.log(`\n${bad.length ? "✗" : "✓"} ${file}: ${rows.length - bad.length}/${rows.length} checks pass (${ms} ms)`);
  for (const r of rows) {
    if (!r.pass || process.env.VERBOSE) {
      console.log(`    ${r.pass ? "pass" : "FAIL"}  ${r.test}${r.info ? `  [${r.info}]` : ""}`);
    }
  }
}

console.log(
  `\n${files.length} files, ${passed} checks passed, ${failed} failed, ${broken} files did not finish (${((Date.now() - started) / 1000).toFixed(1)} s)`,
);
process.exit(failed || broken ? 1 : 0);
