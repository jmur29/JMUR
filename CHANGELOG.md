# Changelog

All notable changes to ClearPath UW are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)

## [Unreleased]

### Added
- CMHC default insurance premium calculator (`calculateCmhcPremium`) exported from engine — LTV tiers 80.01–85%→2.80%, 85.01–90%→3.10%, 90.01–95%→4.00%; premium capitalised onto `effectiveMortgage`; GDS/TDS recalculated using `effectiveMonthlyPayment` when insured; INFO flag with formatted dollar amount added on insured files
- `cmhcPremium`, `cmhcPremiumRate`, `effectiveMortgage`, and `effectiveMonthlyPayment` fields added to `UWResult`
- CMHC premium unit and integration tests (14 new cases) in `underwrite.test.ts`
- `requestId` middleware — attaches `x-request-id` UUID to every request/response, honouring upstream proxy headers
- `requestLogger` middleware — structured Winston log on every response finish with method, path, status, duration, IP, and requestId; 5xx→error, 4xx→warn, 2xx→info
- `compression` middleware (gzip) applied before all routes
- Improved `/health` endpoint — checks live DB connectivity via `SELECT 1`, returns `db`, `version`, and `env` fields; returns HTTP 503 when database is unreachable
- `GET /api/applications/search?q=` endpoint — searches fileNumber, borrower firstName/lastName, and email (case-insensitive) across tenant, returns top 10 `SearchResult` objects
- `POST /api/applications/:id/duplicate` endpoint — deep-copies borrowers+income, property, and mortgageTerms into a new DRAFT application; emits `APPLICATION_DUPLICATED` audit log entry
- Outbound webhook dispatcher (`services/webhooks.ts`) — POSTs HMAC-SHA256–signed JSON payloads to `WEBHOOK_URL` for events: `application.created`, `application.status_changed`, `decision.approved`, `decision.declined`, `decision.manual_review`, `document.uploaded`; signed via `X-ClearPath-Signature: sha256=<hmac>` header; silently skipped when `WEBHOOK_URL` is not configured
- Webhook dispatches integrated into `createApplication`, `updateApplication` (status change), and `saveDecision`
- OpenAPI 3.1 specification (`src/openapi.ts`) covering all major endpoints with full request/response schemas for Application, Borrower, Income, Property, MortgageTerms, UnderwritingDecision, UWResult, Document, PipelineStats, and Error
- `GET /api/docs` — serves OpenAPI spec as JSON
- `GET /api/docs/ui` — serves interactive Swagger UI (swagger-ui-express)
- `compression`, `swagger-ui-express`, `@types/compression`, `@types/swagger-ui-express` added to package.json
- `WEBHOOK_URL` and `WEBHOOK_SECRET` documented in `.env.example`
- `monthlyTrend` field in `getPipelineStats` — last 6 calendar months of application volume grouped by month, with approved/declined/inReview breakdown per month
- Startup environment validation via `validateEnv()` — required vars (DATABASE_URL, CLERK_SECRET_KEY, CLERK_WEBHOOK_SECRET, ENCRYPTION_KEY) are checked at boot; invalid ENCRYPTION_KEY format is caught with a descriptive error; optional vars emit warnings only
- Integration-level underwriting engine tests covering 6 end-to-end scenarios: clean approval, CMHC insured, stress test failure triggering MANUAL_REVIEW, full decline with multiple FAILs, self-employed 1-year NOA warning, and co-borrower income rescue
- Production Docker Compose (`docker-compose.prod.yml`) with pre-built GHCR images, postgres healthcheck, optional migrate service, internal/external network separation, and TLS cert volume mount

## [0.1.0] — 2026-05-13

### Added
- Initial release of ClearPath UW
- Full mortgage underwriting engine (GDS/TDS/LTV/stress test, OSFI B-20)
- Multi-tenant architecture with Clerk authentication
- Application lifecycle management (DRAFT → IN_REVIEW → APPROVED/DECLINED/CONDITIONALLY_APPROVED)
- Borrower management with AES-256 SIN encryption
- Income qualification by employment type (EMPLOYED, SELF_EMPLOYED, CONTRACT, RETIRED, OTHER)
- Property and mortgage terms management
- Automated underwriting decision engine with 14 flag rules
- Document management with AWS S3 storage
- PDF report generation via Puppeteer
- Application notes and timeline
- Conditional approval conditions checklist
- Audit log with full action history
- Tenant branding customization (logo, primary colour)
- Role-based access control (ADMIN, UNDERWRITER, VIEWER)
- CSV pipeline export
- Application status history tracking
- Email notifications for decisions and assignments
- GitHub Actions CI/CD pipeline
- Docker Compose for local development
- Production multi-stage Dockerfiles
- Comprehensive test suite (67 tests, 99% engine coverage)
