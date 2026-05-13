# Changelog

All notable changes to ClearPath UW are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)

## [Unreleased]

### Added
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
