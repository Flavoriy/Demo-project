# TaskFlow

TaskFlow is a personal planning web app built with Next.js App Router, TypeScript, Tailwind CSS, Supabase Auth, Supabase PostgreSQL, and Prisma.

Current implementation focus:
- Google-only sign-in through Supabase Auth
- Protected app shell with dashboard, tasks, calendar, integrations, and settings
- Task CRUD with timezone-aware status, priority, overdue, and board views
- Event CRUD with timed vs all-day semantics
- Responsive desktop/mobile navigation
- Google Calendar/Tasks sync and Telegram reminder delivery foundations

## Tech Stack

- Next.js 16 App Router
- React 19
- Tailwind CSS 4
- Supabase Auth + SSR helpers
- Prisma ORM
- PostgreSQL-ready schema

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Copy environment variables:

```bash
cp .env.example .env.local
```

3. Fill in at minimum:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `DATABASE_URL`
- `NEXT_PUBLIC_APP_URL`

Provider features need additional server-side env:
- Google sync: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `TOKEN_ENCRYPTION_KEY`
- Telegram reminder scheduling: `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`
- Telegram bot tokens are saved per user from the Integrations page and encrypted with `TOKEN_ENCRYPTION_KEY`.

If your Postgres password contains special characters such as `@` or `#`, percent-encode them inside `DATABASE_URL` or Prisma will fail to parse the host correctly.
For Vercel, set `DATABASE_URL` to the Supabase `Connect` -> `Connection Pooler` / Supavisor string, not the direct `db.<project-ref>.supabase.co:5432` host.
Supabase direct database hosts require IPv6; the pooler supports IPv4-compatible environments such as Vercel.

4. Generate Prisma client:

```bash
npm run prisma:generate
```

5. Start the app:

```bash
npm run dev
```

## Supabase Auth Profile Mapping

The application expects:
- `profiles.id = auth.users.id`
- a row in `profiles` to be provisioned automatically when a new auth user is created

Use [supabase/setup.sql](supabase/setup.sql) in your Supabase SQL editor to create the profile trigger.

## Verification Commands

```bash
npm run lint
npm run typecheck
npm run build
```

## GitHub Actions CI/CD

Workflow entrypoint: `.github/workflows/ci-cd.yml`.

The entrypoint stays small and calls reusable workflow files:

- `.github/workflows/ci.yaml`
- `.github/workflows/cd.yaml`

Reusable step logic lives in local composite actions under `.github/actions/`.

Flow:

1. Pull requests into `dev` or `main` run the `CI` job only: install, lint, typecheck, unit tests, build, and SonarQube Cloud.
2. The PR job uses GitHub's `pull_request` merge ref, so tests run against the merged result, not only the source branch.
3. The SonarQube Cloud step uses `sonar.qualitygate.wait=true`, so the `CI` job fails if the Quality Gate fails.
4. Push/merge into `dev` runs `CI` first, then `Deploy Dev` automatically.
5. Push/merge into `main` runs `CI` first, then `Deploy Prod`. `Deploy Prod` references the `prod` GitHub Environment and should be protected with required reviewers.

For branch deployments, configure repository secret:

- `AWS_ROLE_TO_ASSUME`: IAM role ARN that GitHub Actions can assume with OIDC.

The workflow reads these AWS Secrets Manager secrets in `ap-southeast-1`:

- `tikto/shared`
- `tikto/dev`
- `tikto/prod`

The IAM role needs `secretsmanager:GetSecretValue` for those secrets. The shared secret should contain values such as `SONAR_TOKEN`, `GHCR_USERNAME`, `GHCR_TOKEN`, `GITOPS_USERNAME`, `GITOPS_TOKEN`, `ARGOCD_SERVER`, and `ARGOCD_TOKEN`.

Required GitHub settings:

- Branch protection for `dev` and `main`: require the `CI` status check before merge.
- Environment `dev`: no required reviewers.
- Environment `prod`: add required reviewers to approve production deployment.

## Current Scope

Implemented now:
- Core MVP foundation
- Task CRUD APIs and UI
- Event CRUD APIs and UI
- Dashboard summaries
- Settings page with timezone/profile update
- Telegram settings, status guidance, and reminder scheduling through QStash
- Google integration routes
- Google bootstrap import job
- Google Calendar webhook
- Google Calendar/Tasks sync helpers

Still partial:
- Calendar watch renewal route is present but not automated end-to-end yet.
- Existing Supabase databases should rerun the SQL setup/schema scripts so newly added reminder and sync columns are added idempotently.
