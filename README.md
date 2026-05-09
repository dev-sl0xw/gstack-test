# bookmark-toy

Personal bookmark app with email/password auth, per-user tags, and public profile pages. Built as a learning toy for the [gstack](https://github.com/garrytan/gstack) workflow.

**Live:** <https://bookmark-toy.fly.dev>

## Stack

Bun · Hono (JSX SSR) · HTMX · Drizzle ORM · Turso (libSQL) · Fly.io

## Local development

```bash
bun install

# Apply migrations to a local SQLite file
DATABASE_URL="file:./local.db" bun run db:migrate

# Run the server
DATABASE_URL="file:./local.db" \
  SESSION_SECRET=dev \
  CSRF_SECRET=dev \
  bun run src/server.ts
```

Open <http://localhost:3000>.

## Deploy

Pushes to `main` trigger `.github/workflows/fly-deploy.yml`, which runs `fly deploy` against the `bookmark-toy` Fly app. To deploy manually:

```bash
fly deploy
```

Required Fly secrets: `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `SESSION_SECRET`, `CSRF_SECRET`.
Required GitHub Actions secret: `FLY_API_TOKEN` (`fly tokens create deploy -x 999999h`).

## Docs

- Design spec: [`docs/superpowers/specs/2026-05-08-gstack-bookmark-toy-design.md`](docs/superpowers/specs/2026-05-08-gstack-bookmark-toy-design.md)
- Implementation plan: [`docs/superpowers/plans/2026-05-08-bookmark-toy.md`](docs/superpowers/plans/2026-05-08-bookmark-toy.md)
