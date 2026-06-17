# The Murvota Open — Setup

A single static page (`public/index.html`) plus a Google Apps Script backend
(`Code.gs`) that records RSVPs in a Google Sheet. No build step, no framework.

```
murvota-open/
├─ public/
│  ├─ index.html     ← the site (inline CSS + JS)
│  └─ invite.png     ← drop Bri's PNG here (1200×630 for link previews)
├─ Code.gs           ← Google Apps Script Web App
├─ vercel.json       ← serves /public as the site root
└─ SETUP.md
```

---

## 1. Google Sheet + Apps Script (the backend)

1. Create a new Google Sheet (any name). A tab called **RSVPs** is created
   automatically on first write — you don't need to make it.
2. In the Sheet: **Extensions ▸ Apps Script**.
3. Delete the starter code, paste in the contents of **`Code.gs`**, and save.
4. **Deploy ▸ New deployment**.
   - Gear icon ▸ select **Web app**.
   - **Description:** Murvota RSVP
   - **Execute as:** **Me**
   - **Who has access:** **Anyone**
   - Click **Deploy**, grant the permissions it asks for.
5. Copy the **Web app URL** — it ends in `/exec`. That's your `SCRIPT_URL`.

> Re-deploying: use **Deploy ▸ Manage deployments ▸ ✏️ Edit ▸ Version: New version**
> so the `/exec` URL stays the same. Creating a brand-new deployment gives a new URL.

### How it talks to the page
- **POST** (submitting an RSVP) is sent with `mode:'no-cors'` and
  `Content-Type: text/plain;charset=utf-8`. That deliberately avoids the CORS
  preflight Apps Script can't answer, so it's **fire-and-forget** — the page
  can't read the response, which is fine.
- **GET** (loading the leaderboard) is tried as a normal cross-origin request
  first; if the browser blocks it, the page automatically falls back to a
  **JSONP** request (`?callback=…`), which `doGet` supports.

---

## 2. Wire up the site

Open `public/index.html`, find this line near the bottom and paste your URL:

```js
const SCRIPT_URL = "https://script.google.com/macros/s/XXXXXXXX/exec";
```

Drop the invite image at `public/invite.png` (ideally **1200×630**) so link
previews render. The page references it as `/invite.png`.

You can open `public/index.html` straight in a browser to check the layout.
The leaderboard only populates once `SCRIPT_URL` is set and deployed.

---

## 3. Deploy to Vercel

**Option A — Dashboard (recommended)**
1. Push this repo to GitHub and **Import** it at [vercel.com/new](https://vercel.com/new).
2. **Root Directory:** set to **`murvota-open`** (this subfolder).
3. **Framework Preset:** **Other**. Leave Build Command empty.
   `vercel.json` already points the output at `public/`.
4. **Deploy.**

**Option B — Vercel CLI**
```bash
cd murvota-open
npx vercel        # preview
npx vercel --prod # production
```

### After it's live: fix the link-preview image
Open Graph image paths should be absolute for some scrapers (iMessage, Twitter,
Facebook). Once you know the domain, update `public/index.html`:

```html
<meta property="og:image"   content="https://your-domain.vercel.app/invite.png" />
<meta name="twitter:image"  content="https://your-domain.vercel.app/invite.png" />
<meta property="og:url"     content="https://your-domain.vercel.app/" />
```

Re-share through Facebook's [Sharing Debugger](https://developers.facebook.com/tools/debug/)
or Twitter's Card Validator to bust their preview caches.

---

## Troubleshooting
- **Leaderboard empty after deploy:** confirm `SCRIPT_URL` ends in `/exec` and
  the deployment's *Who has access* is **Anyone**. Visit the `/exec` URL
  directly — you should see `{"ok":true,"rsvps":[...]}`.
- **RSVP not recording:** open the page's browser console; a `no-cors` POST
  shows as an "opaque" response (expected). Check the Sheet for a new row.
- **Changed `Code.gs` but nothing updated:** you deployed a *new* version under
  the same deployment? See the re-deploy note in step 1.
- **Preview image not showing:** make sure `public/invite.png` exists and use the
  absolute URL as above; social platforms cache aggressively.
