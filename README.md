# Aura-D Studio — Phase 1 Starter Slice

> **Want a real, permanent URL instead of just local dev?** See `DEPLOY.md`
> for a 15-20 minute step-by-step guide (Vercel + Neon, both free to start).
> This README covers running it locally first, which is worth doing once
> before deploying.

This is the first working vertical slice of Aura-D Studio: a real, runnable
Next.js app that takes you from **signup → connect a real AI API key → run
the SEO Article module → see the result in Asset Library with its
Generation Recipe**.

It's intentionally a *subset* of the full Phase 1 scope (spec §16) — the
architecture (auth → workflow → run → node_execution → asset) is real and
matches `Aura-D_Studio_Schema.sql`, but only one module (SEO Article) is
wired up end-to-end so far. Other Phase 1 modules (Character Engine,
video/ad pipeline, Social Content) get added the same way, module by module.

## Stack

Lean stack for solo/early-stage development (see chat for the reasoning vs.
the full spec §15 stack):

- **Next.js 14** (App Router) + TypeScript + Tailwind — frontend & API routes in one codebase
- **Prisma** + **PostgreSQL** — database
- **NextAuth** (credentials provider) — auth
- **Anthropic API** called directly via `fetch` — no SDK dependency, easy to read

## Prerequisites

- Node.js 20+
- Docker (for local Postgres/Redis) — or point `DATABASE_URL` at any Postgres you already have
- A real Anthropic API key to test with (get one free to start at https://console.anthropic.com — spec §5.7.1 Free-Tier)

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Start local Postgres + Redis
docker compose up -d

# 3. Configure environment
cp .env.example .env
# Generate two secrets and paste them into .env:
openssl rand -base64 32   # → NEXTAUTH_SECRET
openssl rand -base64 32   # → CREDENTIAL_ENCRYPTION_KEY

# 4. Create database tables
npx prisma migrate dev --name init

# 5. Seed the AI Provider Registry (Claude, GPT, Gemini reference data)
npm run db:seed

# 6. Start the app
npm run dev
```

Open http://localhost:3000

## Try it end-to-end

1. **Sign up** — creates your account + your first team (`app_user` + `team` + `team_member`, spec §13.1)
2. Go to **Connected AI** → add your real Anthropic API key
   - This fires a real test call to `api.anthropic.com` before saving (spec §5.2 Auto-Detection Flow)
   - The key is encrypted with AES-256-GCM before it touches the database (`src/lib/encryption.ts`) — check the `credential` table in `npx prisma studio` and you'll see only ciphertext, never the plain key
3. Go to **เขียนบทความ SEO** → fill in a topic + keyword → pick the AI you just connected → **สร้างบทความ**
   - This creates real `workflow` / `run` / `node_execution` rows, calls the real Claude API, and saves the result as an `asset`
4. Go to **คลังไฟล์** → see your article, tap the heart to favorite it (spec §4.6.2)
5. Click into the article → **Generation Recipe** view showing which AI model actually generated it and the credit cost (spec §4.6.1)

## Project structure

```
prisma/schema.prisma       Database schema (subset of Aura-D_Studio_Schema.sql)
prisma/seed.ts             AI Provider Registry seed data
src/lib/db.ts               Prisma client singleton
src/lib/auth.ts             NextAuth config
src/lib/encryption.ts        AES-256-GCM helpers for API key storage
src/lib/ai/anthropic.ts       Real Anthropic API wrapper (test key + generate text)
src/app/api/...               API routes (signup, credentials, workflows, assets)
src/app/(dashboard)/...         Pages (Connected AI, SEO Article wizard, Asset Library)
```

## What's deliberately NOT here yet (next slices to build)

- Other AI providers' real test-call functions (only Anthropic is wired up — add one function per provider in `src/lib/ai/`, same pattern)
- Character Engine, video/ad pipeline, Social Content modules
- Canvas Mode (Phase 2)
- Background job queue (BullMQ + Redis) — the SEO Article call currently runs synchronously inside the API route, which is fine for fast text generation but won't work for slow video generation later
- Free-Tier API Key auto-detection is approximated (a 429 on a trivial test ping is treated as "likely free tier") — refine once you've seen real rate-limit headers from each provider

## A note on secrets

`CREDENTIAL_ENCRYPTION_KEY` in `.env` is fine for local development only.
Before any real user's API key touches a deployed version of this app, move
that key into a real secrets manager (AWS Secrets Manager / HashiCorp Vault
— spec §15), not a `.env` file on a server.
