# TradPath — Master Specification

> Read this file before starting any work in this repo.
> If you're Claude Code in a fresh session: read this in full
> before touching code. This is the source of truth — not chat
> history, not memory, not a trigger phrase. This file.

We are building TradPath — a field service management platform
for small service businesses (HVAC, plumbing, electrical,
landscaping, junk removal). Think Jobber but simpler, faster,
and built for owner-operators running 1–20 employees.

Beta launch: September 2026. Build fast, build clean, BUILD SECURE.

Differentiators nobody else has for small operators:
- Voice memo to invoice in 60 seconds
- Dispute-proof photo work orders
- Built-in business texting
- One-tap job completion
- Owner morning briefing
- Flat-rate price book

---

## SECURITY REQUIREMENTS — NON-NEGOTIABLE

Apply to EVERY sprint. Never violate these.

**S1. TENANT ISOLATION** (most important rule in this codebase)
organizationId passed to any service method comes ONLY from
the authenticated JWT (req.user.orgId) — NEVER from req.body,
req.query, or req.params. Use the `@CurrentOrg()` param decorator
that extracts req.user.orgId in every controller. Every Prisma
query on tenant data includes organizationId in the where clause.
No exceptions.

**S2. TOKEN STORAGE**
Refresh tokens live in httpOnly, Secure, SameSite=Strict cookies —
NEVER localStorage. Access tokens (15 min) are returned in the
response body and held in memory only (Zustand store, not
persisted). On page refresh the client calls POST /auth/refresh
(cookie sent automatically) to get a new access token. Mobile app
stores tokens in expo-secure-store, never AsyncStorage.

**S3. REFRESH TOKEN FAMILIES + REUSE DETECTION**
Each refresh token belongs to a familyId. On rotation, the old
token is revoked and a new one issued in the same family. If a
REVOKED token is ever presented, revoke the ENTIRE family and
force re-login (stolen token detection). Store only the SHA-256
hash of refresh tokens in the DB.

**S4. PASSWORD RESET TOKENS**
Generate with nanoid(48). Store ONLY the SHA-256 hash. Compare
hashes on redemption. 1-hour expiry, single use.

**S5. MFA**
Encrypt mfaSecret at rest with AES-256-GCM using
MFA_ENCRYPTION_KEY from env. Rate-limit MFA verification: 5 failed
attempts = 15-minute lockout (tracked separately from password
lockout). Login flow returns a short-lived (5 min) signed
mfaChallengeToken — never the raw userId.

**S6. STRIPE WEBHOOKS**
The webhook endpoint MUST verify the stripe-signature header
against the RAW request body using stripe.webhooks.constructEvent().
With NestJS + Fastify, configure rawBody: true in the Fastify
adapter and use @Req() rawBody for this one route. Never trust
webhook payloads without signature verification. Never mark an
invoice paid from client-side code — only from verified webhooks
or authenticated manual recording.

**S7. JWT STRATEGY GUARDS**
In JwtStrategy.validate(): reject if user is null, if
user.isSuspended, if user.lockedUntil > now, or if the user's
organization has isSuspended = true. A suspended account dies
within 15 minutes even with a valid token.

**S8. PUBLIC ENDPOINT ABUSE PROTECTION**
All /book/* and /pay/* endpoints get:
- Per-IP rate limiting (10 req/min)
- Per-slug rate limiting (30 req/hour per booking slug)
- Cloudflare Turnstile verification on POST endpoints
  (TURNSTILE_SECRET_KEY in env, verify server-side)
- Input length caps on every free-text field

**S9. FILE UPLOADS**
Validate file type by MAGIC BYTES (file-type package), never by
extension or client MIME type. Limits: photos 10MB, voice memos
25MB, PDFs 15MB. Storage paths are always prefixed {orgId}/...
Work-order PDFs and signatures use Supabase SIGNED URLs (1-hour
expiry), not public URLs — they contain customer PII. Job photos
may be public bucket.

**S10. AI OUTPUT VALIDATION**
GPT-4o output is a DRAFT only. Server-side, validate every
returned line item: if priceBookId is present, the unitPrice MUST
match the price book value (reject mismatches). Items without a
priceBookId are flagged unmatched and require manual tech
confirmation. Cap AI-drafted invoice totals at $50,000 — anything
higher requires manual entry. Use a strict system prompt + JSON
schema response format + server-side validation as the real
defense (transcript sanitization alone is not reliable).

**S11. ADMIN SURFACE**
SuperAdminGuard applied at CONTROLLER level (@UseGuards on the
class) for every /admin controller — never per-endpoint.
Impersonation tokens expire in 1 hour, are read-only by default,
and EVERY action during impersonation writes an AuditLog row with
isSuperAdminAction: true.

**S12. HYGIENE**
- .gitignore from the FIRST commit: .env, .env.*, *.pem,
  node_modules, .next, dist, .expo
- Validation pipe global: whitelist: true,
  forbidNonWhitelisted: true, transform: true
- Helmet + compression + CORS locked to known origins
  (FRONTEND_URL, ADMIN_URL — no wildcards in production)
- Generic error messages on auth failures (never reveal whether
  email exists; locked accounts also return "Invalid credentials"
  with a Retry-After header)
- All secrets from env — zero hardcoded keys anywhere
- npm audit --production must pass with no high/critical before
  each sprint is marked done
- Structured logging (pino), NEVER log passwords, tokens, or full
  card data. Log authentication events (success, failure,
  lockout) with IP.

---

## TECH STACK

Frontend: Next.js 14 (App Router), TypeScript, Tailwind,
shadcn/ui, React Hook Form + Zod, TanStack Query, Zustand,
React Big Calendar, DnD Kit, Recharts, Axios
Backend: NestJS + Fastify (rawBody enabled), TypeScript, Prisma,
Bull, Passport JWT, pino logging
Database: Supabase PostgreSQL (DATABASE_URL + DIRECT_URL)
File storage: Supabase Storage (public + private buckets,
org-prefixed paths, signed URLs for PII documents)
Redis: Upstash (rediss:// TLS) for Bull queues + rate limiting
Payments: Stripe (payments + subscriptions)
SMS: Twilio (per-org provisioned numbers)
Email: SendGrid
AI: OpenAI Whisper + GPT-4o (JSON schema response format)
Maps: Google Maps API
Bot protection: Cloudflare Turnstile
Mobile: Expo React Native (SecureStore, EAS Build)
Hosting: Railway (API), Vercel (web + admin), Netlify
(marketing), Expo EAS (mobile)

Monorepo (Turborepo):
apps/web (owner dashboard), apps/admin (super admin),
apps/mobile (tech app), apps/api (NestJS),
packages/database, packages/types, packages/api-client

---

## DATABASE SCHEMA (Prisma → Supabase)

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

All ids cuid. All tenant tables carry organizationId with an
index. Timestamps createdAt/updatedAt throughout.

**Organization**: name, slug (unique), logo, phone, email,
website, address/city/state/zip, timezone, currency,
subscriptionPlan (STARTER|GROWTH|PRO), subscriptionStatus,
stripeCustomerId, stripeSubscriptionId, trialEndsAt, healthScore,
internalNotes, internalTags, isSuspended, isArchived, suspendedAt,
featureFlags Json, storageUsedBytes, aiCreditsUsed, bookingEnabled,
bookingSlug (unique), bookingPageTitle, bookingPageDescription,
bookingPageLogo, bookingPageColor, twilioPhoneNumber,
morningBriefingEnabled, morningBriefingTime,
morningBriefingChannel, defaultTaxRate, defaultInvoiceTerms,
defaultInvoiceDueDays

**User**: email (unique), passwordHash, firstName, lastName,
phone, avatarUrl, role (OWNER|MANAGER|EMPLOYEE|TECHNICIAN),
organizationId, emailVerified, mfaEnabled, mfaSecretEncrypted,
mfaFailedAttempts, mfaLockedUntil, isSuspended, lastLoginAt,
failedLoginCount, lockedUntil, isSuperAdmin, pushToken,
pushTokenWeb

**RefreshToken**: userId, tokenHash (unique — SHA-256), familyId,
expiresAt, revokedAt, replacedByTokenHash, ipAddress, userAgent,
platform (WEB|MOBILE|ADMIN)

**PasswordReset**: userId, tokenHash (unique — SHA-256),
expiresAt, usedAt

**AuditLog**: organizationId, userId, action, resource,
resourceId, oldValue Json, newValue Json, ipAddress, userAgent,
isSuperAdminAction, platform

**Customer**: organizationId, firstName, lastName, company, email,
phone, altPhone, serviceAddress, billingAddress, city/state/zip,
propertyType (RESIDENTIAL|COMMERCIAL), propertyDetails Json, tags,
source, notes, outstandingBalance, preferredContactMethod

**CustomerEquipment**: organizationId, customerId, name, type,
make, model, serialNumber, installDate, warrantyExpiry,
lastServiceDate, nextServiceDate, notes, photos Json

**PriceBook**: organizationId, name, description, category
(LABOR|MATERIAL|SERVICE), unitPrice, unit, taxable, isActive,
sortOrder

**ServiceCategory**: organizationId, name, description, icon,
isActive, sortOrder

**ServiceOffering**: organizationId, categoryId, name,
description, duration, price, priceType
(FIXED|STARTING_AT|FREE_ESTIMATE), isActive, isBookable,
sortOrder, requiredPhotos Json

**JobPhotoCheckpoint**: organizationId, serviceOfferingId, label,
required, phase (BEFORE|DURING|AFTER), sortOrder

**BookingRequest**: organizationId, firstName, lastName, email,
phone, serviceAddress, city/state/zip, propertyType,
serviceOfferingId, requestedDate, requestedTimeSlot, notes,
status (PENDING|CONFIRMED|DECLINED|CANCELLED), convertedToJobId,
convertedAt, source, confirmationCode, ipAddress

**BookingAvailability**: organizationId, dayOfWeek, startTime,
endTime, isActive
**BookingBlackout**: organizationId, date, reason

**Job**: organizationId, customerId, bookingRequestId, jobNumber,
title, description, status
(SCHEDULED|IN_PROGRESS|ON_HOLD|COMPLETED|CANCELLED), priority
(LOW|NORMAL|HIGH|URGENT), type (ONE_TIME|RECURRING),
serviceAddress, city/state/zip, latitude, longitude,
scheduledStart, scheduledEnd, actualStart, actualEnd,
estimatedDuration, assignedUserIds, laborCost, materialCost,
totalRevenue, profit, internalNotes, customerNotes,
completionNotes, servicePlanId, onMyWaySentAt,
completionFlowStartedAt, completionFlowCompletedAt, voiceMemoUrl,
voiceMemoTranscript, aiInvoiceDraft Json, createdBy

**JobPhoto**: jobId, uploadedBy, url, thumbnailUrl, type
(BEFORE|AFTER|DURING|SIGNATURE|DOCUMENT), checkpointId,
lineItemIndex, isCustomerVisible, caption, latitude, longitude,
takenAt, platform

**JobTextMessage**: jobId, organizationId, customerId, direction
(INBOUND|OUTBOUND), body, twilioSid, sentAt, deliveredAt,
createdBy

**Estimate**: organizationId, customerId, jobId, estimateNumber
(unique per org), title, status
(DRAFT|SENT|VIEWED|APPROVED|DECLINED|EXPIRED|CONVERTED),
validUntil, lineItems Json, subtotal, taxRate, taxAmount,
discountAmount, total, notes, termsAndConditions, sentAt,
viewedAt, approvedAt, signatureUrl, pdfUrl, createdBy

**Invoice**: organizationId, customerId, jobId, estimateId,
servicePlanId, invoiceNumber (unique per org), status
(DRAFT|SENT|VIEWED|PARTIAL|PAID|OVERDUE|VOID), type
(ONE_TIME|SUBSCRIPTION), dueDate, lineItems Json, subtotal,
taxRate, taxAmount, discountAmount, total, amountPaid, amountDue,
notes, termsAndConditions, stripePaymentIntentId,
stripePaymentLinkUrl, stripeInvoiceId, includePhotos, photoUrls
Json, sentAt, viewedAt, paidAt, followUp1SentAt, followUp2SentAt,
followUp3SentAt, createdBy

**StripeEvent**: id (Stripe event id, PK), type, processedAt
— for webhook idempotency
> Implemented in this repo as `WebhookEvent` (cuid `id` PK +
> unique `eventId` field holding the Stripe event id, plus
> `type`/`processedAt`). Functionally equivalent — idempotency is
> still a unique constraint on the Stripe event id — just a
> naming/shape difference from this spec. Not treated as a bug;
> noted here so it isn't "rediscovered" as a regression later.

**Payment**: invoiceId, organizationId, amount, method
(STRIPE|CASH|CHECK|BANK_TRANSFER|OTHER), stripePaymentId,
reference, notes, paidAt, createdBy

**ServicePlan**: organizationId, customerId, name, description,
status (ACTIVE|PAUSED|CANCELLED|EXPIRED), billingCycle
(MONTHLY|ANNUAL), price, stripePriceId, stripeSubscriptionId,
nextBillingDate, nextServiceDate, serviceFrequency
(WEEKLY|BIWEEKLY|MONTHLY|QUARTERLY|BIANNUAL|ANNUAL),
serviceDescription, assignedUserIds, autoGenerateJobs,
autoSendInvoice, jobTemplate Json, discountPercent, startDate,
endDate, cancelledAt, cancelReason, isPublic, publicName,
publicDescription, createdBy

**ServicePlanJob**: servicePlanId, jobId, scheduledFor,
generatedAt
**ServicePlanInvoice**: servicePlanId, invoiceId,
billingPeriodStart, billingPeriodEnd, generatedAt

**TimeEntry**: organizationId, userId, jobId, clockIn, clockOut,
clockInLat/Lng, clockOutLat/Lng, breakMinutes, totalHours,
overtimeHours, regularHours, status
(ACTIVE|COMPLETED|APPROVED|REJECTED), notes, approvedBy,
approvedAt, platform

**ScheduleEvent**: organizationId, jobId, title, description,
assignedUserIds, start, end, allDay, color, recurrenceRule,
reminderSentAt

**Notification**: organizationId, userId, type, title, message,
read, readAt, link, platform

**SupportTicket**: organizationId, userId, title, description,
status, priority, assignedTo, resolvedAt

**PlatformAnnouncement**: title, message, type, targetPlans,
publishedAt, expiresAt, createdBy

**FeatureFlag**: key (unique), label, description, defaultEnabled,
enabledForPlans
**OrganizationFeatureFlag**: organizationId, flagKey, enabled,
overriddenBy, overriddenAt

---

## SPRINT PLAN

There are **18 sprints**, using a mixed numeric + lettered scheme
(the letters — 4B, 4C, 4D, 4E, 6B, 8B — mark features that were
slotted in between originally-numbered sprints, so counting plain
integers gets you 12, not 18):

| # | Sprint | Status |
|---|---|---|
| 1 | Auth + Infrastructure | ✅ Done |
| 2 | Jobs | ✅ Done |
| 3 | Customers (CRM) | ✅ Done |
| 4 | Estimates + Invoices | ✅ Done |
| 4B | Recurring Service Plans | ✅ Done |
| 4C | Public Booking Page | ✅ Done — Turnstile coded but never verified against a real Turnstile account |
| 4D | Invoice Payment Page | ✅ Done |
| 4E | The Differentiators | ✅ Done — Twilio texting coded but never verified against a real Twilio account |
| 5 | Scheduling | ✅ Done |
| 6 | Time Tracking | ✅ Done |
| 6B | AI Voice-to-Invoice | ✅ Done — coded + S10-validated, but never verified against real OpenAI (Whisper/GPT-4o) |
| 7 | Photos + Work Order Docs | ✅ Done |
| 8 | Reports + Settings | ✅ Done — live-verified; 2 real bugs found & fixed during verification (MRR trend timezone mislabel, Reports cache never hitting) |
| 8B | Onboarding | ⚠️ Code complete, **not yet verified with a real SendGrid send** per this sprint's own note below — SendGrid API key not yet connected |
| 9 | Super Admin Portal | ✅ Done — live-verified end to end (guards, MFA, impersonation, all 9 sections) |
| 10 | Marketing Website | ⬜ Not started |
| 11 | PWA | ⬜ Not started |
| 12 | React Native Tech App | ⬜ Not started (Sprint 1 scaffold only: expo-router shell, SecureStore, tab stubs) |

Mark each row done as you complete it. Update this table in the
same commit that finishes the sprint.

### Sprint 1 — Auth + Secure Infrastructure

1. **Monorepo**: Turborepo with all apps/packages. FIRST FILE
   COMMITTED IS .gitignore (S12). .env.example with every
   variable. docker-compose.yml runs Redis ONLY (DB is Supabase).
2. **Prisma**: full schema above. Seed: 1 org
   (bookingSlug "demo-hvac"), 1 owner, 2 technicians,
   3 customers with equipment, 2 jobs, 1 public service plan,
   5 price book items, 2 categories, 3 bookable offerings,
   Mon–Fri 8-5 availability.
3. **API security core**: Fastify adapter with rawBody: true;
   @fastify/cookie with COOKIE_SECRET; Helmet, compression,
   CORS locked to FRONTEND_URL + ADMIN_URL; global
   ValidationPipe per S12; Swagger at /api/docs (dev only);
   pino logger redacting auth headers/cookies/passwords;
   PrismaModule (global); ConfigModule with env validation
   (refuses to boot on missing vars or JWT_SECRET < 32 chars);
   @CurrentUser() / @CurrentOrg() decorators — @CurrentOrg() is
   the ONLY way controllers obtain orgId; Throttler backed by
   Upstash Redis.
4. **Auth implementation** (S2–S5, S7): register, login (lockout,
   MFA challenge token), mfa/verify (attempt lockout, decrypt,
   TOTP verify), refresh (cookie read, hash lookup, family reuse
   detection, rotate), logout (revoke family, clear cookie),
   forgot/reset-password (S4), /me, /push-token. Admin auth:
   /admin/auth/login (isSuperAdmin only, MFA required),
   impersonate endpoints (S11).
5. **Web app** (:3000): Next.js 14, Tailwind, shadcn/ui,
   PWA-ready shell. Auth store: access token IN MEMORY ONLY;
   silent refresh on mount. Axios client with
   withCredentials: true and single-flight refresh queue on 401.
   Pages: /auth/*, /dashboard (protected), /book/[slug]* and
   /pay/[invoiceId] (public). DashboardLayout: navy sidebar
   (#1B2A4A), full nav.
6. **Admin portal** (:3002): separate app, separate cookie name
   (admin_refresh), purple theme (#7C3AED), dark sidebar
   (#0F172A), SuperAdminGuard on every controller class.
   Scaffold pages (content Sprint 9).
7. **Mobile** (Expo scaffold): expo-router, tokens in
   SecureStore, tab shell (Today, Jobs, Clock, Messages,
   Profile). Content in Sprint 12.
8. **Storage service** (Supabase, S9): uploadPhoto / uploadPDF /
   uploadVoiceMemo / getSignedUrl / deleteFile. Magic-byte
   validation, size caps, {orgId}/{folder}/{uuid}.{ext} paths.
   Photos → public bucket. PDFs + signatures → private bucket,
   1-hour signed URLs.

**Sprint 1 done = all green:**
- [x] .gitignore excludes .env* (verify: `git status` shows no env)
- [x] docker-compose up starts Redis; Supabase connected
- [x] prisma db push + seed run clean
- [x] API boots :3001, refuses to boot with missing env vars
- [x] Register/login work; refresh token arrives as httpOnly
      cookie (verify in devtools — NOT in localStorage)
- [x] Reusing a rotated refresh token revokes the family
- [x] Locked account returns same message as bad password
- [x] /auth/me works; suspended user rejected within 15 min
- [x] Admin login requires isSuperAdmin (+ MFA path stubbed)
- [x] /book/demo-hvac public endpoints return seed data and are
      rate limited (verify with 15 rapid requests)
- [x] Upload rejects a .exe renamed to .jpg (magic bytes)
- [x] web :3000, admin :3002, mobile runs in Expo Go
- [ ] npm audit --production: no high/critical — **currently
      FAILING: 18 high-severity findings** (see Verification
      Notes below). Not remediated at any sprint boundary so far.
- [x] All stub modules compile, zero TS errors

### Sprint 2 — Jobs

Endpoints: GET/POST /jobs, GET/PATCH/DELETE /jobs/:id,
PATCH /jobs/:id/status, GET /jobs/today, GET /jobs/dashboard,
POST /jobs/:id/on-my-way, POST/GET /jobs/:id/photos,
POST /jobs/:id/complete, GET /jobs/:id/work-order-pdf (signed URL).

Every controller: @UseGuards(JwtAuthGuard), @CurrentOrg() orgId.
Every service query filters by orgId. Verify assignedUserIds
belong to the same org before saving. Status transitions
validated server-side.

Web: /dashboard/jobs (list + kanban, filters, search), /new, /[id],
/[id]/edit, /[id]/complete. Job detail: status button, On My Way
(SMS + GPS link), crew avatars, photo checkpoints, notes,
estimate/invoice links, directions, customer + equipment cards,
messages tab. One-tap completion flow (7 steps): required photos
→ voice/typed notes → parts+labor → invoice review → signature →
send+collect → done (PDF generated).

### Sprint 3 — Customers (CRM)

CRUD + /customers/:id/{jobs,invoices,estimates,service-plans,
equipment,messages}. Equipment CRUD nested under customer.
All org-scoped (S1). Web: list/search, /new, /[id] profile with
equipment cards, balances, histories, message thread, quick
actions.

### Sprint 4 — Estimates & Invoices

Estimates: CRUD, /send, /convert-to-job. Invoices: CRUD, /send,
/payment-intent, /record-payment, /ar-summary. Server computes
ALL totals from line items — never trust client-side math.
Invoice numbers unique per org via transaction-safe counter.

Stripe webhook (S6): POST /stripe/webhook with raw-body signature
verification. Handles payment_intent.succeeded,
invoice.payment_succeeded/failed, subscription updated/deleted.
Idempotent via StripeEvent table.

Public pay page /pay/[invoiceId]: white-label, Stripe Elements,
rate-limited (S8). Receipt auto-emailed.

Auto follow-up (Bull): day 3/7/14 SMS+email, stops when paid.

### Sprint 4B — Recurring Service Plans

CRUD + pause/resume/cancel + /generate-job + dashboard (MRR/ARR
cards). Stripe Product+Price+Subscription creation; store IDs.
Bull queues: JobGenerator (6am), BillingProcessor (7am),
ReminderSender (8am), ExpiryChecker (9am) — per-org-timezone
aware, idempotent (check ServicePlanInvoice for the billing
period before creating). Webhook-driven status sync (S6).

### Sprint 4C — Public Booking Page

Public: GET /book/:slug, /services, /availability?date=, /plans;
POST /request and /subscribe — BOTH with Turnstile verification +
per-slug and per-IP rate limits (S8). Free-text fields capped
(notes ≤ 1000 chars). Confirmation code, SMS+email to customer,
notification to owner. /subscribe: match-or-create customer by
email, create plan, Stripe subscription via Elements.

Dashboard: /dashboard/booking (pending list, confirm → creates
Job+Customer, decline, reschedule), /booking/settings
(availability, blackouts, bookable services/plans, branding,
enable/disable, copy link). Mobile-first public UI, company
branding, white-label (no TradPath branding).

### Sprint 4D — Invoice Payment Page

Covered in Sprint 4 (/pay/[invoiceId]). Confirm rate limits +
cuid-only IDs + payment state changes ONLY via verified webhook
or authenticated manual recording.

### Sprint 4E — The Differentiators

1. **Price book**: CRUD + search + CSV import (validate rows, cap
   500/import). Used by estimates, completion flow, AI.
2. **Equipment history**: pre-arrival visibility, warranty
   alerts, service log, next-service reminders.
3. **Business texting**: per-org Twilio number provisioning,
   unified inbox /dashboard/messages, threads, templates, Twilio
   inbound webhook (VALIDATE X-Twilio-Signature), match to
   customer by phone.
4. **On my way**: button → GPS capture → SMS with Maps link →
   timestamp logged.
5. **Morning briefing**: Bull processor, per-org time+timezone,
   SMS/push summary (jobs today, AR, clocked in, bookings,
   renewals). Settings page.
6. **One-tap completion**: built in Sprint 2.
7. **Auto invoice follow-up**: built in Sprint 4.

### Sprint 5 — Scheduling

Events CRUD (org-scoped, assignees validated as org members).
React Big Calendar: day/week/month, drag-drop reschedule, color
by status/assignee, crew filter, unscheduled sidebar, slide-in
job panel, create from calendar. Recurring + booking-sourced jobs
visually distinct.

### Sprint 6 — Time Tracking

clock-in/out, break start/end, /active, entries CRUD, approve,
timesheets. Server sets timestamps (client time never trusted);
GPS coords validated as plausible. A user can only clock
themselves; managers edit with audit log entries. Overtime calc
(>8/day, >40/wk). CSV export.

### Sprint 6B — AI Voice-to-Invoice

POST /ai/transcribe — audio upload (magic bytes, ≤25MB) →
Whisper → save memo URL + transcript to job.

POST /ai/generate-invoice-draft — jobId + transcript → GPT-4o with
org price book context, response_format: json_schema. Returns
lineItems[{description, quantity, unitPrice, priceBookId,
confidence}], laborHours, jobNotes, unmatchedItems[].

Server-side validation (S10): matched items' unitPrice must equal
price book value; quantities capped at 999; total cap $50k; draft
saved to aiInvoiceDraft — an Invoice row is created ONLY when the
tech confirms. Track aiCreditsUsed per org; enforce plan limits
(Growth 50/mo, Pro unlimited) server-side.

UI: hold-to-record, live waveform, streaming transcript, green
matched / yellow unmatched, manual fallback always available.

### Sprint 7 — Photos + Work Order Docs

Photo checkpoints per service offering; completion blocked until
required checkpoints fulfilled (server-enforced, not just UI).
Before/after embed on invoices (toggle). Signature capture →
private bucket → signed URL. Auto PDF work order on completion
(header, job, customer, equipment, notes, parts, labeled photos,
both signatures, GPS+timestamp, total, payment status) → private
bucket → signed URL emailed to customer. Dashboard widgets:
today's jobs, 7-day schedule, pending bookings, AR, clocked-in,
revenue MoM, plan MRR, renewals, unread messages, quick actions,
activity feed.

### Sprint 8 — Reports + Settings

Reports: revenue (one-time vs recurring), MRR trend + ARR,
profit-per-job (green/red margins), completion rate, avg job
value, top customers, employee hours, AR aging, plan
growth/churn, booking conversion, AI usage. PDF/CSV export.
Org-scoped queries; heavy aggregates cached in Redis (5-min TTL).

Settings: company profile, Stripe billing portal, team (invite
via emailed single-use token — hashed like S4; role changes
audit-logged; only OWNER can change roles), notifications,
business hours, tax/invoice defaults, morning briefing, booking
settings, services, price book, QuickBooks/Xero.

### Sprint 8B — Onboarding

In-app checklist (7 items, progress bar, confetti). SendGrid
sequence day 0/1/3/5/7/10/12/14 via Bull EmailSequenceProcessor —
skips steps when the action is already done, stops on upgrade.
Unsubscribe link honored (suppression list check before every
send).

**Note (added mid-build):** this sprint is functionally
untestable without a real, connected SendGrid account — the whole
point of the sprint is confirming the right email fires at the
right time. Don't mark it done on code review alone; verify with
a real send.

### Sprint 9 — Super Admin Portal

SuperAdminGuard at controller class level on ALL /admin
controllers (S11). Super admins MUST have MFA enabled.

Sections: Executive dashboard (companies, users, MRR/ARR, plan
MRR, bookings, trials, churn, AI usage, failed payments, storage,
health, tickets); Company management (list, detail,
suspend/reactivate/archive/delete, reset trial, transfer
ownership, impersonate, export — destructive actions require
typed confirmation + audit log); User management (login history,
sessions, force reset, unlock, disable, revoke sessions); Billing
(subscriptions, plan-MRR breakdown, trials, failed payments,
refunds, coupons); Feature flags (global + per-org overrides,
audit-logged); Audit logs (filterable, JSON diff, CSV export);
System health (API, DB, Redis, all Bull queues,
OpenAI/Twilio/SendGrid/S3/Stripe webhook status, error rate,
failed-job retry); Support tickets; Announcements; Reports;
Customer success (at-risk signals).

Impersonation: 1-hour token, read-only default, fixed banner in
apps/web, every action audit-logged.

**Note (added mid-build):** this is internal tooling — nobody
outside your business sees it. It has no bearing on whether a
real customer signs up. Don't let its size make it feel like
product progress; it's infrastructure.

### Sprint 10 — Marketing Website

Pages: /, /pricing, /features (+ per-feature deep dives),
/industries/{hvac,plumbing,electrical,landscaping}, /blog, /about,
/contact, /privacy, /terms (privacy + terms are REQUIRED for App
Store approval).

Homepage: hero "Run every job. Get paid faster.", problem section,
feature cards (voice invoice featured), 3-step how it works,
voice-invoice demo section, booking highlight, testimonials,
pricing with monthly/annual toggle (annual = 20% off: 39/119/239),
final CTA. SEO meta + OG tags + sitemap. Deploy target: Netlify.

### Sprint 11 — PWA

next-pwa in apps/web: manifest (name TradPath, standalone, theme
#2563EB, full icon set, shortcuts: New Job, Clock In), service
worker (static cache + API cache for jobs/customers, background
sync queue for offline status updates/notes/photos, offline
fallback page). Web push (permission on login, token →
/auth/push-token). Custom install prompt. Mobile-responsive audit
of every dashboard page at 375px: sidebar → bottom tabs ≤768px,
tables → card lists, 44px touch targets. Camera via input capture
(compress ≤1MB before upload). Geolocation clock-in with manual
fallback.

### Sprint 12 — React Native Tech App

Expo managed, bundle com.tradpath.app, EAS profiles
(development/preview/production). Tokens in SecureStore, biometric
unlock (expo-local-authentication).

Tabs: Today (greeting, today's jobs, quick clock-in), Jobs
(search/filter/list), Job Detail (customer card w/ tap-to-call,
equipment, action buttons: Clock In / On My Way / Start /
Complete, photo tabs, messages, native maps directions),
Completion flow (6 steps: photos w/ native camera → hold-to-record
voice w/ live transcript → AI parts+labor review → invoice
preview → finger signature → send/collect, confetti), Clock (live
elapsed, GPS in/out, breaks, weekly summary), Messages (threads,
templates), Profile (biometrics toggle, notifications, sign out).

Push via expo-notifications (tap → deep link to screen). Offline:
cache today's + assigned jobs, queue actions, sync on reconnect,
server wins conflicts, offline banner. Certificate pinning for
api.tradpath.com in production builds. eas.json submit config for
App Store + Play.

---

## PRICING

Starter $49 | Growth $149 (popular) | Pro $299
Annual: $39 / $119 / $239. 14-day trial, no card.

Plan limits ENFORCED SERVER-SIDE (users, service plans, booking
requests, SMS, AI credits) — never client-side only.

---

## BULL QUEUES

ServicePlan{JobGenerator,BillingProcessor,ReminderSender,
ExpiryChecker}, MorningBriefingProcessor, EmailSequenceProcessor,
InvoiceFollowUpProcessor, AITranscriptionProcessor,
NotificationProcessor, PushNotificationProcessor,
OfflineSyncProcessor.

All: 3 retries, exponential backoff, dead-letter queue, idempotency
keys, visible in admin system health.

> Implemented and visible in Super Admin System Health (Sprint 9):
> invoice-follow-up, service-plan-job-generator,
> service-plan-billing, service-plan-reminder, service-plan-expiry,
> equipment-alerts, morning-briefing, onboarding-email-sequence.
> AITranscriptionProcessor, NotificationProcessor,
> PushNotificationProcessor, and OfflineSyncProcessor are not
> separate Bull queues in the current implementation — AI
> transcription runs synchronously in the request/response cycle
> (OpenAI call inside the HTTP handler, not queued), and
> notification/push/offline-sync queues haven't been built yet
> (no sprint has required them so far; PWA background sync in
> Sprint 11 and mobile offline sync in Sprint 12 will likely need
> to add real queues for those).

---

## THIRD-PARTY SERVICES CHECKLIST

Required before validating Sprints 1–8B in production (not just
locally):

| Service | Used for | Required by | Status |
|---|---|---|---|
| Supabase | DB + file storage | Sprint 1 | ✅ Connected (dev + prod) |
| Upstash | Redis / Bull / rate limiting | Sprint 1 | ✅ Connected (dev + prod) |
| Railway | API hosting | deploy | ✅ Deployed, live, healthy |
| Vercel | Web + admin hosting | deploy | ⬜ Not yet deployed |
| Stripe | Payments, subscriptions, webhooks | Sprint 4, 4B | ⚠️ Test key present but is the literal `sk_test_xxx` placeholder — not a real Stripe account. Webhook not yet pointed at Railway. |
| SendGrid | Transactional + sequence email | Sprint 8B | ⬜ Not connected — domain verification not started |
| Twilio | SMS, business texting | Sprint 4C, 4E | ⬜ Not connected |
| OpenAI | Voice-to-invoice | Sprint 6B | ⬜ Not connected — Sprint 6B never verified against a real Whisper/GPT-4o call |
| Google Maps | On-my-way links | Sprint 4E | ⬜ Not connected |
| Turnstile | Bot protection on public forms | Sprint 4C/4D | ⬜ Not connected — Sprint 4C/4D never verified against real Turnstile |
| Expo/EAS | Mobile builds | Sprint 12 | ⬜ Not yet needed (Sprint 12 not started) |
| Apple/Google Play | App store listing | Sprint 12 | ⬜ Not yet needed (Sprint 12 not started) |

**Rule of thumb established during the build:** don't wait until
every sprint is code-complete to connect real credentials.
Integration bugs (Stripe webhook signature verification, Supabase
pooling behavior, SendGrid domain auth, Twilio number
provisioning) only surface against real services. Connect and
smoke-test each service as its sprint is finished, not in one
batch at the end.

> **Current gap against that rule of thumb:** Sprints 4C, 4E, 6B,
> and 8B are all code-complete (and pass their server-side
> validation logic under test/mocked conditions) but have never
> been exercised against their real third-party service — Turnstile,
> Twilio, OpenAI, and SendGrid respectively all still have empty
> or placeholder credentials. This was flagged during a
> spec-compliance review rather than caught sprint-by-sprint as
> intended. Recommended order to close this out: Stripe webhook →
> SendGrid → Twilio → OpenAI → Turnstile (roughly matching
> immediate deploy needs first, then sprint order).

---

## CHANGE LOG

Keep this section updated with major decisions so future sessions
(yours or Claude Code's) don't have to reconstruct the reasoning
from chat history that may no longer exist.

- Product originally scoped as "CommandGrid" (multi-company
  operating system, broad SaaS ambition) → renamed and re-scoped
  as "Muster" → renamed and re-scoped a final time as **TradPath**,
  narrowed specifically to single field-service owner-operators
  (1–20 employees), based on ICP interview.
- Full security audit performed on the original build; found
  critical issues (tokens in localStorage, no Stripe webhook
  signature verification, orgId potentially trusted from client,
  unhashed reset/refresh tokens, unencrypted MFA secrets). Full
  Sprint 1 codebase was rebuilt from zero with S1–S12 baked in
  from the first commit, rather than retrofitted.
- Stack changed from AWS (RDS/S3/ElastiCache/EC2) to
  Supabase + Upstash + Railway + Vercel — same pattern as
  PalletBill, lower ops overhead for a solo builder.
- Considered adding a Google Business Profile / Search Console
  integration sprint (SEO analytics). Deliberately deferred —
  it's a real chunk of OAuth + dashboard work unrelated to the
  core job-to-payment loop, and doesn't close deals the way
  voice-to-invoice or booking pages do. If revisited, it belongs
  after Sprint 12, as a Pro-tier add-on, not before beta.
- This file did not exist in the repo until a spec-compliance
  review after Sprint 9 — it's created here for the first time,
  backfilled with an honest status pass across all 18 sprints
  rather than assumed done. Two concrete gaps surfaced by that
  review: (1) `npm audit --production` currently reports 18
  high-severity findings (root packages: `next` — requires a
  major version bump, 14→16, affecting both apps/web and
  apps/admin; `@xmldom/xmldom` and `turbo-stream` — both
  transitive deps of apps/mobile's Expo tooling only, not yet
  deployed/live) that were never remediated at any sprint
  boundary, violating S12; (2) Sprints 4C, 4E, 6B, and 8B are
  code-complete but have never been verified against their real
  third-party service (Turnstile, Twilio, OpenAI, SendGrid
  respectively) — all four still run on empty or placeholder
  credentials. Neither gap blocks Sprint 9 from being considered
  done on its own terms (guards/impersonation/audit logging were
  all live-verified), but both should be resolved before the
  September 2026 beta launch.
