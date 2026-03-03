# RTC Database (monorepo)

Comprehensive README for the RTC Database monorepo. This repository contains the web server (Next.js), a desktop Electron app, and shared packages used across the project.

Contents

- `WebServer/` — Next.js app (server-side and client-side code), Prisma schema and migrations, server actions, API routes.
- `NativeApp/` — Electron + Vite desktop application.
- `packages/shared/` — Shared TypeScript utilities / types used by other packages.

Quick overview

This repo uses pnpm workspaces to coordinate packages. The web server uses Next.js and Prisma (SQLite by default). The desktop app is built with Vite and Electron and consumes the shared package.

Prerequisites

- Node.js (recommended LTS, e.g., 18+ or 20+ depending on your environment).
- pnpm (this repo uses pnpm workspaces):

```bash
npm install -g pnpm
```

- Git (for cloning and collaboration)

Install (root)

From the repository root install all workspace dependencies and link packages:

```bash
pnpm install
```

Useful package.json scripts (root)

- `pnpm dev` — Run the full development environment (build shared package in watch mode, run the web server and desktop frontend). Defined in root package.json.
- `pnpm dev:backend` — Run only the web server (Next.js + Prisma Studio).
- `pnpm dev:frontend` — Run only the desktop Electron + Vite frontend.
- `pnpm build` — Build shared, webserver, and native app packages.
- `pnpm update:prisma` — Helper to run Prisma migrate, generate, and seed for the webserver package.

Running in development

- Full monorepo (recommended for local development where you want everything live):

```bash
pnpm dev
```

- Web server only (Next.js dev + Prisma Studio):

```bash
pnpm dev:backend
```

- Desktop frontend only (Electron + Vite):

```bash
pnpm dev:frontend
```

Notes for Windows / PowerShell

If you need to set environment variables in PowerShell for a single command, use this pattern:

```powershell
$env:NEXTAUTH_URL = "http://localhost:3000"; pnpm dev:backend
```

Or create a `.env` file in `WebServer/` (Next.js will pick this up).

Environment variables (WebServer)

Create a `.env` in `WebServer/` (do NOT commit secrets). Example variables used by the application:

```env
# Next.js / NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-long-random-secret

# Prisma
DATABASE_URL=file:./dev.db

# Email (SMTP) — optional
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-user
SMTP_PASS=your-pass

# Optional S3 / AWS settings (if you use S3 for file storage)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
S3_BUCKET=

# Any other provider secrets used by your app

```

Prisma / database

The `WebServer` package uses Prisma for database access. The schema is in `WebServer/prisma/schema.prisma` (SQLite by default). Common Prisma tasks:

- Create & apply migrations (local dev):

```bash
pnpm --filter rtc-database-webserver exec prisma migrate dev
```

- Generate Prisma client:

```bash
pnpm --filter rtc-database-webserver exec prisma generate
```

- Open Prisma Studio (visual DB editor):

```bash
pnpm --filter rtc-database-webserver exec prisma studio
```

Root helper (recommended):

```bash
pnpm update:prisma
```

This helper runs migrations, generates the client, and seeds the DB (see `WebServer/prisma/seed.ts` if present).

Building for production

- Build all packages (shared, webserver, native app):

```bash
pnpm build
```

- Start web server in production (after building the `WebServer` package):

```bash
# from root or WebServer folder after build
pnpm --filter rtc-database-webserver start
```

- Build the Electron app (platform-specific artifacts) from the `NativeApp` package. See `NativeApp/package.json` `build` script — this uses `electron-builder`.

Common troubleshooting

- Next.js dev caching: When changing server actions or moving server code, stop and restart the Next.js dev server to clear cached action artifacts.
- Prisma client mismatch: If you change the Prisma schema run `prisma generate` and restart the server. Use `pnpm update:prisma` if you want to run migrations + generate + seed.
- SQLite file location: `DATABASE_URL=file:./dev.db` creates a file in `WebServer/`. Make sure file permissions allow write access.
- Ports: Default dev ports are `3000` for Next.js and typical Vite/Electron ports for the native app. If ports conflict, adjust `NEXTAUTH_URL` and the relevant startup flags.
- Email/Sender issues: Check SMTP env variables and verify with a simple nodemailer script.

Developer workflow & conventions

- Shared code: put common types and helpers in `packages/shared` and import via the workspace alias `@rtc-database/shared`.
- Server actions: many server functions are exported as server actions for Next.js; avoid circular imports and keep server-only code under `WebServer/` to prevent bundling into the Electron app.

Where to look in this repo

- Server code and Prisma schema: [WebServer](WebServer)
- Desktop app: [NativeApp](NativeApp)
- Shared code: [packages/shared](packages/shared)

Contributing

1. Fork the repository and create a feature branch.
2. Keep commits small and focused.
3. Open a pull request with a clear description of changes and any migration steps (Prisma migrations, data changes, env updates).

If you want I can add:

- A `.env.example` file under `WebServer/` with the variables listed above.
- Step-by-step Prisma seed details and sample seed data.
- A Windows-specific helper script (PowerShell) to automate env setup.

License

This project is licensed under the MIT License.

---

Updated README — let me know if you want the `.env.example` file added or a brief quickstart section for new contributors.
