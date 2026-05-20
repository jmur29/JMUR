# Deploying ClearPath UW to Railway

## Prerequisites

1. [Railway account](https://railway.app) (free to start)
2. [Clerk account](https://clerk.com) (free tier)
3. [Anthropic API key](https://console.anthropic.com) (for AI features)
4. AWS account with S3 + Textract access (for document storage/OCR)

---

## Step 1 — Clerk Setup (15 min)

1. Go to [clerk.com](https://clerk.com) → Create application
2. Copy your keys:
   - `CLERK_SECRET_KEY` (starts with `sk_live_` or `sk_test_`)
   - `VITE_CLERK_PUBLISHABLE_KEY` (starts with `pk_live_` or `pk_test_`)
3. In Clerk Dashboard → Webhooks → Add endpoint:
   - URL: `https://your-server-domain.railway.app/api/webhooks/clerk`
   - Events: `user.created`, `user.updated`, `user.deleted`
   - Copy the `Signing Secret` → this is your `CLERK_WEBHOOK_SECRET`

**Setting user roles:** After a user signs up, go to Clerk Dashboard → Users → click user → Metadata → Public metadata → add:
```json
{ "role": "UNDERWRITER" }
```
Valid roles: `ADMIN` | `UNDERWRITER` | `BROKER` | `VIEWER`

---

## Step 2 — AWS Setup (20 min)

1. Create S3 bucket in `ca-central-1` region
   - Block all public access: ON
   - Note the bucket name → `S3_BUCKET`
2. IAM → Create user → Attach policies:
   - `AmazonS3FullAccess`
   - `AmazonTextractFullAccess` (only needed for AI Review feature)
3. Create access key → note `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`

---

## Step 3 — Railway Deploy (20 min)

### Create the project

1. [railway.app/new](https://railway.app/new) → **Deploy from GitHub repo**
2. Connect your GitHub account → select `JMUR` repo
3. Railway will detect the monorepo

### Add PostgreSQL

In your Railway project → **+ New** → **Database** → **PostgreSQL**
- Railway automatically sets `DATABASE_URL` — copy it for your own records

### Add the Server service

1. **+ New** → **GitHub Repo** → select `JMUR`
2. Set **Root Directory**: `server`
3. Railway will use `server/railway.json` automatically
4. Set environment variables (see below)

### Add the Client service

1. **+ New** → **GitHub Repo** → select `JMUR`
2. Set **Root Directory**: `client`
3. Railway will use `client/railway.json` automatically
4. Set environment variables (see below)

---

## Environment Variables

### Server service

| Variable | Value |
|---|---|
| `DATABASE_URL` | (auto-set by Railway Postgres addon) |
| `NODE_ENV` | `production` |
| `PORT` | `3001` |
| `CLERK_SECRET_KEY` | From Clerk dashboard |
| `CLERK_WEBHOOK_SECRET` | From Clerk webhook setup |
| `ENCRYPTION_KEY` | Run `openssl rand -hex 32` — keep this safe |
| `AWS_ACCESS_KEY_ID` | From AWS IAM |
| `AWS_SECRET_ACCESS_KEY` | From AWS IAM |
| `AWS_REGION` | `ca-central-1` |
| `S3_BUCKET` | Your S3 bucket name |
| `ANTHROPIC_API_KEY` | From console.anthropic.com |
| `CORS_ORIGIN` | Your client Railway URL (e.g. `https://clearpath-client.up.railway.app`) |

### Client service

| Variable | Value |
|---|---|
| `VITE_CLERK_PUBLISHABLE_KEY` | From Clerk dashboard |
| `VITE_API_URL` | Your server Railway URL (e.g. `https://clearpath-server.up.railway.app`) |

---

## First Deploy Checklist

- [ ] PostgreSQL service is running (green)
- [ ] Server deployed and `/health` returns `{ "status": "ok", "db": "ok" }`
- [ ] Migrations applied automatically via `prisma migrate deploy` (release command)
- [ ] Seed the database once: Railway server → **Shell** → `npm run db:seed`
- [ ] Client deployed and accessible
- [ ] Sign up in Clerk → set your role to `ADMIN` in Clerk metadata
- [ ] Sign in to ClearPath UW ✓

---

## Custom Domain (optional)

Railway Dashboard → your client service → **Settings** → **Domains** → Add custom domain → point your DNS CNAME to the Railway URL.

---

## Minimum Cost Estimate

| Service | Cost |
|---|---|
| Railway Hobby plan | $5/mo |
| Railway Postgres | ~$1/mo (500MB) |
| S3 storage | ~$0.02/GB |
| Textract OCR | ~$1.50/1000 pages |
| Anthropic API | Pay per use (~$3/1M tokens) |
| Clerk | Free up to 10,000 MAU |
| **Total** | **~$7/mo** |
