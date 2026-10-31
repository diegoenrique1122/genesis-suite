# Genesis beta — Netlify deployment record

Date: 2026-10-31 (America/New_York).
Project verified in signed-in Netlify UI: genesis-os-pro.
Repository verified: diegoenrique1122/genesis-suite.
Project ID: 4259b678-07de-4147-9308-df3a18731d23.

## Configuration confirmed

- Production branch remains main.
- Additional branch deploys: beta only.
- Build command: npm run build.
- Publish directory: dist.
- Node.js: 24.x.
- VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY exist for all deploy contexts.
- No environment-variable values were copied into this record.

This commit records branch activation and triggers the first beta branch build.
It changes documentation only; application baseline is
bdcbe4d81316d7fefbbdd241a5c4802aed68056c.

## Release boundary

This is a review candidate, not the completed public beta.
The seven-profile matrix, Women's Performance, Discipline and remaining
acceptance work remain governed by GENESIS_BETA_EMERGENCY_RELEASE.md.
No database writes, user-data deletion or merge to main is part of this deploy.

Deployment outcome, generated URL and deploy ID must be verified in Netlify.
Do not infer publication from branch configuration alone.
