# TikTo Application

TikTo is a task and calendar planning application built with Next.js, TypeScript, Supabase, and Prisma. This repository contains the application source code and the CI/CD workflows used to validate, package, scan, publish, and deploy the application through GitOps.

The package name is `taskflow`; the Kubernetes workload is deployed with the `tikto` application slug.

## Key Capabilities

- Next.js 16 App Router application with authenticated dashboard routes and API endpoints.
- Task, event, profile, integration, and dashboard service layers backed by repository-based data access.
- Supabase Auth, Supabase PostgreSQL, Prisma, Google OAuth foundations, Google Calendar/Tasks sync foundations, Telegram settings, and QStash reminder webhook foundations.
- Reusable GitHub Actions workflows for ESLint analysis, TypeScript validation, unit testing, coverage reporting, production builds, and SonarCloud quality-gate checks.
- Docker image delivery pipeline with environment-scoped version tags, Trivy HIGH/CRITICAL vulnerability scanning, and GHCR publishing.
- Composite GitHub Actions for AWS Secrets Manager loading, image tag generation, GitOps manifest updates, and Argo CD deployment verification.

## Application Features

Available features:

- Email/password authentication (with automatic registration if the account doesn't exist) and Google OAuth sign-in through Supabase Auth.
- Protected dashboard layout with responsive navigation.
- Task CRUD with status, priority, overdue, completed, upcoming, and board-oriented views.
- Event CRUD with timed and all-day event handling.
- Dashboard summaries for daily planning.
- User profile and timezone settings.
- Google integration routes for OAuth, import, incremental sync, retry, callback, and disconnect flows.
- Telegram integration settings and reminder delivery foundations.
- Health endpoint for Kubernetes readiness checks.

In progress:

- Calendar watch renewal exists as a route; longer-running automation is planned for production-style operation.
- Existing Supabase databases should rerun the SQL setup/schema scripts when new reminder or sync columns are added.
- End-to-end integration testing requires live third-party credentials and webhook configuration.

## Technology Stack

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
| Quality | ESLint, TypeScript, SonarCloud |
| Container | Docker, GHCR, Trivy |
| Integrations | Google Calendar, Google Tasks, Telegram, QStash foundations |

## Repository Structure

```text
.
|-- src/
|   |-- app/                 # App Router pages, layouts, API routes, jobs, and webhooks
|   |-- components/          # UI and feature components
|   |-- lib/                 # Shared utilities, auth, Supabase, Google, QStash, dates
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

Generate Prisma client:

```bash
npm run prisma:generate
```

Start the development server:

```bash
npm run dev
```

## Supabase Setup

The application expects `profiles.id` to match `auth.users.id`, with profile rows provisioned automatically when a new auth user is created.

Run the SQL scripts under `supabase/` in the Supabase SQL editor to create baseline database objects and application tables.

Database notes:

- If a PostgreSQL password contains special characters such as `@` or `#`, percent-encode them in `DATABASE_URL`.
- For hosted deployment environments, prefer the Supabase Connection Pooler / Supavisor string over direct database hosts when IPv4 compatibility matters.

## Verification Commands

```bash
npm run lint
npm run typecheck
npm run test:coverage
npm run build
```

## Docker Image

The Dockerfile builds the production runtime on `node:22-alpine`:

- Installs dependencies with `npm ci`.
- Runs Prisma generation and `next build`.
- Prunes development dependencies.
- Runs the app as a non-root `nextjs` user.
- Exposes port `3000`.

CI/CD publishes images to:

```text
ghcr.io/flavoriy/tikto
```

Image tags are generated by the deployment workflow as environment-scoped run-number tags:

```text
ghcr.io/flavoriy/tikto:dev-42
ghcr.io/flavoriy/tikto:prod-43
```

The tag format is `<environment>-<github.run_number>`. This keeps each deployment tag unique, avoids the old static `v0.0.1` pattern, and makes the running image traceable back to the GitHub Actions run.

## GitHub Actions CI/CD

Workflow entrypoints:

- `.github/workflows/pr-checks.yml` (runs CI checks on pull requests)
- `.github/workflows/deploy-dev.yml` (runs CI and deploys to Dev on push to `dev` branch)
- `.github/workflows/deploy-prod.yml` (runs CI and deploys to Prod on push to `main` branch)

Reusable workflows:

| Workflow | Responsibility |
|---|---|
| `.github/workflows/ci.yaml` | ESLint analysis, TypeScript validation, production build, unit tests with coverage, and SonarCloud analysis |
| `.github/workflows/cd.yaml` | Docker build, HIGH/CRITICAL Trivy scan, GHCR push, GitOps manifest update, and Argo CD verification |

Composite actions:

| Action | Responsibility |
|---|---|
| `.github/actions/build-context` | Resolve branch, target environment, GitOps patch file, and Argo CD app name |
| `.github/actions/docker-image-tags` | Generate image references and expose them to later steps |
| `.github/actions/load-aws-secrets` | Load JSON secrets from AWS Secrets Manager into GitHub Actions environment variables |
| `.github/actions/update-gitops` | Clone the GitOps repository, update the image patch, commit, and push |
| `.github/actions/verify-argocd` | Wait for Argo CD sync/health and verify the deployed image reference |

Pipeline behavior:

| Event | Behavior |
|---|---|
| Pull request to `dev` or `main` | Runs CI only; no deployment from pull requests |
| Push or merge to `dev` | Runs CI and deploys to the development environment |
| Push or merge to `main` | Runs CI and deploys through the protected `prod` GitHub Environment |
| Manual dispatch | Runs the same workflow manually |

## Delivery Workflow

1. GitHub Actions validates linting, types, tests, coverage, and production build.
2. SonarCloud runs quality analysis when configured for the event.
3. The deployment job assumes an AWS role through GitHub Actions OIDC.
4. Shared and environment-specific values are loaded from AWS Secrets Manager.
5. Docker builds the application image with environment-specific public build arguments.
6. Trivy scans the image and fails on HIGH or CRITICAL vulnerabilities.
7. The approved image is pushed to GHCR.
8. The matching GitOps image patch is updated:

```text
apps/tikto/overlays/<env>/patch-image.yaml
```

9. Argo CD sync and image verification run when Argo CD access is configured.

## CI/CD Configuration

GitHub repository secret:

| Secret | Purpose |
|---|---|
| `AWS_ROLE_TO_ASSUME` | IAM role ARN that GitHub Actions can assume with OIDC |

AWS Secrets Manager secrets in `ap-southeast-1`:

| Secret ID | Expected use |
|---|---|
| `tikto/shared` | Shared CI/CD values such as SonarCloud, GHCR, GitOps, and Argo CD credentials |
| `tikto/dev` | Development runtime and build values |
| `tikto/prod` | Production runtime and build values |

The IAM role needs `secretsmanager:GetSecretValue` access for those secret IDs.
