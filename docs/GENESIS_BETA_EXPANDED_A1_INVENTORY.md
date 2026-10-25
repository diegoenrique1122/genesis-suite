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
Status: locally validated with rollback; remote installation pending.

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
