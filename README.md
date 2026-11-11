# Trace

A health record you own and share with your doctor only when you say so. You generate a 4-digit code, the doctor types it into a web page, you see who is asking and tap Allow, and they read a scoped, read-only record with a timer running.

Trace is a portfolio project by Aoife Randles (UX/UI design), not a medical service. The design and research are written up at [aoiferandles.com/trace](https://aoiferandles.com/trace/).

## Stack

Next.js 16 (App Router, TypeScript), Tailwind CSS 4, Supabase (Postgres with row-level security, Auth, Realtime) through `@supabase/ssr`, Playwright with axe for end-to-end and accessibility tests. Hosted on Vercel.

## Getting started

```bash
cp .env.example .env.local   # then fill in the values
npm install
npm run dev                  # http://localhost:3000
```

| Script | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | Route types + TypeScript |
| `npm run test:e2e` | Playwright tests, including axe on the UI kit |

In development, `/kit` shows every UI component in every state.

## Docs

- `PLAN.md`: the build plan and the decisions behind it.
- `CLAUDE.md`: conventions for anyone (or any agent) working on the code.
- `docs/REVIEW.md`: new screens, new copy and accessibility substitutions waiting for the designer's review.
