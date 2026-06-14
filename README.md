# TaskFlow Application

TaskFlow is a personal planning web application built with Next.js App Router, TypeScript, Tailwind CSS, Supabase Auth, Supabase PostgreSQL, and Prisma. In the DevOps platform, this repository is deployed under the `tikto` application slug and owns the application code, Docker image build, and GitHub Actions CI/CD pipeline.

## What This Repository Demonstrates

- A production-oriented Next.js application with authenticated dashboard routes.
- CI validation for linting, TypeScript, tests, coverage, production builds, and SonarQube Cloud quality gates.
- Docker image build and vulnerability scanning before publishing to GHCR.
- GitHub Actions reusable workflows and local composite actions for repeatable CI/CD logic.
- GitHub Actions OIDC integration with AWS for loading secrets from AWS Secrets Manager.
- GitOps-driven deployment through a separate manifest repository and Argo CD.

## Application Scope

Implemented features:

- Google-only sign-in through Supabase Auth.
- Protected dashboard shell with tasks, calendar, integrations, and settings.
- Task CRUD with timezone-aware status, priority, overdue, completed, upcoming, and board views.
- Event CRUD with timed and all-day event semantics.
- Dashboard summaries and responsive desktop/mobile navigation.
- User profile and timezone settings.
- Google Calendar and Google Tasks integration routes, import jobs, sync helpers, and webhook handling.
- Telegram integration settings and reminder delivery foundations through QStash.

Known partial areas:

- Calendar watch renewal route exists, but full automation is not completed end to end.
- Existing Supabase databases should rerun the SQL setup/schema scripts so newly added reminder and sync columns are applied idempotently.

## Tech Stack

| Area | Technology |
|---|---|
| Framework | Next.js 16 App Router, React 19 |
| Language | TypeScript |
| Styling | Tailwind CSS 4 |
| Authentication | Supabase Auth with SSR helpers |
| Database | Supabase PostgreSQL |
| ORM | Prisma |
| Validation | Zod |
| Testing | Vitest with V8 coverage |
| CI/CD | GitHub Actions reusable workflows and composite actions |
| Quality | ESLint, TypeScript, SonarQube Cloud |
| Container | Docker, GHCR, Trivy |

## Repository Layout

```text
.
|-- src/
|   |-- app/                 # App Router pages, API routes, jobs, and webhooks
|   |-- components/          # UI and feature components
|   |-- lib/                 # Shared utilities, auth, dates, Google, Supabase, QStash
|   |-- server/              # Services and repositories
|   `-- __tests__/           # Unit tests and test setup
|-- prisma/                  # Prisma schema
|-- supabase/                # SQL setup and application schema scripts
|-- .github/
|   |-- workflows/           # CI/CD entrypoint and reusable workflows
|   `-- actions/             # Composite actions used by CI/CD
|-- Dockerfile
|-- sonar-project.properties
`-- package.json
```

## Local Development

Prerequisites:

- Node.js 22
- npm
- A Supabase project or PostgreSQL-compatible database

Install dependencies:

```bash
npm install
```

Copy environment variables:

```bash
cp .env.example .env.local
```

Required baseline variables:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public Supabase browser key |
| `DATABASE_URL` | PostgreSQL connection string used by Prisma |
| `NEXT_PUBLIC_APP_URL` | Public base URL for callbacks and generated links |

Optional integration variables:

| Variable | Purpose |
|---|---|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `TOKEN_ENCRYPTION_KEY` | Encryption key for stored integration tokens |
| `QSTASH_TOKEN` | QStash token for reminder scheduling |
| `QSTASH_CURRENT_SIGNING_KEY` | Current QStash webhook signing key |
| `QSTASH_NEXT_SIGNING_KEY` | Next QStash webhook signing key |

Telegram bot tokens are saved per user from the Integrations page and encrypted with `TOKEN_ENCRYPTION_KEY`.

Generate the Prisma client:

```bash
npm run prisma:generate
```

Start the development server:

```bash
npm run dev
```

## Supabase Setup

The application expects `profiles.id` to match `auth.users.id`, with profile rows provisioned automatically when a new auth user is created.

Run `supabase/setup.sql` in the Supabase SQL editor to create the profile trigger and baseline database objects.

Database notes:

- If the PostgreSQL password contains special characters such as `@` or `#`, percent-encode them in `DATABASE_URL`.
- For Vercel, prefer the Supabase Connection Pooler / Supavisor string over the direct `db.<project-ref>.supabase.co:5432` host.
- Supabase direct database hosts require IPv6. The pooler is safer for IPv4-only environments.

## Verification Commands

```bash
npm run lint
npm run typecheck
npm run test:coverage
npm run build
```

## Docker Image

The Dockerfile builds the Next.js production runtime on `node:22-alpine`, disables Next.js telemetry, installs dependencies with `npm ci`, runs the production build, prunes development dependencies, and exposes the application on port `3000`.

CI/CD publishes images to:

```text
ghcr.io/flavoriy/tikto
```

Image tags use an explicit workflow tag when provided. Otherwise, CI/CD uses a Git tag on the commit; if the commit is not tagged, it increments the latest semver Git tag by one patch version, for example `v1.0.1` becomes `v1.0.2`. If no semver tag exists yet, it starts at `v0.0.1`.

## GitHub Actions CI/CD

Workflow entrypoint:

```text
.github/workflows/ci-cd.yml
```

The entrypoint delegates to reusable workflows:

| Workflow | Responsibility |
|---|---|
| `.github/workflows/ci.yaml` | Lint, typecheck, build, unit tests, coverage, and SonarQube Cloud |
| `.github/workflows/cd.yaml` | Docker build, Trivy scan, GHCR push, GitOps manifest update, and Argo CD verification |

Reusable delivery logic is implemented as composite actions:

| Action | Responsibility |
|---|---|
| `.github/actions/build-context` | Resolve branch, environment, manifest file, and Argo CD app name |
| `.github/actions/docker-image-tags` | Generate image references and expose them to later steps |
| `.github/actions/load-aws-secrets` | Load JSON secrets from AWS Secrets Manager into the GitHub Actions environment |
| `.github/actions/update-gitops` | Clone the GitOps repository, update the image patch, commit, and push |
| `.github/actions/verify-argocd` | Wait for Argo CD sync and health, then verify the deployed image reference |

Pipeline behavior:

| Event | Behavior |
|---|---|
| Pull request to `dev` or `main` | Runs CI only. No deployment happens from pull requests. |
| Push or merge to `dev` | Runs CI, then deploys automatically to the development environment. |
| Push or merge to `main` | Runs CI, then deploys through the protected `prod` GitHub Environment. |
| Manual dispatch | Runs the workflow manually using the same pipeline definition. |

CI details:

- Installs dependencies with `npm ci`.
- Runs lint, TypeScript checks, unit tests with coverage, and production build validation.
- Loads `SONAR_TOKEN` from AWS Secrets Manager.
- Runs SonarQube Cloud on pull requests and `main`.
- Uses `sonar.qualitygate.wait=true` so CI fails when the Quality Gate fails.

CD details:

- Assumes the configured AWS role through GitHub Actions OIDC.
- Loads shared and environment-specific secrets from AWS Secrets Manager.
- Builds the Docker image with environment-specific public build arguments.
- Scans the image with Trivy and fails on HIGH or CRITICAL vulnerabilities.
- Pushes the image to GHCR.
- Updates the matching GitOps image patch file:

```text
apps/tikto/overlays/<env>/patch-image.yaml
```

- Verifies the matching Argo CD application when Argo CD access is configured:

```text
tikto-dev
tikto-prod
```

## Required CI/CD Configuration

GitHub repository secret:

| Secret | Purpose |
|---|---|
| `AWS_ROLE_TO_ASSUME` | IAM role ARN that GitHub Actions can assume with OIDC |

AWS Secrets Manager secrets in `ap-southeast-1`:

| Secret ID | Expected Use |
|---|---|
| `tikto/shared` | Shared CI/CD values such as `SONAR_TOKEN`, `GHCR_USERNAME`, `GHCR_TOKEN`, `GITOPS_USERNAME`, `GITOPS_TOKEN`, `ARGOCD_SERVER`, and `ARGOCD_TOKEN` |
| `tikto/dev` | Development runtime/build values |
| `tikto/prod` | Production runtime/build values |

The IAM role needs `secretsmanager:GetSecretValue` access for those secret IDs.

Recommended GitHub settings:

- Protect `dev` and `main`.
- Require pull requests before merging.
- Require the `CI` status check before merging.
- Use environment `dev` without required reviewers for automatic development deployments.
- Use environment `prod` with required reviewers for production deployment approval.
