# imanprojects

Iman x Zaal action tracker. Next.js 15 app w/ password login, edit-in-browser, persistent state via GitHub Contents API.

Live data lives in `data/actions.json`. Every save commits back to the repo, so the git history IS the audit log.

## Stack
- Next.js 15 (App Router) + React 19
- Tailwind v3
- Server actions + HMAC-signed cookie auth (no DB, no NextAuth)
- Persistence: GitHub Contents API write-back to `data/actions.json` (fallback to local FS in dev)

## Local dev
```bash
npm install
cp .env.example .env.local
# fill in ZAAL_PASSWORD, IMAN_PASSWORD, AUTH_SECRET
# (GITHUB_TOKEN optional locally - falls back to writing data/actions.json directly)
npm run dev
```

Open `http://localhost:3000` -> redirects to `/login`.

## Deploy to Vercel
1. Import this repo in Vercel.
2. Add env vars in Vercel project settings:
   - `ZAAL_PASSWORD` - Zaal's password
   - `IMAN_PASSWORD` - Iman's password
   - `AUTH_SECRET` - 32+ random hex chars (`openssl rand -hex 32`)
   - `GITHUB_TOKEN` - fine-grained PAT w/ `contents:write` on `bettercallzaal/imanprojects`
   - `GITHUB_REPO` - `bettercallzaal/imanprojects`
   - `GITHUB_BRANCH` - `main`
3. Deploy. Each save in the app commits to `main`, which triggers a rebuild.

## Auth model
- Two passwords. One per user (Zaal, Iman). Set in env.
- Login sets HMAC-signed httpOnly cookie. 30-day expiry. No password reset flow - rotate via env var.
- Middleware checks cookie presence; server-side verifies signature.

## Data model
`data/actions.json`:
```json
{
  "updatedAt": "ISO timestamp",
  "items": [
    {
      "id": "1",
      "title": "...",
      "owner": "Zaal | Iman | both",
      "status": "TODO | WIP | BLOCKED | DONE",
      "due": "free-form date or label",
      "notes": "..."
    }
  ]
}
```

## Why GitHub-backed instead of DB
- Zero infra. No KV, no Postgres, no Supabase.
- Free on Vercel hobby tier.
- Audit log = git log.
- Tradeoff: ~30s lag on save while Vercel rebuilds. Fine for a tracker.

## Migration path -> ZAO OS
Once Iman is comfortable, port the tracker into ZAO OS as a native module. Source-of-truth shifts from `data/actions.json` to ZAO OS DB. This app stays as a fallback.
