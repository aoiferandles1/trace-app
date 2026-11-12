import { createHash } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { type Context } from "./context.ts";
import { verifyJwt } from "./jwt.ts";

/**
 * Supabase Realtime's postgres_changes, the part Trace uses (/realtime/v1):
 * a WebSocket speaking the Phoenix protocol (serializer 1.0.0 and 2.0.0 text
 * frames), channels joined with postgres_changes bindings, heartbeats,
 * access_token updates and leaves. Changes come from a trigger the stand-in
 * adds to every table in the supabase_realtime publication (pg_notify), and
 * each subscriber only receives a row its own role can select (RLS), as on
 * the hosted project. Broadcast and presence are accepted but carry nothing.
 *
 * The WebSocket framing is written out here (no dependency): text, close,
 * ping and pong frames, which is all a browser sends.
 */

const GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const CHANNEL = "local_realtime";

/** SQL run once after the migrations: a trigger on every published table. */
export const REALTIME_SQL = `
create schema if not exists local_realtime;
create or replace function local_realtime.notify() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_notify('${CHANNEL}', json_build_object(
    'type', tg_op,
    'schema', tg_table_schema,
    'table', tg_table_name,
    'commit_timestamp', to_json(now()),
    'record', case when tg_op <> 'DELETE' then row_to_json(new) end,
    'old_record', case when tg_op <> 'INSERT' then row_to_json(old) end
  )::text);
  return null;
end $$;
do $$
declare r record;
begin
  for r in select schemaname, tablename from pg_publication_tables where pubname = 'supabase_realtime' loop
    execute format('create trigger local_realtime_notify after insert or update or delete on %I.%I
                    for each row execute function local_realtime.notify()', r.schemaname, r.tablename);
  end loop;
end $$;
`;

type Binding = { id: number; event: string; schema: string; table: string; filter?: string };
type Channel = { topic: string; joinRef: string | null; bindings: Binding[]; claims: Record<string, unknown> | null };
type Socket = { send(msg: unknown[]): void; channels: Map<string, Channel>; v2: boolean };

type Change = {
  type: "INSERT" | "UPDATE" | "DELETE";
  schema: string;
  table: string;
  commit_timestamp: string;
  record: Record<string, unknown> | null;
  old_record: Record<string, unknown> | null;
};

let nextBindingId = 1;

function frame(text: string): Buffer {
  const payload = Buffer.from(text, "utf8");
  const len = payload.length;
  const head = len < 126 ? Buffer.alloc(2) : len < 65536 ? Buffer.alloc(4) : Buffer.alloc(10);
  head[0] = 0x81;
  if (len < 126) head[1] = len;
  else if (len < 65536) {
    head[1] = 126;
    head.writeUInt16BE(len, 2);
  } else {
    head[1] = 127;
    head.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([head, payload]);
}

function matchesFilter(filter: string | undefined, row: Record<string, unknown> | null): boolean {
  if (!filter) return true;
  if (!row) return false;
  const m = /^([A-Za-z_][A-Za-z0-9_]*)=(eq|neq|in)\.(.*)$/.exec(filter);
  if (!m) return false;
  const [, col, op, value] = m;
  const actual = row[col] == null ? null : String(row[col]);
  if (op === "eq") return actual === value;
  if (op === "neq") return actual !== value;
  return value.replace(/^\(|\)$/g, "").split(",").includes(actual ?? "");
}

export function createRealtime(ctx: Context) {
  const sockets = new Set<Socket>();

  async function visible(claims: Record<string, unknown> | null, change: Change): Promise<boolean> {
    if (change.type === "DELETE") return true; // Realtime sends deletes without an RLS check (old row's key only).
    const id = change.record?.id;
    if (!claims || id == null || change.schema !== "public") return false;
    const role = claims.role === "authenticated" ? "authenticated" : "anon";
    try {
      return await ctx.exclusive(() =>
        ctx.db.transaction(async (tx) => {
          await tx.query(`select set_config('role', $1, true), set_config('request.jwt.claims', $2, true)`, [role, JSON.stringify(claims)]);
          const r = await tx.query(`select 1 from public."${change.table.replace(/"/g, "")}" where id = $1`, [id]);
          return r.rows.length > 0;
        }),
      );
    } catch {
      return false;
    }
  }

  async function deliver(change: Change) {
    for (const socket of sockets) {
      for (const channel of socket.channels.values()) {
        const ids = channel.bindings
          .filter(
            (b) =>
              (b.event === "*" || b.event.toUpperCase() === change.type) &&
              (b.schema === "*" || b.schema === change.schema) &&
              (!b.table || b.table === "*" || b.table === change.table) &&
              matchesFilter(b.filter, change.record ?? change.old_record),
          )
          .map((b) => b.id);
        if (!ids.length || !(await visible(channel.claims, change))) continue;
        const oldRecord = change.type === "INSERT" ? {} : change.type === "DELETE" ? { id: change.old_record?.id } : (change.old_record ?? {});
        socket.send([
          channel.joinRef,
          null,
          channel.topic,
          "postgres_changes",
          {
            ids,
            data: {
              schema: change.schema,
              table: change.table,
              commit_timestamp: change.commit_timestamp,
              type: change.type,
              record: change.record ?? {},
              old_record: oldRecord,
              columns: [],
              errors: null,
            },
          },
        ]);
      }
    }
  }

  void ctx.db.listen(CHANNEL, (payload) => {
    let change: Change;
    try {
      change = JSON.parse(payload) as Change;
    } catch {
      return;
    }
    void deliver(change);
  });

  function claimsOf(token: unknown): Record<string, unknown> | null {
    if (typeof token !== "string" || !token) return null;
    if (token === ctx.publishableKey) return { role: "anon" };
    const r = verifyJwt(token, ctx.jwtSecret);
    return r.ok ? r.claims : null;
  }

  function onMessage(socket: Socket, text: string, defaultClaims: Record<string, unknown> | null) {
    let joinRef: string | null, ref: string | null, topic: string, event: string, payload: Record<string, unknown>;
    try {
      const msg = JSON.parse(text) as unknown;
      if (Array.isArray(msg)) [joinRef, ref, topic, event, payload] = msg as [string | null, string | null, string, string, Record<string, unknown>];
      else {
        const o = msg as { join_ref?: string; ref?: string; topic: string; event: string; payload: Record<string, unknown> };
        [joinRef, ref, topic, event, payload] = [o.join_ref ?? null, o.ref ?? null, o.topic, o.event, o.payload];
      }
    } catch {
      return;
    }
    const reply = (response: Record<string, unknown>, status = "ok") =>
      socket.send([joinRef, ref, topic, "phx_reply", { status, response }]);

    if (topic === "phoenix" && event === "heartbeat") return reply({});
    if (event === "phx_join") {
      const config = (payload?.config ?? {}) as { postgres_changes?: Omit<Binding, "id">[] };
      const bindings = (config.postgres_changes ?? []).map((b) => ({ ...b, id: nextBindingId++ }));
      socket.channels.set(topic, {
        topic,
        joinRef,
        bindings,
        claims: claimsOf(payload?.access_token) ?? defaultClaims,
      });
      reply({ postgres_changes: bindings.map(({ id, event: e, schema, table, filter }) => ({ id, event: e, schema, table, filter })) });
      if (bindings.length) {
        socket.send([joinRef, null, topic, "system", { message: "Subscribed to PostgreSQL", status: "ok", extension: "postgres_changes", channel: topic.replace(/^realtime:/, "") }]);
      }
      return;
    }
    if (event === "access_token") {
      const ch = socket.channels.get(topic);
      if (ch) ch.claims = claimsOf(payload?.access_token) ?? ch.claims;
      return;
    }
    if (event === "phx_leave") {
      socket.channels.delete(topic);
      return reply({});
    }
    if (ref) reply({});
  }

  function upgrade(req: IncomingMessage, sock: Duplex, url: URL) {
    const key = req.headers["sec-websocket-key"];
    if (!url.pathname.startsWith("/realtime/v1/websocket") || typeof key !== "string" || url.searchParams.get("apikey") !== ctx.publishableKey) {
      sock.end("HTTP/1.1 401 Unauthorized\r\n\r\n");
      return;
    }
    const accept = createHash("sha1").update(key + GUID).digest("base64");
    sock.write(
      "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n" + `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
    );
    const v2 = (url.searchParams.get("vsn") ?? "1.0.0").startsWith("2");
    const socket: Socket = {
      v2,
      channels: new Map(),
      send(msg) {
        if (sock.destroyed) return;
        const [joinRef, ref, topic, event, payload] = msg;
        sock.write(frame(JSON.stringify(v2 ? msg : { join_ref: joinRef, ref, topic, event, payload })));
      },
    };
    sockets.add(socket);
    const defaultClaims: Record<string, unknown> = { role: "anon" };
    let buf = Buffer.alloc(0);
    sock.on("data", (chunk: Buffer) => {
      buf = Buffer.concat([buf, chunk]);
      for (;;) {
        if (buf.length < 2) return;
        const opcode = buf[0] & 0x0f;
        const masked = (buf[1] & 0x80) !== 0;
        let len = buf[1] & 0x7f;
        let off = 2;
        if (len === 126) {
          if (buf.length < 4) return;
          len = buf.readUInt16BE(2);
          off = 4;
        } else if (len === 127) {
          if (buf.length < 10) return;
          len = Number(buf.readBigUInt64BE(2));
          off = 10;
        }
        const maskOff = off;
        if (masked) off += 4;
        if (buf.length < off + len) return;
        const data = Buffer.from(buf.subarray(off, off + len));
        if (masked) for (let i = 0; i < data.length; i++) data[i] ^= buf[maskOff + (i % 4)];
        buf = buf.subarray(off + len);
        if (opcode === 0x1) onMessage(socket, data.toString("utf8"), defaultClaims);
        else if (opcode === 0x8) {
          sock.end(Buffer.from([0x88, 0x00]));
          return;
        } else if (opcode === 0x9) sock.write(Buffer.concat([Buffer.from([0x8a, data.length]), data]));
      }
    });
    const drop = () => sockets.delete(socket);
    sock.on("close", drop);
    sock.on("error", drop);
  }

  return { upgrade, close: () => sockets.forEach((s) => s.channels.clear()) };
}
