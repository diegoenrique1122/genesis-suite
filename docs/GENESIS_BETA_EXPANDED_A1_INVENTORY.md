# Genesis - Expanded Beta Source Inventory

Date: 2026-10-24
Audited source: 73b9db823895ff2cee278bfec21e1389974f1b30
Branch: rebuild/core-architecture

## Evidence boundary

This checkpoint records a source-code inventory.
It does not certify deployed schema, runtime behavior or medical validity.
A0 confirmed clean Git parity and no listeners on local laboratory ports.
Remote schema verification remains a separate checkpoint.

## Expanded beta scope

- Complete visual review of every beta-visible application.
- Professional, data-backed Coach and Super Admin dashboards.
- TrainerPro, structured nutrition and Discipline integration.
- Women's Performance with consent, history and authorized coach review.
- Running and long-distance triathlon plans, sessions and progress.
- Manual activity entry supported before automatic wearable integration.
- Every visible feature must work end to end.

## Source findings

### TrainerPro

Training execution, per-set performance and program-scoped history exist.
Preserve athlete_training_sessions as the execution ledger.
Historical recommendations do not automatically overwrite approved routines.

### El Arquitecto

Nutrition currently uses custom_macros and weekly calendars in profile JSON.
Nutrition also writes routine_status, coupling nutrition and training approval.
Food selection uses random choices and approximate portion calculations.
Introduce an independent, versioned nutrition domain before Women's integration.

### Discipline

Daily check-ins use save_daily_discipline_checkin and daily_logs.
Water, sleep, steps, training completion and meal compliance exist.
Add structured subjective recovery inputs and preserve data provenance.

### Women's Performance

RegulacionHormonal.jsx currently uses fixed calendar phases and advice.
It stores hormonal_data without a dedicated consent/history workflow.
Coach detail duplicates hormonal advice.
Replace this implementation with the approved domain and shared presentation.

Menstrual-cycle context and training mesocycle are separate concepts.
The application must distinguish reported, estimated and measured information.
It must not claim to diagnose hormonal conditions or guarantee hormonal regulation.

### Running and triathlon

No dedicated application routes, services or domain migrations were identified.
Implement goals, calendars, plans, actual sessions and progress for supported sports.
Manual records must be distinguishable from provider-imported records.

### Coach and Super Admin

Shared shell and UI primitives already exist.
ClientProfile still exposes arbitrary chart dataset editing.
SuperAdminDashboard remains a large combined component.
Chart.js is available; avoid adding another chart library.

### Wearables

syncWearableData.js generates random metrics.
It must not supply production metrics or readiness recommendations.
Audit invocation paths and existing record provenance before any cleanup.

## Integration rules

- Architect owns approved nutrition-plan versions.
- TrainerPro owns approved training plans and actual execution records.
- Discipline owns daily check-ins and reported adherence/recovery inputs.
- Women's Performance references those sources and approved adaptations.
- Avoid creating conflicting independent copies of approved plans.
- Proposed plan changes require authorized review and an auditable version.
- Consent revocation must be enforced at the data-access boundary.
- Missing data must remain missing; never fabricate scores or trends.

## Visual acceptance

Use the shared Genesis visual foundation across beta-visible screens.
Charts need timeframe, source, units, comparison target and useful interpretation.
Provide loading, empty, error and insufficient-data states.
Do not connect missing observations as though they were measured.
Provide readable mobile layouts and accessible alternatives to color-only meaning.
Keep the canonical limits of one summary chart and three athlete-detail charts.

## Dependency order

1. Verify remote schema, migration parity and preservation requirements.
2. Define independent nutrition approval and versioned meal-plan contracts.
3. Extend structured recovery inputs and cross-application read contracts.
4. Implement Women's consent, history, agendas and reviewed adaptations.
5. Implement running and triathlon planning/execution/progress.
6. Complete shared charts and Coach/Super Admin visual migration.
7. Run entitlement, privacy, integration and responsive QA.
8. Produce a release candidate and validate the deployed beta.

## Release boundary

The earlier 22-session estimate does not cover this expanded scope.
Re-estimate after the schema and implementation-contract audit.
No destructive migration, account reset or legacy-data deletion is authorized
by this inventory.

## A1.2 - Remote schema audit

Audit date: 2026-10-24
Project: kfcprkjhlcimdfcxputm
Project status confirmed: ACTIVE_HEALTHY

- Repository and remote migration ledgers contain 52 matching versions/names.
- This comparison does not establish checksum or complete schema equivalence.
- Inspected operational tables have RLS enabled and authenticated policies.
- Structural inspection does not replace authenticated isolation tests.
- No schema or application-data writes were performed during this audit.

### Preservation baseline

Aggregate counts at audit time:
- Athlete profiles, including operational profiles: 12.
- Profiles with custom_macros: 6, all stored as JSON objects.
- Profiles with hormonal_data: 1.
- Profiles with training_plan: 2.
- Profiles with nutrition_plan: 0.
- Athlete programs: 0.
- Training sessions: 0.
- Daily logs: 2.
- Daily metrics: 0.

The prior authenticated session fixtures belonged to the local Docker lab.
Do not copy test fixtures into the remote environment.
Activate the real beta athlete's program through the canonical authorized flow.

### Implementation decisions

- Introduce nutrition as an additive, independent domain.
- Keep nutrition approval separate from routine_status.
- Link new nutrition plans to the correct athlete and nutrition-capable program.
- Use versioned plans with meals, targets, effective dates and coach approval.
- Preserve existing JSON and legacy access during the controlled transition.
- Never infer actual consumed macros from meal-compliance checkboxes.
- Women's Performance must reference approved source-plan versions.
- No automatic legacy approval, consent fabrication or destructive cleanup.

Next implementation: A2.1 - additive nutrition domain foundation.

## A2.1 - Nutrition foundation validation

Validation date: 2026-10-24 (America/New_York).
Migration: 20261024234025_genesis_nutrition_domain_a21.sql.
Status: installed remotely and structurally audited; authoring/review RPCs pending.

- 61 isolated checks passed on PostgreSQL 17.5 / PGlite 0.3.14.
- R1 integration test passed on the existing local Supabase PostgreSQL 17.6.
- Local fixture: 3 users, 2 athlete profiles, 1 program and 1 training session.
- Owner and second-athlete isolation passed across the nutrition hierarchy.
- Ignicion approved-only reads and Evolucion/Elite draft reads passed.
- Browser writes, anonymous access and cross-plan activation were rejected.
- Approved versions and meal content remained immutable.
- SQL roles/claims were tested; this is not a REST login test.
- ROLLBACK removed all new nutrition objects.
- Legacy row digests, including the original coach plan, remained unchanged.
- Reproducible local fixture test: tools/local-lab/genesis_a21_nutrition_transaction_test.sql.
- The test template requires insertion of the reviewed migration at its marker.
- Authoring/review RPCs and the application cutover are still pending.

Existing pre-beta security gates remain:
- Leaked-password protection: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- Final negative tests of the intentional program-activation privileged RPC: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- Review service-only no-policy tables without granting unnecessary browser access.
- Existing program FK-index and RLS-initplan findings remain separate maintenance work.

## A2.1 - Remote installation closed

Migration 20261024234025 was installed in project kfcprkjhlcimdfcxputm.
Post-installation dry-run reports no pending migrations.

Remote audit confirmed:
- Migration ledger contains 53 entries and the expected nutrition migration.
- All four nutrition tables exist with RLS enabled.
- All four policies authorize SELECT for authenticated users only.
- Browser roles have no direct write privileges.
- Anonymous users cannot execute the private nutrition functions.
- Private functions retain an empty search_path.
- The new nutrition tables contain zero rows.
- All seven pre-installation legacy row digests match exactly.
- Security advisors report no new nutrition-related security findings.
- Previously recorded pre-beta security gates remain pending.

A2.1 foundation is closed.
Application screens still use their existing data path.
No legacy import or user-plan activation was performed.

Next: A2.2 - authorized nutrition authoring, submission and coach review.
Then connect El Arquitecto to the versioned domain before integrating
Women's Performance agendas.

## A2.2B - Nutrition authoring locally validated

Validation date: 2026-10-30.
Source baseline: 95e554d1b9fa6ee9a6e2890e4e19a612e0b02105.
Migration: 20261030211351_genesis_nutrition_authoring_a22.sql.
Status: installed remotely and structurally audited; application integration pending.

- 73 PASS checks on embedded PostgreSQL 17.5 / PGlite 0.3.14.
- The same 73 checks passed in the existing local Supabase Docker lab.
- Coach Evolucion/Elite and Super Admin authoring/review paths passed.
- Athlete, Ignicion, anonymous and suspended-actor writes were rejected.
- Assignment, program lifecycle and stale-revision checks passed.
- Invalid saves rolled back atomically; submitted/reviewed content stayed immutable.
- Review records the authenticated reviewer, server time and mandatory note.
- Approval does not select or activate a version.
- Complete schema rollback and all seven legacy data digests passed.
- Test: tools/local-lab/genesis_a22_nutrition_authoring_transaction_test.sql.
- Test template requires both the A2.1 and A2.2 migration insertion markers.
- REST login and simultaneous multi-connection concurrency tests remain pending.
- Athlete proposals, activation and application cutover remain pending.
- Existing pre-beta security gates remain pending.

## A2.2D - Remote authoring installation audited

Audit date: 2026-10-30.
Project: kfcprkjhlcimdfcxputm.
Migration: 20261030211351_genesis_nutrition_authoring_a22.sql.
Source commit: 28fc3d307a83460e9a60010afb95361be4ebaddd.

Remote structural audit confirmed:
- Migration ledger contains 54 entries; the latest is the expected A2.2 migration.
- Three public SECURITY INVOKER RPCs and one private SECURITY DEFINER implementation exist.
- All four new functions have empty search_path and deny anonymous execution.
- Authenticated execution is granted; authorization is enforced inside the private implementation.
- draft_revision is integer, NOT NULL, with default 1.
- All four nutrition tables retain RLS and authenticated SELECT policies.
- Browser roles retain no direct table-write privileges.
- Counts and all eleven table digests match the pre-installation baseline exactly.
- All four nutrition tables remain empty.
- Security advisors contain no new nutrition-related findings.
- Post-installation CLI dry-run reports no pending migrations.

The authoring/review database installation is closed.
Functional validation remains the 73 checks passed in the local Supabase lab.
Remote structural checks do not replace REST login or concurrent-session tests.
No plan was activated, no legacy JSON was imported, and no application screen was switched.

Next: authorized version selection and effective-plan reads, followed by
Arquitecto integration and authenticated end-to-end validation.
Athlete proposals and existing pre-beta security gates remain pending.

## A2.3A - Selection and effective reads locally validated

Validation date: 2026-10-30.
Source baseline: dbb48e1a00a1cd1d618bfb0dfd10d3a1942f5913.
Migration: 20261031000001_genesis_nutrition_selection_a23.sql.
Status: installed remotely and structurally audited; application integration pending.

- 152 PASS checks on embedded PostgreSQL 17.5 / PGlite 0.3.14.
- The full transactional suite passed in the existing local Supabase Docker lab.
- Selection is restricted to approved versions and authorized Evolucion/Elite coaches or Super Admin.
- Selection revisions reject stale clients, including switching back to an earlier selection.
- Effective reads enforce athlete isolation, program lifecycle and version date windows.
- Date boundaries, New York daylight-saving transitions and empty/future/expired states passed.
- Training-day meals replace the full everyday set; rest days fall back to the full everyday set.
- Full rollback and all seven legacy data digests passed.
- Test: tools/local-lab/genesis_a23_nutrition_selection_transaction_test.sql.
- REST login, multi-session concurrency and remote structural audit remain pending.
- Application screens remain on their existing data path; no plan was selected remotely.

Next: A2.3B - guarded remote dry-run and installation review.
Then connect El Arquitecto to the authorized effective-plan read contract.
Athlete proposals, legacy import and existing pre-beta security gates remain pending.

## A2.3B - Remote selection and effective-read installation audited

Audit date: 2026-10-31.
Project: kfcprkjhlcimdfcxputm.
Migration: 20261031000001_genesis_nutrition_selection_a23.sql.
Source commit: bd4f9175b64b2c611811239e79a44f8bb258d56d.

Remote structural audit confirmed:
- Migration ledger contains 55 entries; latest is 20261031000001.
- Post-installation CLI dry-run reports no pending migrations.
- selection_revision is integer NOT NULL DEFAULT 0; selected_by and selected_at are present.
- Both public RPC wrappers are SECURITY INVOKER with empty search_path.
- Private selection/read functions use SECURITY DEFINER with empty search_path and enforce actor authorization.
- Anonymous execution is denied; authenticated direct table UPDATE is denied.
- All four nutrition tables retain RLS and authenticated SELECT policies.
- All four nutrition tables remain empty.
- Counts and all eleven table digests exactly match the pre-installation baseline.
- Security advisors show the same pre-existing findings and no new A2.3 findings.

A2.3 selection and effective-read database installation is closed.
Local integration passed 152 embedded checks and the full local Supabase transaction suite.
Remote structural checks do not replace REST login or multi-session concurrency tests.
No plan was selected remotely and no application screen was switched.

Next: connect El Arquitecto to the authorized effective-plan read contract,
then run authenticated end-to-end and concurrency validation.
Athlete proposals, legacy import and existing pre-beta security gates remain pending.

## A2.4 - El Arquitecto effective-plan read integration

Validation date: 2026-10-31.
Code commit: 2d3a328156f9de8d08463b7661d010a3a5cc7ac1.
Status: code committed and pushed; authenticated end-to-end validation pending.

- El Arquitecto now detects an athlete program with NUTRITION or BOTH service focus.
- For that program, a read-only panel requests genesis_get_effective_nutrition_plan and renders its effective state, approved targets, meals and items.
- The athlete can request everyday, training-day or rest-day presentation; the database resolves the effective version and meal set.
- Loading, empty and request-error states are visible. No nutrition values are fabricated when the effective plan is absent.
- The old macro/calendar presentation and legacy recalibration/generator actions are suppressed for athletes with a nutrition-capable program.
- Profiles without such a program retain the existing path during the controlled transition.
- Targeted ESLint and Vite production build passed locally (2093 modules); git diff --check passed.
- The commit contains exactly src/pages/ElArquitecto.jsx and src/components/NutritionEffectivePlan.jsx.
- The local branch and origin/rebuild/core-architecture matched with a clean worktree after push.
- No database migration, remote plan selection, legacy JSON import or production user-plan activation was performed in A2.4.
- REST login, authenticated athlete/coach end-to-end reads, multi-session concurrency and browser acceptance remain pending.
- Athlete proposals and existing pre-beta security gates remain pending.

Next: validate the authorized read path with real authenticated roles and program states,
then implement coach authoring/review UI and the remaining controlled application cutover.

## Master roadmap proposal - Athlete Memory Vault

Planning date: 2026-10-30 (America/New_York).
Status: refined idea for product planning; no schema or application implementation in this checkpoint.
Scope: an additive post-beta product track. Existing athlete records, application flows
and approved plans remain authoritative. This track does not change the beta gates.

### Product promise

A coach should understand an athlete's progress from a trustworthy daily timeline,
without opening a photo gallery. Photos are optional evidence, not the source of
truth. Call the feature "Genesis Memory Vault" in planning; final product naming
remains a design choice.

### Daily ledger and weekly pulse

- A program-scoped, athlete-owned daily record consolidates check-ins, training
  completion, meals marked complete, steps, and recorded activities. Link to the
  canonical Discipline, TrainerPro, nutrition and sport records; do not copy or
  overwrite their authoritative events.
- Distinguish planned, completed, self-reported, device-imported, and missing
  observations. An unreported day is not automatically a failed day.
- Show completed days against a declared schedule, meals marked complete against
  scheduled meals, daily steps, and weekly totals with missing-day coverage.
- Weekly distance sums recorded activity distances with their units and source.
  Convert known km/miles exactly for display; never silently derive distance
  from steps. An estimated step distance, if offered, must be labeled estimated.
- Show prescribed plan calories and meal adherence separately. Show actual
  calories consumed only when an athlete explicitly logs quantities/intake.
  Meal-compliance checkboxes cannot prove calories consumed.
- Weekly coach card: coverage, adherence trend, activity distance, steps,
  training consistency, optional subjective recovery, and a short list of
  follow-ups; no fabricated score or medical inference.
- Read access follows the athlete/program/coach entitlement boundary, with
  historical coach assignment and revocation handled explicitly.

### Visual evidence: 24-hour meals and baseline-to-latest progress

- This feature is additive: it does not remove existing records, screens,
  training history, nutrition plans or the compact daily/weekly data history.
  The photo policy applies to image objects and their disposable previews.
- Meal photos are optional and private. Each becomes eligible for deletion
  24 hours after upload; an hourly cleanup worker removes it and verifies
  removal. Show the exact expiry time at upload. The meal-compliance event
  survives photo deletion, with no retained thumbnail or public URL.
- The first complete front, side and back set is the athlete's baseline.
  Keep those three originals as the comparison reference while the athlete
  account and required consent remain active; applicable deletion duties
  still govern withdrawal, account closure and legal exceptions.
- A coach chooses the progress-photo refresh cadence. Remind coach and
  athlete as the next date approaches; the date is a prompt, not automatic
  deletion of the currently displayed set.
- Keep one current front/side/back set in addition to the baseline. On a
  complete new set, validate all three uploads and metadata, switch the
  current pointer atomically, then delete the old current set. A failed or
  partial upload cannot erase the previous set. On the first capture, the
  baseline and current pointers may refer to the same three objects.
- Side-by-side comparison always shows the fixed baseline versus the latest
  complete set, with capture dates and consistent orientation. Intermediate
  sets are not promised as a historical gallery. Before replacement, offer
  explicit download of the outgoing set to the device or optional Drive export;
  the coach chooses whether to keep a personal archive.
- Private access follows athlete/program/coach authorization and consent.
  The cleanup worker uses the Storage API, verifies object removal and
  records a non-sensitive receipt; failed deletions retry and alert operations.
  Photo deletion never changes the canonical daily ledger. Backup retention
  and exports outside Genesis require explicit policy and disclosure.

### Export and coach choice

- One-click CSV and XLSX export of the daily ledger and weekly summaries,
  with a data dictionary, units, timezone, source labels and export range.
  Optional ZIP of selected photos and a manifest stays separate from Excel.
- Start with direct device download. Later offer opt-in Google Drive export
  through a narrow per-file OAuth scope, explicit destination, connection
  revocation and clear quota responsibility. Google Drive is a coach-controlled
  export destination, not Genesis's primary application database.
- Show a live 24-hour countdown for meal photos. Progress-photo reminders
  refer to the coach's refresh date, and an outgoing set is offered for
  export before replacement. Show last successful export and any error;
  never imply an export succeeded merely because it was requested.

### Low-cost architecture and commercial guardrails

- Reuse the existing Supabase project: canonical relational records in
  Postgres, a private Storage bucket for photos, RLS and short-lived signed
  access where appropriate, scheduled cleanup through Cron/Edge Functions.
- Meter per-coach active athletes, photo count/bytes, download traffic and
  export size; add tier quotas and alerts before any paid overage. Compress
  uploads on the client without discarding originals when retention requires
  them; avoid generating unnecessary variants.
- Free hosting is appropriate for prototype scale, not an unlimited B2B
  promise. At the reviewed pricing, Supabase Free includes 500 MB database,
  1 GB file storage and 5 GB egress; all are shared project allowances.
  Example: 100 coaches x 20 athletes x six distinct 400 KB progress photos
  (baseline plus latest) is about 4.8 GB of retained photos, before
  transient meal photos, previews and downloads. First capture reuses its
  three baseline objects as current, so it initially needs only three.
- Storage provider abstraction can be evaluated later if measured traffic
  warrants it. Avoid introducing a second provider before authorization,
  deletion and export behavior work end to end on one provider.

### Delivery gates

1. Define consent, retention, tenant isolation, quotas and data dictionary.
2. Implement daily ledger projections and coach weekly pulse from canonical
   records; validate provenance and missing-data behavior.
3. Implement private meal photos with 24-hour expiry and baseline/current
   progress sets with safe three-photo replacement, access logs and deletion.
4. Implement refresh reminders, direct exports, audit receipts and recovery
   for failed uploads or deletions.
5. Validate multi-coach isolation, cost per active athlete, and actual cleanup.
6. Add opt-in Drive export after direct exports are reliable.

### Master progress ledger (strict completed gates)

These bars count completed release gates, not percent of source code written.
Partial work inside a gate is described below and does not count as complete.

- Expanded beta, excluding Memory Vault: **1/8 = 12.5%**  █░░░░░░░
  Gate 1 remote schema/preservation audit closed. Gate 2 nutrition contracts
  and El Arquitecto read integration advanced through A2.4; authenticated
  REST, coach authoring UI and controlled cutover remain. Gates 3-8 remain:
  recovery/read contracts, Women's consent/agendas, running/triathlon,
  dashboards/charts, privacy/integration QA, deployed release candidate.
- Full product without Memory Vault: **1/12 = 8.3%**  █░░░░░░░░░░░
  The same eight beta gates plus four provisional commercial gates:
  multi-coach tenancy and entitlements, self-service onboarding/billing,
  production operations/support, and measured wearable/interoperability work.
- Full product with Memory Vault: **1/13 = 7.7%**  █░░░░░░░░░░░░
  Adds the Memory Vault delivery track above as one full-product gate.
  The beta numerator and denominator stay unchanged.

The four commercial gates and their weights require a later product audit.
Update these bars only when a gate has evidence of completion; keep a
separate in-progress view for work like A2.4. This is a conservative roadmap
measure, not a delivery-date forecast.

### Work log and remaining effort at 22:00

User-reported work window: 2026-10-30, 18:00-22:00 America/New_York.
Elapsed: 4 hours, equivalent to two 2-hour work blocks. During this
window, the A2.4 El Arquitecto read integration was validated, committed
and documented; the Memory Vault concept and its revised photo retention
rules were added to this roadmap. The time was not tracked by subtask,
so these two blocks cannot honestly be attributed entirely to beta coding.

The following is the forward estimate as of the end of that window.
It already includes the A2.4 progress; do not subtract the same four hours
again. The previous 22-session estimate predates this expanded scope.

| Remaining expanded-beta workstream | 2-hour blocks | Hours |
| --- | ---: | ---: |
| Nutrition authenticated flows, coach UI and controlled cutover | 12-22 | 24-44 |
| TrainerPro visible flows and planned/actual history closure | 10-20 | 20-40 |
| Discipline and recovery data/provenance | 12-22 | 24-44 |
| Women's Performance consent, history and reviewed adaptation | 20-35 | 40-70 |
| Running/endurance/triathlon planning, execution and manual progress | 30-55 | 60-110 |
| Coach/Admin dashboards, charts, visual and mobile completion | 18-32 | 36-64 |
| Entitlements, isolation, privacy and integration QA | 24-40 | 48-80 |
| Deployed release candidate and beta acceptance | 8-15 | 16-30 |
| **Total remaining** | **134-241** | **268-482** |

Planning shorthand: about 135-240 focused 2-hour sessions (270-480
hours). At five sessions per week this is about 27-48 weeks; at ten,
about 14-24 weeks. These are ranges for one worker with usable access
and do not include waiting for external approvals or unforeseen rework.
The 1/8 release-gate bar is not a time-percentage estimate.

Beyond beta, the provisional full-product scope adds about 190-370
blocks (380-740 hours), including roughly 30-55 blocks (60-110 hours)
for Memory Vault. Thus the forward full-product estimate is about
324-611 blocks (648-1222 hours) including Memory Vault, or 294-556
blocks (588-1112 hours) excluding it. Re-estimate after an end-to-end
source and product audit; "complete" here means the current version-1
product contract, not an end to future maintenance.

References checked during planning:
- Supabase pricing: https://supabase.com/pricing
- Private Storage buckets: https://supabase.com/docs/guides/storage/buckets/fundamentals
- Storage access control: https://supabase.com/docs/guides/storage/security/access-control
- Supabase Cron: https://supabase.com/docs/guides/cron
- Google Drive limited file scope: https://developers.google.com/workspace/drive/api/guides/api-specific-auth
