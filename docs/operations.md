# Operations runbook

Live site: https://trackmylogs.netlify.app · Repo: https://github.com/lekhrajpanjwani/clockin-clockout

## 1. Protect `main`

GitHub → **Settings → Branches → Add branch ruleset** (or "Add rule" on older UIs):

- Target: `main`
- ✅ Require a pull request before merging (approvals: 0 is fine for a solo project)
- ✅ Require status checks to pass → add **`check`** and **`e2e`** (the two jobs in `.github/workflows/ci.yml`; they appear in the picker after CI has run once)
- ✅ Block force pushes · ✅ Restrict deletions

From then on: `git switch -c feat/...` → push → open a PR → CI must pass → merge. Netlify builds a deploy preview for every PR.

## 2. Error tracking (Sentry) — optional

The app reports crashes and failed (5xx) API calls to Sentry **only if** `VITE_SENTRY_DSN` is set at build time. Without it nothing is loaded or sent.

1. Create a free account at sentry.io → new project → platform **Browser JavaScript**. Copy the DSN.
2. Netlify → Site configuration → Environment variables:
   - `VITE_SENTRY_DSN` = the DSN
   - `VITE_APP_ENV` = `production` (optionally set `deploy-preview` for the Deploy Previews context)
3. **Trigger deploy** (build-time variable). The release is tagged with the git commit automatically.

What is sent: error type, message and stack, browser/OS, the page, recent navigation/API breadcrumbs, and the Supabase **user id**. Email addresses are scrubbed from everything; no session replay, no performance tracing. The SDK (~150 kB gzipped) loads lazily after the first paint and is not part of the offline/PWA cache.

Server-side errors are also logged in **Netlify → Logs → Functions**.

## 3. Branded auth emails

Supabase → **Authentication → Emails → Templates**. For each template, paste the HTML from `supabase/templates/` and set the subject:

| Template             | File                  | Subject                          |
| -------------------- | --------------------- | -------------------------------- |
| Confirm signup       | `confirm-signup.html` | Confirm your Punchcard email     |
| Reset password       | `reset-password.html` | Reset your Punchcard password    |
| Change email address | `change-email.html`   | Confirm your new Punchcard email |

Also check **Authentication → URL Configuration**: Site URL = `https://trackmylogs.netlify.app` (plus any custom domain) and the same under Redirect URLs.

> Supabase's built-in mail sender is rate-limited and meant for testing. For real users, configure a custom SMTP provider (e.g. Resend, Brevo, SendGrid) under **Authentication → Emails → SMTP Settings**.

## 4. Custom domain (optional)

Netlify → **Domain management → Add a domain** → follow the DNS steps (Netlify issues the HTTPS certificate automatically). Then add the new URL to Supabase's Site URL / Redirect URLs (section 3).

## 5. Database backups

`.github/workflows/backup.yml` runs every Monday 02:00 IST (and on demand from the Actions tab). It dumps roles, schema and data (including auth users) with the Supabase CLI, **encrypts** the archive with a passphrase and stores it as a workflow artifact for 90 days. Encryption matters: artifacts of a public repo can be downloaded by any signed-in GitHub user.

Setup — GitHub → Settings → Secrets and variables → Actions → **New repository secret**:

- `SUPABASE_DB_URL` — Supabase → **Connect** → _Session pooler_ connection string (port **5432**), with your database password filled in. (The direct connection is IPv6-only, which GitHub runners can't reach.)
- `BACKUP_PASSPHRASE` — a long random passphrase. **Keep it in your password manager**; without it the backups can't be opened.

Then Actions → **Database backup → Run workflow** once to confirm it's green.

### Restore

```bash
# 1. Download the artifact zip from the workflow run and unzip it, then:
gpg --decrypt punchcard-db-YYYY-MM-DD.tar.gz.gpg | tar -xzf -      # asks for BACKUP_PASSPHRASE
# 2. Into a NEW, empty Supabase project (session-pooler URL of that project):
psql "$TARGET_DB_URL" --single-transaction --variable ON_ERROR_STOP=1 \
  --file backup/roles.sql --file backup/schema.sql \
  --command 'SET session_replication_role = replica' --file backup/data.sql
```

Then point Netlify's `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE`, `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` at the new project and redeploy. Practise this once on a throwaway project so it's not the first time during an incident.

## 6. Routine checks

| What             | Where                                     | Expect                                                                                |
| ---------------- | ----------------------------------------- | ------------------------------------------------------------------------------------- |
| Auto-close       | Netlify → Logs → Functions → `auto-close` | A run every 30 min, "closed N session(s)"                                             |
| Backups          | GitHub → Actions → Database backup        | Weekly green run with an artifact                                                     |
| Dependencies     | GitHub → Pull requests (Dependabot)       | Weekly grouped PR; merge when CI is green                                             |
| Errors           | Sentry (if enabled)                       | No new issues after a deploy                                                          |
| Free-tier limits | Netlify usage, Supabase usage             | Well within limits; note Supabase pauses free projects after ~7 days without activity |

## 7. Rotating secrets

If the service-role key or database password may have leaked: Supabase → Project Settings → API / Database → regenerate → update Netlify (`SUPABASE_SERVICE_ROLE`) and GitHub (`SUPABASE_DB_URL`) → redeploy.
