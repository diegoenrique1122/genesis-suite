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