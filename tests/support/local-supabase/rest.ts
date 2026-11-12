import type { Transaction } from "@electric-sql/pglite";
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  asCaller,
  callerOf,
  isHttpError,
  pgErrorBody,
  quoteIdent,
  readBody,
  send,
  statusForSqlState,
  type Caller,
  type Context,
  type HttpError,
} from "./context.ts";

/**
 * The PostgREST subset Trace uses (/rest/v1). Every request is one
 * transaction as the caller's role with `request.jwt.claims` set, so row-level
 * security, grants and auth.uid() decide exactly as they do on the hosted
 * project. Results are made into JSON by Postgres itself (json_agg / to_json),
 * as PostgREST does, so dates, numbers and nulls come back in the same form.
 *
 * Supported, because src/ uses them (grep `.from(` and `.rpc(`):
 * - /rpc/<function>: POST with named arguments, overloads resolved by the
 *   argument names given (PGRST202 none, PGRST203 several).
 * - /<table>: GET and HEAD (select=col,col or *; filters eq, neq, gt, gte,
 *   lt, lte, like, ilike, in, is, each optionally not.; order; limit; offset;
 *   Prefer count=exact), POST (one object or an array; Prefer
 *   return=representation|minimal; ?columns=), PATCH and DELETE with filters.
 * - Accept: application/vnd.pgrst.object+json (single()): exactly one row or
 *   406 PGRST116.
 * Not supported (and refused loudly, so a new use shows up in a test): embedded
 * resources, aliases and casts in select, or/and filters, upserts, ranges.
 */

type ColumnTypes = Map<string, string>;
const columnCache = new Map<string, ColumnTypes>();

async function columnsOf(tx: Transaction, table: string): Promise<ColumnTypes | null> {
  const hit = columnCache.get(table);
  if (hit) return hit;
  const res = await tx.query<{ name: string; type: string }>(
    `select a.attname as name, format_type(a.atttypid, a.atttypmod) as type
       from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = $1 and c.relkind in ('r', 'v', 'p') and a.attnum > 0 and not a.attisdropped
      order by a.attnum`,
    [table],
  );
  if (!res.rows.length) return null;
  const map = new Map(res.rows.map((r) => [r.name, r.type]));
  columnCache.set(table, map);
  return map;
}

function bad(message: string, code = "PGRST100", status = 400): HttpError {
  return { status, body: { code, details: null, hint: null, message } };
}

function parseList(raw: string): string[] {
  // in.(a,b,"c d")
  if (!raw.startsWith("(") || !raw.endsWith(")")) throw bad(`"failed to parse filter (in.${raw})"`);
  const inner = raw.slice(1, -1);
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (quoted) {
      if (ch === "\\" && i + 1 < inner.length) cur += inner[++i];
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  if (inner.length) out.push(cur);
  return out;
}

const OPS: Record<string, string> = { eq: "=", neq: "<>", gt: ">", gte: ">=", lt: "<", lte: "<=", like: "like", ilike: "ilike" };
const RESERVED = new Set(["select", "order", "limit", "offset", "columns", "on_conflict"]);

/** Turns the URL's filters into a WHERE clause with parameters. */
function whereOf(url: URL, cols: ColumnTypes, table: string, params: unknown[]): string {
  const parts: string[] = [];
  for (const [key, value] of url.searchParams) {
    if (RESERVED.has(key)) continue;
    if (key === "or" || key === "and" || key.includes(".")) throw bad(`unsupported filter "${key}" in the local stand-in`);
    const type = cols.get(key);
    if (!type) throw bad(`column ${table}.${key} does not exist`, "42703");
    let rest = value;
    let negate = false;
    if (rest.startsWith("not.")) {
      negate = true;
      rest = rest.slice(4);
    }
    const dot = rest.indexOf(".");
    if (dot < 0) throw bad(`"failed to parse filter (${value})"`);
    const op = rest.slice(0, dot);
    const operand = rest.slice(dot + 1);
    const col = quoteIdent(key);
    let clause: string;
    if (op === "is") {
      const v = operand.toLowerCase();
      if (!["null", "true", "false", "unknown"].includes(v)) throw bad(`"failed to parse filter (${value})"`);
      clause = `${col} is ${v}`;
    } else if (op === "in") {
      const items = parseList(operand);
      if (!items.length) clause = "false";
      else {
        const ph = items.map((item) => {
          params.push(item);
          return `$${params.length}::${type}`;
        });
        clause = `${col} in (${ph.join(", ")})`;
      }
    } else if (OPS[op]) {
      params.push(operand);
      const cast = op === "like" || op === "ilike" ? "text" : type;
      clause = `${op === "like" || op === "ilike" ? `${col}::text` : col} ${OPS[op]} $${params.length}::${cast}`;
    } else {
      throw bad(`unsupported operator "${op}" in the local stand-in`);
    }
    parts.push(negate ? `not (${clause})` : clause);
  }
  return parts.length ? `where ${parts.join(" and ")}` : "";
}

function selectListOf(url: URL, cols: ColumnTypes, table: string): string {
  const raw = url.searchParams.get("select") ?? "*";
  const items = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (!items.length || items.includes("*")) {
    if (items.length > 1) throw bad(`unsupported select "${raw}" in the local stand-in`);
    return "*";
  }
  return items
    .map((name) => {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw bad(`unsupported select "${raw}" in the local stand-in`);
      if (!cols.has(name)) throw bad(`column ${table}.${name} does not exist`, "42703");
      return quoteIdent(name);
    })
    .join(", ");
}

function orderOf(url: URL, cols: ColumnTypes, table: string): string {
  const raw = url.searchParams.get("order");
  if (!raw) return "";
  const terms = raw.split(",").map((term) => {
    const [name, ...mods] = term.split(".");
    if (!cols.has(name)) throw bad(`column ${table}.${name} does not exist`, "42703");
    let sql = quoteIdent(name);
    for (const m of mods) {
      if (m === "asc" || m === "desc") sql += ` ${m}`;
      else if (m === "nullsfirst") sql += " nulls first";
      else if (m === "nullslast") sql += " nulls last";
      else throw bad(`"failed to parse order (${raw})"`);
    }
    return sql;
  });
  return `order by ${terms.join(", ")}`;
}

function limitOf(url: URL): string {
  const limit = url.searchParams.get("limit");
  const offset = url.searchParams.get("offset");
  let sql = "";
  if (limit !== null) {
    if (!/^\d+$/.test(limit)) throw bad(`invalid limit ${limit}`);
    sql += ` limit ${limit}`;
  }
  if (offset !== null) {
    if (!/^\d+$/.test(offset)) throw bad(`invalid offset ${offset}`);
    sql += ` offset ${offset}`;
  }
  return sql;
}

function prefer(req: IncomingMessage): { representation: boolean; count: boolean } {
  const p = String(req.headers.prefer ?? "");
  return { representation: /return=representation/.test(p), count: /count=(exact|planned|estimated)/.test(p) };
}

function wantsObject(req: IncomingMessage): boolean {
  return String(req.headers.accept ?? "").includes("application/vnd.pgrst.object+json");
}

/** Rows as PostgREST sends them: an array, or one object for single(). */
function shape(req: IncomingMessage, rows: unknown[]): { status: number; body: unknown } | HttpError {
  if (!wantsObject(req)) return { status: 200, body: rows };
  if (rows.length !== 1) {
    return {
      status: 406,
      body: {
        code: "PGRST116",
        details: `The result contains ${rows.length} rows`,
        hint: null,
        message: "JSON object requested, multiple (or no) rows returned",
      },
    };
  }
  return { status: 200, body: rows[0] };
}

/** As shape(), for a write: when single() does not get exactly one row, PostgREST rolls the write back. */
function written(req: IncomingMessage, rows: unknown[]): { status: number; body: unknown } {
  const shaped = shape(req, rows);
  if (shaped.status !== 200) throw shaped;
  return shaped;
}

/** Runs a select (with an optional data-modifying `with`, which must stay at the top) and returns its rows as JSON. */
async function jsonRows(tx: Transaction, sql: string, params: unknown[], cte = ""): Promise<unknown[]> {
  const res = await tx.query<{ j: string }>(`${cte} select coalesce(json_agg(_r), '[]'::json)::text as j from (${sql}) _r`, params);
  return JSON.parse(res.rows[0].j) as unknown[];
}

async function table(ctx: Context, req: IncomingMessage, res: ServerResponse, url: URL, caller: Caller, name: string) {
  const method = req.method ?? "GET";
  const bodyText = method === "POST" || method === "PATCH" ? await readBody(req) : "";
  const pref = prefer(req);
  const result = await asCaller(ctx, caller, async (tx) => {
    const cols = await columnsOf(tx, name);
    if (!cols) {
      throw {
        status: 404,
        body: { code: "PGRST205", details: null, hint: null, message: `Could not find the table 'public.${name}' in the schema cache` },
      } satisfies HttpError;
    }
    const t = `public.${quoteIdent(name)}`;
    const params: unknown[] = [];

    if (method === "GET" || method === "HEAD") {
      const where = whereOf(url, cols, name, params);
      const rows = await jsonRows(tx, `select ${selectListOf(url, cols, name)} from ${t} ${where} ${orderOf(url, cols, name)}${limitOf(url)}`, params);
      let total = "*";
      if (pref.count) {
        const c = await tx.query<{ n: number }>(`select count(*)::int as n from ${t} ${where}`, params);
        total = String(c.rows[0].n);
      }
      const offset = Number(url.searchParams.get("offset") ?? 0);
      const range = rows.length ? `${offset}-${offset + rows.length - 1}/${total}` : `*/${total}`;
      return { ...shape(req, rows), headers: { "Content-Range": range } };
    }

    if (method === "POST") {
      const body: unknown = JSON.parse(bodyText || "null");
      const list = Array.isArray(body) ? body : [body];
      if (!list.every((r) => r && typeof r === "object" && !Array.isArray(r))) throw bad("Empty or invalid JSON body", "PGRST102");
      const given = url.searchParams.get("columns");
      const keys = given ? given.split(",").map((s) => s.trim()) : [...new Set(list.flatMap((r) => Object.keys(r as object)))];
      for (const k of keys) {
        if (!cols.has(k)) throw bad(`Could not find the '${k}' column of '${name}' in the schema cache`, "PGRST204");
      }
      params.push(JSON.stringify(list));
      const colList = keys.map(quoteIdent).join(", ");
      const insert = keys.length
        ? `insert into ${t} (${colList}) select ${colList} from json_populate_recordset(null::${t}, $1::json)`
        : `insert into ${t} default values`;
      if (!pref.representation) {
        await tx.query(insert, keys.length ? params : []);
        return { status: 201, body: undefined };
      }
      const rows = await jsonRows(
        tx,
        `select ${selectListOf(url, cols, name)} from _ins`,
        keys.length ? params : [],
        `with _ins as (${insert} returning *)`,
      );
      const shaped = written(req, rows);
      return { ...shaped, status: 201 };
    }

    if (method === "PATCH") {
      const body = JSON.parse(bodyText || "null") as Record<string, unknown> | null;
      if (!body || typeof body !== "object" || Array.isArray(body)) throw bad("Empty or invalid JSON body", "PGRST102");
      const keys = Object.keys(body);
      for (const k of keys) {
        if (!cols.has(k)) throw bad(`Could not find the '${k}' column of '${name}' in the schema cache`, "PGRST204");
      }
      params.push(JSON.stringify(body));
      const where = whereOf(url, cols, name, params);
      if (!keys.length) return { status: pref.representation ? 200 : 204, body: pref.representation ? [] : undefined };
      const colList = keys.map(quoteIdent).join(", ");
      const set =
        keys.length === 1
          ? `${colList} = (select ${colList} from json_populate_record(null::${t}, $1::json))`
          : `(${colList}) = (select ${colList} from json_populate_record(null::${t}, $1::json))`;
      const update = `update ${t} set ${set} ${where}`;
      if (!pref.representation) {
        await tx.query(update, params);
        return { status: 204, body: undefined };
      }
      const rows = await jsonRows(tx, `select ${selectListOf(url, cols, name)} from _up`, params, `with _up as (${update} returning *)`);
      return written(req, rows);
    }

    if (method === "DELETE") {
      const where = whereOf(url, cols, name, params);
      const del = `delete from ${t} ${where}`;
      if (!pref.representation) {
        await tx.query(del, params);
        return { status: 204, body: undefined };
      }
      const rows = await jsonRows(tx, `select ${selectListOf(url, cols, name)} from _del`, params, `with _del as (${del} returning *)`);
      return written(req, rows);
    }

    throw bad(`method ${method} not supported`, "PGRST117", 405);
  });
  send(req, res, result.status, result.body, "headers" in result ? (result.headers as Record<string, string>) : {});
}

type Fn = {
  argnames: string[];
  argtypes: string[];
  nargs: number;
  ndefaults: number;
  rettype: string;
  retset: boolean;
};

async function rpc(ctx: Context, req: IncomingMessage, res: ServerResponse, caller: Caller, name: string) {
  if (req.method !== "POST") throw bad(`only POST is supported for /rpc in the local stand-in`, "PGRST117", 405);
  const text = await readBody(req);
  const args = (text ? JSON.parse(text) : {}) as Record<string, unknown>;
  if (!args || typeof args !== "object" || Array.isArray(args)) throw bad("Empty or invalid JSON body", "PGRST102");
  const keys = Object.keys(args).filter((k) => args[k] !== undefined);
  const result = await asCaller(ctx, caller, async (tx) => {
    const found = await tx.query<Fn>(
      `select coalesce(p.proargnames[1:p.pronargs], '{}') as argnames,
              array(select format_type(t, null) from unnest(p.proargtypes) t) as argtypes,
              p.pronargs as nargs, p.pronargdefaults as ndefaults,
              format_type(p.prorettype, null) as rettype, p.proretset as retset
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = $1`,
      [name],
    );
    const fits = found.rows.filter((f) => {
      const required = f.argnames.slice(0, f.nargs - f.ndefaults);
      return keys.every((k) => f.argnames.includes(k)) && required.every((r) => keys.includes(r));
    });
    if (fits.length === 0) {
      throw {
        status: 404,
        body: {
          code: "PGRST202",
          details: `Searched for the function public.${name} with parameters ${keys.join(", ") || "(none)"} or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.`,
          hint: null,
          message: `Could not find the function public.${name}(${keys.join(", ")}) in the schema cache`,
        },
      } satisfies HttpError;
    }
    if (fits.length > 1) {
      throw {
        status: 300,
        body: { code: "PGRST203", details: null, hint: null, message: `Could not choose the best candidate function between several public.${name}` },
      } satisfies HttpError;
    }
    const fn = fits[0];
    if (fn.retset) throw bad(`set-returning function ${name} is not supported by the local stand-in`);
    const call = `public.${quoteIdent(name)}(${keys.map((k) => `${quoteIdent(k)} := _.${quoteIdent(k)}`).join(", ")})`;
    const from = keys.length
      ? ` from json_to_record($1::json) as _(${keys.map((k) => `${quoteIdent(k)} ${fn.argtypes[fn.argnames.indexOf(k)]}`).join(", ")})`
      : "";
    const params = keys.length ? [JSON.stringify(args)] : [];
    if (fn.rettype === "void") {
      await tx.query(`select ${call}${from}`, params);
      return { status: 204, body: undefined };
    }
    const r = await tx.query<{ j: string | null }>(`select to_json(${call})::text as j${from}`, params);
    return { status: 200, body: r.rows[0].j ?? "null" };
  });
  send(req, res, result.status, result.body);
}

export async function handleRest(ctx: Context, req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const caller = callerOf(ctx, req, url);
  if (isHttpError(caller)) return send(req, res, caller.status, caller.body);
  const path = url.pathname.replace(/^\/rest\/v1\/?/, "");
  try {
    if (path.startsWith("rpc/")) await rpc(ctx, req, res, caller, decodeURIComponent(path.slice(4)));
    else await table(ctx, req, res, url, caller, decodeURIComponent(path));
  } catch (error) {
    if (isHttpError(error)) return send(req, res, error.status, error.body);
    if (error instanceof SyntaxError) return send(req, res, 400, { code: "PGRST102", details: null, hint: null, message: "Empty or invalid json" });
    const code = (error as { code?: string }).code;
    if (!code) {
      console.error("[local-supabase] unexpected error", error);
      return send(req, res, 500, { code: null, details: null, hint: null, message: String(error) });
    }
    send(req, res, statusForSqlState(code, caller.role), pgErrorBody(error));
  }
}
