# Deploying ClearPath UW

## Architecture (cost-optimized)

| Layer | Platform | Cost |
|---|---|---|
| **Frontend** (React/Vite static) | Vercel | **Free** |
| **Backend** (Node.js + Chromium) | Railway | ~$5–7/mo |
| **Database** (PostgreSQL) | Railway (same project) | ~$1–3/mo |
| **Document storage** | AWS S3 ca-central-1 | ~$0.50/mo |
| **OCR** (AI Review feature) | AWS Textract | ~$1.50/1000 pages |
| **AI features** | Anthropic API | ~$3/1M tokens |
| **Auth** | Clerk | Free (≤10k MAU) |
| **Total** | | **~$7–12/mo** |

Why this split: The client is a static Vite build (HTML/CSS/JS) — Vercel hosts it
for free with a global CDN and instant rollbacks. The server must stay on Railway
because it runs Chromium for PDF generation, which needs ~512MB RAM and
isn't suitable for serverless.

---

## Step 1 — Accounts (5 min)

Sign up for all four:
- [railway.app](https://railway.app) (connect GitHub during signup)
- [vercel.com](https://vercel.com) (connect GitHub during signup)
- [clerk.com](https://clerk.com)
- AWS account (for S3 + Textract)

---

## Step 2 — Clerk Setup (15 min)

1. Clerk Dashboard → **Create application** → choose "Email + Password"
2. **API Keys** page → copy:
   - `CLERK_SECRET_KEY` (starts with `sk_live_` or `sk_test_`)
   - `VITE_CLERK_PUBLISHABLE_KEY` (starts with `pk_live_` or `pk_test_`)
3. **Webhooks** → Add endpoint:
   - URL: `https://<your-railway-server-domain>/api/webhooks/clerk`
     *(you'll get this URL after Step 4 — come back to fill it in)*
   - Subscribe to: `user.created`, `user.updated`, `user.deleted`
   - Copy the **Signing Secret** → this is `CLERK_WEBHOOK_SECRET`

**Setting user roles** (after first login):
Go to Clerk Dashboard → **Users** → click a user → **Metadata** tab →
**Public metadata** → paste:
```json
{ "role": "ADMIN" }
```
Valid values: `ADMIN` | `UNDERWRITER` | `BROKER` | `VIEWER`

---

## Step 3 — AWS Setup (20 min)

### S3 bucket
1. AWS Console → **S3** → **Create bucket**
   - Region: `ca-central-1` (required for Canadian data residency)
   - Block all public access: ✅ ON
   - Note the bucket name
2. **Bucket policy** — add this to allow presigned URL uploads:
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "AWS": "arn:aws:iam::<YOUR_ACCOUNT_ID>:user/clearpath-app" },
    "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
    "Resource": "arn:aws:s3:::<YOUR_BUCKET_NAME>/*"
  }]
}
```

### IAM user
1. IAM → **Users** → **Create user** → name: `clearpath-app`
2. **Attach policies directly**:
   - `AmazonS3FullAccess`
   - `AmazonTextractFullAccess` ← only needed for AI Review
3. **Security credentials** → **Create access key** → Application running outside AWS
4. Copy `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`

---

## Step 4 — Railway: Server + Database (20 min)

### Create project
1. [railway.app/new](https://railway.app/new) → **Deploy from GitHub repo**
2. Select your `JMUR` repository
3. Railway prompts "Configure service" → set **Root Directory** to `server`
4. It detects `server/railway.json` and uses the Dockerfile automatically

### Add PostgreSQL
In your Railway project dashboard:
- Click **+ New** → **Database** → **Add PostgreSQL**
- Railway automatically injects `DATABASE_URL` into all services in the project ✅

### Server environment variables
Go to your server service → **Variables** tab → add all of these:

```
NODE_ENV=production
PORT=3001
CLERK_SECRET_KEY=sk_live_...
CLERK_WEBHOOK_SECRET=whsec_...
ENCRYPTION_KEY=<run: openssl rand -hex 32>
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=ca-central-1
S3_BUCKET=your-bucket-name
ANTHROPIC_API_KEY=sk-ant-...
CORS_ORIGIN=https://your-app.vercel.app
```

> ⚠️ **ENCRYPTION_KEY** encrypts SIN numbers. Generate it once with
> `openssl rand -hex 32` and **never change it** — rotating it
> invalidates all stored SINs.

> `CORS_ORIGIN` is your Vercel URL from Step 5 — add it after deploying.

### Get your server domain
After first deploy → Settings → **Domains** → copy the Railway-generated URL
(e.g. `https://jmur-server.up.railway.app`). You'll need this for:
- The Clerk webhook URL (go back and update Step 2)
- The `VITE_API_URL` in Vercel (Step 5)

### First-time database seed
Railway dashboard → server service → **Shell** tab:
```bash
npm run db:seed
```
Run this once after the first successful deploy.

---

## Step 5 — Vercel: Frontend (10 min)

1. [vercel.com/new](https://vercel.com/new) → **Import Git Repository** → select `JMUR`
2. **Configure project**:
   - Framework: **Vite** (auto-detected)
   - Root Directory: `client`
   - Build Command: `npm run build` (auto-detected)
   - Output Directory: `dist` (auto-detected)
3. **Environment Variables**:
   ```
   VITE_CLERK_PUBLISHABLE_KEY=pk_live_...
   VITE_API_URL=https://jmur-server.up.railway.app
   ```
4. Click **Deploy** → ~60 seconds → you get a URL like `https://jmur.vercel.app`

5. Go back to Railway → server service → Variables → update:
   ```
   CORS_ORIGIN=https://jmur.vercel.app
   ```
   Railway auto-redeploys.

### Custom domain (optional)
Vercel → your project → **Settings** → **Domains** → add `app.yourcreditunion.ca`
Point a CNAME record to `cname.vercel-dns.com`. SSL is automatic.

---

## Step 6 — First Login Checklist

- [ ] Railway server is green (health check passing at `/health`)
- [ ] `prisma migrate deploy` ran in the release phase (check deploy logs)
- [ ] Database seeded via Shell tab
- [ ] Vercel client is live and loads
- [ ] Sign up via Clerk on your live app
- [ ] Set your role to `ADMIN` in Clerk publicMetadata
- [ ] Sign in — you should land on the dashboard ✅

---

## Auto-Deploy on Push

Both platforms watch your `claude/clearpath-uw-setup-dGjfW` branch (or `main`
once you merge). Every `git push`:
- **Railway**: rebuilds Docker image, runs `prisma migrate deploy`, restarts
- **Vercel**: rebuilds Vite bundle, deploys to CDN globally in ~30s

---

## Backup & Recovery

**Database backups**: Railway Postgres takes daily backups automatically on the
Hobby plan (7-day retention). Download via Railway dashboard → database → **Backups**.

**Encryption key**: Store `ENCRYPTION_KEY` in a password manager separately.
Losing it means SIN data is unrecoverable.

**S3**: Enable versioning on your bucket for document recovery.

---

## Scaling (when you need it)

| Trigger | Action | Cost delta |
|---|---|---|
| PDF generation slow | Increase Railway RAM to 1GB | +$5/mo |
| DB getting large | Upgrade Railway Postgres | +$10/mo |
| > 10k Clerk users | Clerk Pro | +$25/mo |
| High Textract volume | AWS bill scales linearly | ~$1.50/1000 pages |
