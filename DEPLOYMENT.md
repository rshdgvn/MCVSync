# Deployment

| Piece | Host | URL |
| --- | --- | --- |
| Database | Supabase (Postgres, Singapore) | private |
| API + Reverb + queue worker | Render, one Docker web service (Singapore) | `https://mcvsync.onrender.com` |
| Staff app | Vercel, root directory `app` | `https://mcvsync-app.vercel.app` |
| Client portal | Vercel, root directory `portal` | `https://mcvsync-portal.vercel.app` |
| Email | Brevo SMTP | — |

## How the pieces talk

- Each Vercel site rewrites `/api/*` and `/sanctum/*` to the Render API (`vercel.json`). The browser only ever talks to its own Vercel domain, so the Sanctum session cookie is first-party. This works in every browser, including Safari, which blocks the cross-site cookies a direct `vercel.app -> onrender.com` setup would need.
- Websockets cannot go through Vercel, so the staff app connects straight to `wss://mcvsync.onrender.com/app/...`. Nginx in the container forwards `/app/` to Reverb. Private channel auth still goes through `/api/broadcasting/auth` on the Vercel domain, with the session cookie.
- The container (`api/Dockerfile`) runs nginx, PHP-FPM, Reverb and `queue:work` under supervisord. Broadcast events are queued, so the queue worker is required for realtime.
- On every boot the container runs `migrate --force` and `db:seed --force`. The seeders are idempotent. Demo staff are never created in production.

## Env files

| File | Committed | Where it goes |
| --- | --- | --- |
| `api/.env.production` | no (gitignored, contains secrets) | Render > mcvsync-api > Environment > **Add from .env** |
| `app/.env.production` | yes (public values only) | used automatically by `vite build` on Vercel |
| `portal/.env.production` | yes (public values only) | used automatically by `vite build` on Vercel |

`api/.env.production` already holds a generated `APP_KEY`, Reverb credentials and a super admin password. Fill in every `PASTE_...` value before pasting it into Render.

## 1. Supabase

1. Create a project in region **Southeast Asia (Singapore)**. Save the database password.
2. Click **Connect** and choose **Session pooler**. Do not use the direct connection: it is IPv6-only and Render cannot reach it. From `postgresql://USER:PASSWORD@HOST:5432/postgres`:
   - `DB_HOST` = HOST (looks like `aws-0-ap-southeast-1.pooler.supabase.com`)
   - `DB_USERNAME` = USER (looks like `postgres.abcdefghijklmnop`)
   - `DB_PASSWORD` = the database password
3. In **Project Settings > Data API**, turn the Data API **off**. The app never uses it. Left on, every table in `public` (including `users`) is reachable through Supabase's REST endpoint with the publishable anon key.

## 2. Brevo (email)

1. Create a free account (300 emails/day).
2. In **Senders, Domains & Dedicated IPs**, add and verify the sender email. Put it in `MAIL_FROM_ADDRESS`.
3. In **SMTP & API > SMTP**, copy the login into `MAIL_USERNAME` and generate an SMTP key for `MAIL_PASSWORD`.

Mail sent from a free Gmail address often lands in spam. A custom domain verified in Brevo fixes that.

## 3. Render (API)

1. Fill in `SUPER_ADMIN_EMAIL` in `api/.env.production` with a real inbox you control.
2. Push the repo to GitHub.
3. In Render, choose **New > Blueprint** and select the repo. It reads `render.yaml` and creates `mcvsync-api` (Docker, Singapore, Starter).
4. Under **Environment**, choose **Add from .env** and paste the whole of `api/.env.production`. Save. The service redeploys.
5. Check `https://mcvsync.onrender.com/up`. It should show "Application up".

If the name `mcvsync-api` is taken, Render gives a different URL. Update it in `APP_URL`, both `vercel.json` files and `VITE_REVERB_HOST` in `app/.env.production`.

## 4. Vercel (app and portal)

Do this twice, once per frontend:

1. **Add New > Project**, import the repo.
2. Project name `mcvsync-app` (or `mcvsync-portal`). **Root Directory** `app` (or `portal`). Framework preset Vite.
3. Deploy. No environment variables are needed.

If Vercel assigns a different domain, update `FRONTEND_URL` / `PORTAL_URL`, `SANCTUM_STATEFUL_DOMAINS` and `REVERB_ALLOWED_ORIGINS` in Render. Use bare hostnames, no `https://`, in the last two.

## 5. Smoke test

1. Open the staff app, log in as the super admin, open Items and Categories.
2. Switch to the Purchasing view in a second tab, receive stock, and watch the first tab update without a refresh (Reverb).
3. Use **Forgot password** with the super admin email and confirm the email arrives with a working link.
4. Open the portal and confirm it loads the catalog.
5. If anything fails, check the Render **Logs** tab. All PHP, nginx, Reverb and queue output goes there.

## Demo accounts

Off in production by default. To show the system to others, set these in Render and redeploy:

```
SEED_DEMO_ACCOUNTS=true
SEED_USER_PASSWORD=<a strong password you share with testers>
```

This creates one account per staff role (`sales`, `purchasing`, `accounting`, `logistics`, `admin`, `superadmin` @mcvsync.test) and one portal client (`client@mcvsync.test`), all with that password. The emails are public, so use a strong password. Before real use, set `SEED_DEMO_ACCOUNTS=false` and deactivate those accounts from Employees.

## Costs and limits

| Service | Plan | Why |
| --- | --- | --- |
| Render | Starter, $7/mo | Free instances sleep after 15 min idle (drops websockets, stops the queue worker, ~1 min cold start) and block outbound SMTP. |
| Supabase | Free | 500 MB database. Free projects pause after a week with no activity. |
| Vercel | Hobby, free | Hobby is for non-commercial use. A business deployment needs Pro. |
| Brevo | Free | 300 emails/day. |

## Upgrade path: custom domain

With a domain (e.g. `mcvsync.com`), point `app.`, `portal.` and `api.` at the three services. Update `FRONTEND_URL`, `PORTAL_URL`, `APP_URL`, `SANCTUM_STATEFUL_DOMAINS`, `REVERB_ALLOWED_ORIGINS`, `VITE_REVERB_HOST` and the `vercel.json` rewrite targets. Verify the domain in Brevo for better email delivery.
