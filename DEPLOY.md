# Deploy to a real, permanent URL — Vercel + Neon (both have free tiers)

Total hands-on time: ~15-20 minutes. Every command below is copy-paste-able.
This gets you a real `https://your-app.vercel.app` URL that stays up
permanently (no "sleeping" like some free tiers), separate from your local
dev setup in README.md.

Why Vercel + Neon: Vercel is built by the Next.js team (zero-config deploys,
generous free tier), Neon is serverless Postgres with a free tier and gives
you the pooled + direct connection strings Prisma needs (already wired up
in `prisma/schema.prisma`). No credit card required for either at this scale.

---

## 1. Push this code to GitHub (~3 min)

```bash
cd aura-d-studio
git init
git add .
git commit -m "Aura-D Studio Phase 1 starter"
```

Go to https://github.com/new, create an empty repo (don't initialize with a
README), then:

```bash
git remote add origin https://github.com/YOUR_USERNAME/aura-d-studio.git
git branch -M main
git push -u origin main
```

## 2. Create a free Postgres database on Neon (~3 min)

1. Go to https://neon.tech → sign up (GitHub login is fastest) → "Create a project"
2. Once created, click **Connection Details** on the dashboard
3. You need **two** connection strings — toggle "Pooled connection":
   - **Pooled** (toggle ON) → this is your `DATABASE_URL`
   - **Direct** (toggle OFF) → this is your `DIRECT_URL`
4. Copy both somewhere — you'll paste them into Vercel in step 4

## 3. Import the project into Vercel (~3 min)

1. Go to https://vercel.com → sign up with GitHub
2. Click **Add New → Project** → select the `aura-d-studio` repo you just pushed
3. Vercel auto-detects Next.js — don't change any build settings
4. **Don't click Deploy yet** — go to **Environment Variables** first (next step)

## 4. Set environment variables in Vercel (~3 min)

In the same import screen (or Project → Settings → Environment Variables),
add these 4:

| Key | Value |
|---|---|
| `DATABASE_URL` | the **pooled** Neon connection string from step 2 |
| `DIRECT_URL` | the **direct** Neon connection string from step 2 |
| `NEXTAUTH_SECRET` | run `openssl rand -base64 32` locally, paste the output |
| `NEXTAUTH_URL` | leave blank for now — you'll add this in step 6 |
| `CREDENTIAL_ENCRYPTION_KEY` | run `openssl rand -base64 32` again (a **different** value than NEXTAUTH_SECRET), paste the output |

Now click **Deploy**.

## 5. Run the database migration once (~3 min)

The build will succeed, but the tables don't exist in Neon yet. From your
own machine, pointed at the **production** database:

```bash
# Use the DIRECT (non-pooled) Neon connection string here
DATABASE_URL="paste-your-neon-DIRECT-url-here" npx prisma migrate deploy
DATABASE_URL="paste-your-neon-DIRECT-url-here" npm run db:seed
```

This only needs to be run once (and again any time you change
`prisma/schema.prisma` in the future).

## 6. Set NEXTAUTH_URL to your real deployed URL (~2 min)

1. After the first deploy finishes, Vercel shows you the live URL (e.g. `https://aura-d-studio-xyz123.vercel.app`)
2. Go to Project → Settings → Environment Variables → edit `NEXTAUTH_URL` → paste that exact URL (with `https://`, no trailing slash)
3. Go to the **Deployments** tab → click **Redeploy** on the latest deployment (env var changes need a redeploy to take effect)

## Done — test it

Open your Vercel URL → sign up → add a real Claude API key → generate an
article → check Asset Library. Same flow as local dev, now on a real,
permanent URL anyone can reach.

---

## Optional: point your own domain at it

Once you've registered a domain (see the earlier chat checklist — check the
trademark first): Vercel → Project → Settings → Domains → add your domain →
follow the DNS records Vercel shows you → add it to `NEXTAUTH_URL` too →
redeploy.

## What this doesn't cover yet

- Moving `CREDENTIAL_ENCRYPTION_KEY` out of plain environment variables into
  a real secrets manager (spec §15) — fine for early testing, revisit before
  handling real users' paid API keys at scale
- A staging environment separate from production (Vercel gives you preview
  deployments per git branch automatically, which covers a lot of this for free)
- Background job queue (Redis/BullMQ) — not needed until a module does
  something slow enough to need it (e.g. video generation)
