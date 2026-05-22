# ClearPath UW

> Residential mortgage underwriting platform for Canadian credit unions and institutional lenders.

ClearPath UW digitizes and automates the residential mortgage underwriting workflow — replacing paper-based adjudication with a structured, auditable, and configurable digital process.

---

## Features

- **Full Application Management** — Create and track mortgage files from submission through decision
- **Underwriting Engine** — Automated GDS/TDS/LTV calculations with OSFI B-20 stress testing
- **Multi-Tenant** — White-label ready with per-tenant branding, isolated data
- **Role-Based Access** — Admin, Underwriter, and Viewer roles
- **Document Management** — Drag-and-drop uploads with S3 storage and status workflow
- **PDF Reports** — Printable underwriting reports with lender branding
- **Audit Trail** — Complete audit log for every action

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS |
| Backend | Node.js + Express + TypeScript |
| Database | PostgreSQL + Prisma ORM |
| Auth | Clerk (multi-tenant JWT) |
| Storage | AWS S3 |
| PDF | Puppeteer |
| Email | Nodemailer |
| Deployment | Docker Compose |

---

## Prerequisites

- Node.js 20+
- Docker & Docker Compose
- A [Clerk](https://clerk.com) account (free tier works for dev)
- AWS account with S3 bucket (or use local file storage for dev)

---

## Quick Start

### 1. Clone and configure

```bash
git clone <repo-url>
cd clearpath-uw
cp .env.example .env
```

Fill in your `.env` values — at minimum:
- `CLERK_SECRET_KEY` and `VITE_CLERK_PUBLISHABLE_KEY` (from Clerk dashboard)
- `ENCRYPTION_KEY` (run `openssl rand -hex 32`)
- AWS credentials (or leave blank and the server will log upload attempts without storing)

### 2. Start with Docker Compose

```bash
docker-compose up --build
```

This starts:
- PostgreSQL on port 5432
- Express API on port 3001
- React dev server on port 5173

### 3. Run database migrations and seed

```bash
# In a new terminal
cd server
npm install
npx prisma migrate dev --name init
npm run db:seed
```

### 4. Open the app

- **App:** http://localhost:5173
- **API:** http://localhost:3001
- **Prisma Studio:** `cd server && npm run db:studio`

---

## Development (Without Docker)

### Backend

```bash
cd server
npm install
cp ../.env.example .env   # fill in values
npx prisma generate
npx prisma migrate dev --name init
npm run db:seed
npm run dev
```

### Frontend

```bash
cd client
npm install
npm run dev
```

---

## Clerk Setup

1. Create a Clerk application at https://dashboard.clerk.com
2. Copy `CLERK_SECRET_KEY` to `.env`
3. Copy `VITE_CLERK_PUBLISHABLE_KEY` to `.env`
4. In Clerk dashboard, add a webhook endpoint:
   - URL: `https://your-domain.com/api/webhooks/clerk`
   - Events: `user.created`, `user.updated`
   - Copy the signing secret to `CLERK_WEBHOOK_SECRET` in `.env`

---

## Underwriting Engine

The underwriting engine (`server/src/engine/underwrite.ts`) implements:

| Metric | Formula |
|--------|---------|
| GDS | (P+I + Tax/12 + Heat + Condo×0.5) / MonthlyIncome |
| TDS | GDS + Other Obligations / MonthlyIncome |
| LTV | Mortgage / min(Purchase, Appraised) |
| Stress Rate | max(Contract Rate + 2%, 5.25%) |

**OSFI B-20 Thresholds:**

| Ratio | Guideline | Hard Cap |
|-------|-----------|----------|
| GDS | 35% | 39% |
| TDS | 40% | 44% |
| LTV | 80% (CMHC) | 95% |

---

## API Reference

All routes require `Authorization: Bearer <clerk-token>` header.
All responses are JSON. Errors return `{ error: string, code: string }`.

### Applications
```
GET    /api/applications          List (paginated)
POST   /api/applications          Create
GET    /api/applications/:id      Full file with all relations
PATCH  /api/applications/:id      Update status/assignment
DELETE /api/applications/:id      Soft delete
```

### Underwriting
```
POST   /api/applications/:id/calculate    Run engine (no save)
POST   /api/applications/:id/decision     Save decision
```

### Documents
```
POST   /api/applications/:id/documents    Upload (multipart)
GET    /api/applications/:id/documents    List
PATCH  /api/documents/:id                 Update status
DELETE /api/documents/:id                 Delete
```

### Reports
```
GET    /api/applications/:id/report       Generate PDF
```

---

## Environment Variables

See `.env.example` for full documentation of all required variables.

---

## Roles & Permissions

| Action | ADMIN | UNDERWRITER | VIEWER |
|--------|-------|-------------|--------|
| View applications | Yes | Yes | Yes |
| Create/edit applications | Yes | Yes | — |
| Run calculations | Yes | Yes | — |
| Issue decisions | Yes | Yes | — |
| Manage documents | Yes | Yes | Yes |
| Manage users | Yes | — | — |
| View admin pipeline | Yes | — | — |

---

## Demo Accounts

After seeding, two demo accounts are available (sign in via Clerk):
- **Admin:** admin@democu.ca
- **Underwriter:** uw@democu.ca

---

## Folder Structure

```
/
├── client/                 React Vite application
│   └── src/
│       ├── components/     Reusable UI components
│       ├── pages/          Route-level page components
│       ├── hooks/          Custom React hooks
│       ├── lib/            API client, utilities
│       └── types/          TypeScript interfaces
├── server/                 Express API
│   ├── prisma/             Prisma schema + migrations
│   └── src/
│       ├── engine/         Underwriting calculation engine
│       ├── routes/         Express route definitions
│       ├── controllers/    Request handlers
│       ├── services/       Business logic
│       ├── middleware/      Auth, validation, errors
│       └── utils/          Crypto, file numbers, logging
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## License

Proprietary — All rights reserved. Contact for licensing.
