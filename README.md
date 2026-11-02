# AcadTrack

A responsive academic workspace built with Next.js, React, TypeScript, Tailwind CSS, shadcn-style Radix components, Lucide, Recharts, FullCalendar, and Supabase.

## Run locally

Use the moon/sun button in the workspace header, administration header, or login
page to switch between dark and light mode. The choice applies immediately and is
remembered in this browser; authenticated workspace/admin changes also update the
account preference. **Settings → Theme → System preference** follows the device's
appearance and responds to system changes. Saved browser preferences are applied
before the page paints, including after refresh or navigation.

Use Node.js 22 or later and npm or pnpm.

```sh
npm install
npm run dev
```

Open http://127.0.0.1:3000. On this Windows workspace, you can also run:

```powershell
powershell -File .\scripts\Start-AcadTrack.ps1
```

Without Supabase environment variables, AcadTrack starts in **local workspace mode**. Records persist in localStorage in the current browser. It starts empty; the optional example workspace button adds editable sample records. Export backups from Settings. Local mode has no accounts, cloud uploads, or reminders while the browser is closed. Local records are not automatically transferred into a cloud account.

## Connect Supabase

1. Create a Supabase project using PostgreSQL 15 or newer.
2. Run `supabase/migrations/001_acadtrack.sql`, then `002_reviews_and_metrics.sql`, then `003_admin.sql` in the SQL editor. These are one-time migrations for a new project, not scripts to run repeatedly. If the first two are already installed, run only `003_admin.sql`.
3. Copy `.env.example` to `.env.local` and fill in the Supabase URL and public anon key. Put the service-role key only in the server variable shown below.
4. Enable email/password authentication. Set the Auth site URL to your deployment origin and allow `https://YOUR-DOMAIN/auth/callback` and `https://YOUR-DOMAIN/auth/callback?reset=1` as redirect URLs. Add the corresponding localhost redirect for local testing. Configure production SMTP in Supabase for verification and reset email delivery.
5. Restart the app. Cloud mode requires sign-in; it never silently falls back to local storage after a cloud error.

Supabase client setup follows the [official server-side Auth guidance](https://supabase.com/docs/guides/auth/server-side/creating-a-client). Session refresh uses Next.js Proxy; every data API independently validates the authenticated user. RLS and composite ownership foreign keys isolate records even if someone calls the Supabase REST API directly.

## Administrator setup

Google sign-in is currently removed from the app. Email/password registration and
email confirmation remain enabled. Keep **Confirm email** enabled in Supabase's
Email provider settings; the app additionally checks the account's confirmed email
before allowing cloud workspace access.

To activate the administration area on an existing installation:

1. Apply `supabase/migrations/003_admin.sql` once in the trusted Supabase SQL Editor.
2. Register your own account in AcadTrack, confirm its email, and sign in.
3. Open `scripts/promote-admin.sql`, replace `REPLACE_WITH_YOUR_VERIFIED_EMAIL`
   with that verified account's email, and run the script in Supabase SQL Editor.
   It refuses to grant a role to an unverified or nonexistent account.
4. Refresh AcadTrack. The **Administration** sidebar link opens `/admin`.

No account becomes an administrator automatically, and registration metadata cannot
grant a role. User directory, aggregate usage, suspension/restoration, announcements,
and the audit log are served through RPCs that independently verify the caller's
verified administrator membership. A service-role key is not required for these
admin tools. The existing service-role key is still needed for reminders and account
deletion.

Admins see account email/name, creation and sign-in times, verification status,
application access status, and aggregate usage totals. They do not receive students'
private tasks, grades, notes, schedules or attachments. Existing owner-only RLS
policies still apply to administrators' normal workspace requests.

Suspension preserves the student's identity and academic records. After migration
003, it blocks cloud workspace access and direct authenticated database/storage
requests, including existing sessions. Signed file links already issued expire within
their existing 60-second lifetime. Suspension does not delete the Supabase identity
or ban unrelated applications that share the project. Removing an admin's access or
changing administrator membership is a trusted SQL operation; administrators cannot
suspend themselves or other administrators through this interface.

Published announcements appear on active students' Overview pages and refresh with
the workspace's normal cloud polling. Drafts remain visible only in administration.
Saves, publication, removal, suspension and restoration create audit records in the
same database transaction. Search and account pagination are server-side.

Before migration 003 is applied, existing verified students can still use the app,
and administrator access is disabled. External activation and a real administrator
login still need verification against your Supabase project.

## Environment variables

| Variable                        | Where           | Purpose                                                       |
| ------------------------------- | --------------- | ------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Public          | Project URL; enables cloud mode with the anon key             |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public          | Public project key; access remains restricted by RLS          |
| `SUPABASE_SERVICE_ROLE_KEY`     | **Server only** | Scheduled jobs and permanent account deletion                 |
| `CRON_SECRET`                   | **Server only** | A long random secret protecting the scheduler endpoint        |
| `NEXT_PUBLIC_APP_URL`           | Public          | Exact application origin used in reminder links               |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`  | Public          | Browser push application key                                  |
| `VAPID_PRIVATE_KEY`             | **Server only** | Signing browser push messages                                 |
| `VAPID_SUBJECT`                 | Server          | Contact URL, e.g. `mailto:you@example.com`                    |
| `RESEND_API_KEY`                | **Server only** | Optional email reminder provider credential                   |
| `REMINDER_FROM`                 | Server          | Verified sender, e.g. `AcadTrack <reminders@your-domain.com>` |

Never prefix the service-role key, VAPID private key, or email API key with `NEXT_PUBLIC_`. No credentials are included in this repository. Public variables must be present when Vercel builds the app.

## Reminders, push, and weekly summaries

Vercel Hobby does not support a 10-minute cron schedule, so `vercel.json` does not
automatically create one. For in-app reminders and weekly/daily analytics, run
`supabase/optional/enable-reminders.sql` once in Supabase SQL Editor. This schedules
the existing database functions every 10 minutes with Supabase Cron; it does not
need a Vercel service-role key. The script is prepared but must be activated in
your Supabase project.

`GET /api/cron/reminders` remains available for outbound push/email delivery and
requires `Authorization: Bearer YOUR_CRON_SECRET`. Configure a compatible external
server scheduler, or a Vercel plan supporting the desired frequency, plus the server
credentials listed above. Check the current [Vercel Cron documentation](https://vercel.com/docs/cron-jobs/manage-cron-jobs).

The job:

- Captures one real daily deadline-health snapshot per student, in their configured timezone.
- Generates a saved previous-week review and an in-app notification once per week.
- Enqueues deadline reminders at configured intervals (default 168, 72, 24, 6, and 1 hour).
- Stores in-app notifications transactionally, with a unique task/deadline/interval key.
- Claims up to 20 outbound deliveries using database row locks and five-minute leases.
- Retries transient delivery failures with backoff, up to five attempts; failures are stored in `reminder_deliveries.last_error` for diagnosis.
- Cancels queued messages when a task is completed, rescheduled, or notification preferences are disabled.

There can be up to 10 minutes of scheduling latency. After a scheduler outage, applicable missed reminder intervals can catch up together. Resend uses stable idempotency keys; browser notifications use a stable notification tag. External delivery is at-least-once: a provider success immediately followed by a process crash can still cause a retry. Monitor failed jobs in Supabase; Vercel does not make this endpoint a guaranteed-delivery queue by itself.

Generate VAPID keys locally with the installed `web-push` CLI (`npx web-push generate-vapid-keys`), then store the private key in server environment configuration. Browser push requires HTTPS (localhost also works), a supported browser, and explicit permission through **Settings → Enable this browser**. The service worker receives reminders when the site is closed. Configure Resend and verify the sender domain before enabling email reminders. Supabase authentication emails and application reminder emails are separate services/configurations.

## Deploy to Vercel

1. Push this project to your Git provider and import it into Vercel as a Next.js project.
2. Use Node.js 24 and the pinned pnpm version. Set `ENABLE_EXPERIMENTAL_COREPACK=1` in Vercel, install from the committed lockfile, and run `pnpm build`.
3. Add the environment variables in Vercel, including `CRON_SECRET`, and deploy.
4. Update the Supabase site URL and allowed Auth callback URLs to the final deployment origin.
5. Activate the optional Supabase reminder scheduler. If enabling push/email, configure the authenticated outbound scheduler and credentials separately.
6. Test a real account, a second isolated account, file upload/download, password reset, and a near-deadline reminder before launch.

The project is connected to the existing Supabase database and the Vercel project
`supremomjs-projects/acadtrack`. Production deployment is being verified. Supabase
authentication URLs must include the final deployment domain. VAPID, reminder email,
and service-role credentials are not configured; optional outbound reminders and
permanent account deletion require those server credentials before use.

## What is implemented

| Phase              | Working implementation                                                                                                                                                                                                                                    |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 · Foundation     | Next.js App Router, secure Supabase cookie session support, sign-up/sign-in/reset, protected cloud workspace, responsive navigation, schema and RLS                                                                                                       |
| 2 · Coursework     | Subject CRUD/archive, recurring classes, task CRUD, notes, subtasks, attachments in cloud mode, live dashboard, list/board views, drag-and-drop status changes, filters and global search                                                                 |
| 3 · Deadlines      | FullCalendar month/week/day, event and session editing/rescheduling, confirmation on actual-deadline changes, dynamic overdue status, configurable reminders, notification history and read state, service-worker push, optional Resend email             |
| 4 · Study & grades | Conflict-aware session suggestions, capacity limits and breaks, accept/adjust/reject recommendations, manual scheduling, persistent focus timer, focus logs, weighted grade categories/scores, target score projections and trend charts                  |
| 5 · Insights       | Weekly completion charts, on-time counts, subject productivity and workload, planned/actual study totals, daily overdue snapshots, automatic weekly review history, timezone/theme/study/notification/grade preferences, data export and account deletion |
| 6 · Quality        | Production build, strict TypeScript, domain tests, executable PostgreSQL migration/RLS/constraint/job tests, local browser smoke checks; external deployment verification remains                                                                         |

### Behavior and practical boundaries

- Smart task ordering combines deadline urgency, manual priority, estimated remaining work, difficulty, and personal target date. Risk warnings compare remaining work with available daily study hours. The planner uses preferred days/time windows, existing sessions, events, and recurring classes to find non-overlapping slots before the task target or due date.
- Overdue is a derived status: a completed task is never overdue. `task_status` exposes this in PostgreSQL. The UI refreshes time-sensitive status every minute and polls cloud records at the same interval. Original workflow state is preserved, so an overdue in-progress task is still in its original Kanban column and is visibly flagged overdue.
- Planner suggestions are computed on request over a 14-day horizon. If no slots remain before a deadline, adjust availability or the deadline/estimate; the app does not quietly schedule after the deadline.
- Classes repeat weekly without semester date bounds. Archive/delete or edit the class when the timetable changes. The calendar grid and datetime inputs use the device timezone; recurring class conversion, date labels, and reminders use the configured workspace timezone. This distinction is shown in the interface.
- Grading uses percentages and course-specific weighted categories, with editable interpretation text rather than an assumed institutional pass/fail scale. Scores are pooled by points within each category. Current grade normalizes assessed categories. Required remaining-score projections treat categories without any scores as unassessed and assume total weights equal 100%; they do not predict future scores inside an already assessed category.
- A focus timer survives navigation, refresh, and closing/reopening the browser on the same device. The completed session is persisted when Focus mode is open again. Timer state is local to the device; completed logs sync to Supabase in cloud mode. Keep one active timer tab per account.
- Daily analytics history starts when the scheduler first runs; missing past history is never fabricated. Weekly snapshots include the previous week's completed work and the unfinished workload at the time of capture.
- Exports contain academic records and attachment metadata. Download attachment files separately before deleting an account. Private objects use short-lived signed download URLs and owner-only storage policies; direct uploads are restricted by type and size. Files removed through task/subject deletion can leave private orphaned objects; clean those in Storage when maintaining the project.
- Optional sample data is a user-invoked starting point for evaluation, never a permanent source of dashboard metrics.

## Project map

```text
src/app/                 Pages, styles, authentication callback, API routes
src/components/          Dashboard, coursework, calendar, study, grades, settings
src/components/ui/       Reusable shadcn-style Button and accessible Radix Dialog
src/lib/academic.ts      Priority, risk, grades, timezone conversion, planning
src/lib/schemas.ts       Runtime validation shared by browser and server
src/lib/supabase/        Public browser client and cookie-aware server client
supabase/migrations/     Normalized tables, RLS, constraints, triggers, job functions
tests/                   Domain and isolated PostgreSQL integration tests
public/sw.js             Push notification service worker
```

## Verification

```sh
npm run typecheck
npm test
npm run build
```

Tests use an in-memory PostgreSQL engine (PGlite), with minimal Supabase Auth/Storage schema stubs. They execute the actual migrations and verify RLS, cross-user FK rejection, progress triggers, grading weights, session conflicts, cron permissions, idempotent reminders/reviews, account deletion cascades, admin authorization, student privacy, suspension/restoration, announcements and auditing. This does not emulate Supabase's hosted Auth or Storage HTTP APIs.

Build scripts deliberately select webpack because Turbopack's CSS worker could not start under the managed Windows process sandbox. The production webpack build succeeds. Styling uses Tailwind v4 plus shared semantic CSS for this application's visual system.
