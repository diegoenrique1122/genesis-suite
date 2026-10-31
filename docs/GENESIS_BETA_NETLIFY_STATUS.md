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

Application baseline: bdcbe4d81316d7fefbbdd241a5c4802aed68056c.
Deployed beta commit: 81f42886ef73e421db68f001ef704606d3b3450e.
This record is stored on the development branch to avoid triggering another build.

## Release boundary

This is a review candidate, not the completed public beta.
The seven-profile matrix, Women's Performance, Discipline and remaining
acceptance work remain governed by GENESIS_BETA_EMERGENCY_RELEASE.md.
No database writes, user-data deletion or merge to main is part of this deploy.

## Deployment verified

- Netlify displayed "Deploy successful" and "Your deploy completed successfully".
- Deploy ID: 6ae602fb3d48f97d11ac98f8.
- Deploy details: https://app.netlify.com/projects/genesis-os-pro/deploys/6ae602fb3d48f97d11ac98f8
- Candidate URL: https://beta--genesis-os-pro.netlify.app/
- Build completed on 2026-10-31, 11:02:20–11:02:38 America/New_York.
- The public candidate was opened and the Genesis OS restricted access portal rendered.
- This verifies deployment and the unauthenticated login screen only.
- Authenticated profile flows, signup/recovery redirects, the 144 review cases,
  Women's Performance and Discipline are not accepted by this deployment check.
- Continue from this deployed candidate; do not restart repository recovery or
  repeat completed Netlify branch/environment configuration.

Production remains on main. No application code, database or image lifecycle was
changed by this deployment record.
