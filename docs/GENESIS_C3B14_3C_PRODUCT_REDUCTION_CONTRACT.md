# Genesis C3B14.3C — Product Reduction & Canonical UX Contract

## Status

- Contract version: 1.0
- Baseline commit: `1d26f391e3c4078b21152211458e46b7869d0238`
- Canonical branch: `rebuild/core-architecture`
- Product audit: `C3B14.3A` closed
- Source and visual audit: `C3B14.3B` closed
- Supabase project: `kfcprkjhlcimdfcxputm`
- Production branch `main` remains untouched.

## Purpose

This contract prevents product drift during the Genesis OS redesign.

Genesis must become simpler, more professional and easier to operate without
removing the canonical applications or services promised for the beta.

The redesign is not permission to delete a capability from the roadmap.
It is permission to reduce visual noise, remove duplication and rebuild weak
implementations around canonical domain contracts.

## Non-negotiable beta rule

Every feature visible to a beta user must work end to end.

A beta-visible feature must have:

1. A real user flow.
2. Persistent canonical data.
3. Correct role, mode and plan authorization.
4. Athlete-to-coach synchronization where applicable.
5. Loading, empty, error and recovery states.
6. Mobile and desktop usability.
7. Privacy and consent where applicable.
8. Positive and negative tests.
9. No decorative or dead controls.
10. No mock data represented as real data.

Incomplete functionality must remain hidden behind a feature flag or entitlement
until its complete Definition of Done is satisfied.

## Canonical identity and plans

### Roles

- `SUPER_ADMIN`
- `COACH`
- `ATHLETE`

### Modes

- `ADMIN`
- `COACH`
- `ATHLETE`

### Plans

Coach and Athlete plan identifiers remain:

- `IGNICION`
- `EVOLUCION`
- `ELITE`

Basic and VIP are product presentation categories. Database authorization must
continue to derive from canonical B2B/B2C plans and entitlements.

`selected_app_single` remains supported for single-service activation.

Coaches retain authority to define flexible package duration in days, weeks,
months or years through the canonical `athlete_programs` contract.

## Canonical applications

### TrainerPro

TrainerPro is the canonical training application.

Its target product contract includes:

- Coach-approved program structure.
- Planned weekly sessions.
- Actual workout sessions.
- Planned versus executed muscle groups.
- Per-set repetitions and optional load.
- Unit-aware kg/lb presentation.
- RIR or perceived effort where enabled.
- Session start and completion.
- Weekly mini-calendar.
- Progressive overload history.
- Deload signals.
- Coach notes and revisions.
- Exercise instructions and verified external resources.
- Gym and home alternatives.
- Exercise dictionary backed by the canonical exercise catalog.

A planned workout must never be overwritten when the athlete executes a
different session. Planned and actual history must remain independently
auditable.

The existing `training_plan` JSON is transitional and must not become the
long-term session ledger.

### El Arquitecto

El Arquitecto is the canonical nutrition application.

The current free-form weekly grid will be replaced by a structured professional
plan editor.

The canonical experience includes:

- Calorie targets.
- Macro targets where authorized.
- Meal blocks.
- Food and portion guidance.
- Substitutions.
- Training-day and rest-day variants.
- Reusable coach templates.
- Plan versions.
- Effective dates.
- Athlete adherence.
- Coach review and adjustment.

Large tables, PDF and Excel exports must not dominate the main screen.
Exports belong in a secondary action menu.

Nutrition and training must not share one generic workflow status.

### Disciplina

Disciplina remains an Elite monitoring application.

It includes:

- Daily check-in.
- Habit adherence.
- Meal compliance.
- Private evidence.
- Streaks.
- Goals.
- System badges.
- Coach-created badges where entitled.
- Coach monitoring.

The current `daily_logs` foundation is retained but the interface must be
simplified.

### Genesis Women’s Performance System

Canonical full name:

`Genesis Women’s Performance System`

Canonical visible short name:

`Women’s Performance`

The historical internal identifier `HORMONAL` remains temporary compatibility
debt. A controlled migration may later introduce `WOMENS_PERFORMANCE`.

Eligibility remains restricted to the appropriate female Elite athlete context.

The application includes:

- Explicit consent.
- Private cycle information.
- Phase tracking.
- Symptoms.
- Energy and recovery.
- Training and nutrition context.
- Trends.
- Coach visibility only when authorized.
- Human-reviewed adjustment recommendations.

The application must not diagnose, treat or make categorical medical claims.

The current hard-coded hormonal recommendation engine is not beta-ready and
must remain hidden until replaced.

### Wearables & Recovery

Wearables are an Elite capability and a cross-application service.

Target sources include:

- Apple Health / HealthKit.
- Android Health Connect.
- Samsung Health where supported.
- Garmin and approved providers.
- A future aggregation provider when commercially appropriate.

Canonical wearable functionality includes:

- Explicit provider authorization.
- Revocation.
- Connection status.
- Last successful synchronization.
- Provider identity.
- Steps.
- Sleep.
- Heart rate.
- Resting heart rate.
- HRV.
- Recorded workouts.
- Distance and activity metrics where available.
- Normalized daily summaries.
- Recovery and readiness interpretations with traceable inputs.

`syncWearableData.js` is currently a mock and cannot be displayed as a working
integration.

### Running, Endurance & Ironman

Running/Endurance/Ironman remains in the canonical product map.

It will consume:

- Athlete goals.
- Availability.
- Training history.
- Nutrition context.
- Wearable activities.
- Recovery.
- Pace.
- Distance.
- Heart-rate zones.
- Training load.

It cannot be advertised as beta-functional until real activity, plan and
progress domains exist.

### Coach Command Center

The Coach Command Center must prioritize decisions and actions.

Primary hierarchy:

1. Athletes requiring attention.
2. Programs awaiting approval.
3. Adherence and recovery alerts.
4. Messages.
5. Expiring programs.
6. Business summary.

An athlete detail uses tabs:

- Summary
- Training
- Nutrition
- Discipline
- Recovery and wearables
- Women’s Performance when authorized
- Running/Endurance
- History and notes

The coach must not manually invent arbitrary chart datasets.

### Super Admin

The Super Admin surface must be separated into focused modules:

- Platform overview.
- Coaches.
- Athletes.
- Programs and plans.
- Payments and renewals.
- Announcements.
- Sponsorship inventory.
- Security and audit.
- Platform settings.

`SuperAdminDashboard.jsx` must not remain a monolithic command center.

Super Admin mode switching remains governed by canonical role/mode rules.

## Cross-platform services

The following services remain in scope:

- Notifications and Web Push.
- Chat.
- Coach communities.
- Announcements.
- Sponsorship placements.
- Payments and renewals.
- Evidence gallery.
- Automatic and coach-created badges.
- Coach branding and white-label.
- Assisted automation with human approval.
- Localization.
- Independent unit preferences.
- Consent and legal records.
- Audit logging.

## Product reduction decisions

### KEEP

- Identity and role architecture.
- Mode switching rules.
- Plan and entitlement engine.
- `athlete_programs`.
- Flexible package duration.
- Notification and Push foundation.
- Private evidence foundation.
- Chat security foundation.
- `daily_logs`.
- `athlete_daily_metrics`.
- Relational badges.
- `biomechanical_library`.
- Audit foundation.
- User locale and unit preferences.

### SIMPLIFY

- Athlete dashboard.
- Coach dashboard.
- Super Admin navigation.
- Discipline.
- Theme and branding.
- Coach settings.
- Notification Center.
- Onboarding.
- Athlete profile.

### MERGE

- Announcement mechanisms into one canonical domain.
- Community and chat overlap into one conversation architecture.
- JSON and relational badge storage into relational storage.
- Wearable JSON and normalized metrics into one provider-aware domain.
- Duplicate branding columns into one inherited brand configuration.
- Duplicate logo and watermark configuration.
- Repeated plan/status presentation logic.

### MOVE

- Export actions into secondary menus.
- Detailed tables out of summary dashboards.
- Long histories into detail views.
- Brand configuration out of operational dashboards.
- Security and audit data into administrative sections.
- Coach notes into their corresponding athlete domain.

### REPLACE

- Arbitrary coach chart builder.
- Arbitrary coach tool/button builder.
- Free-form nutrition grid.
- Training JSON as workout history.
- Hard-coded Women’s Performance advice.
- Wearable mock service.
- Day-of-week schedule columns.
- Monolithic dashboard components.
- Browser alerts used as primary product feedback.

### DELETE AFTER SAFE MIGRATION

- Unused `recharts` dependency.
- Unused mock wearable service.
- Unused legacy export service if not integrated.
- Unused legacy notification engine after canonical verification.
- Duplicate tables and columns after data migration.
- Mojibake and damaged text.
- Unsupported claims and misleading product copy.
- Dead imports and unreachable controls.

Nothing containing user data may be deleted without:

1. Dependency audit.
2. Row inventory.
3. Migration or archive decision.
4. Rollback plan.
5. Verification.

### HIDE UNTIL COMPLETE

- Women’s Performance.
- Real wearable connections.
- Recovery/readiness engine.
- Running/Endurance/Ironman.
- Payments and renewals.
- Sponsorship placements.
- Automated deload recommendations.
- Any capability using mock or placeholder data.

Hidden does not mean removed from the roadmap.

## Chart policy

A chart is allowed only when it answers a decision question.

Approved chart purposes:

- Weekly adherence.
- Load progression.
- Training volume by muscle group.
- Recovery trend.
- Nutrition planned versus executed.
- Body metric history when appropriately collected.

Visual limits:

- Maximum three headline indicators.
- Maximum one chart in a summary view.
- Maximum three charts in an athlete detail.
- No chart with one data point.
- No manually typed chart series.
- No duplicate visualization of the same metric.
- No color-only meaning.
- Every chart must show timeframe, source and comparison target.

Genesis will initially standardize on the existing Chart.js integration.
The unused Recharts dependency should be removed after dependency verification.

## Panel hierarchy

Every operational panel follows:

1. Summary.
2. Attention.
3. Actions.
4. Detail.

The default screen must answer:

- What is happening?
- What requires attention?
- What should I do next?

## Professional visual language

Genesis uses:

- Clear information hierarchy.
- Restrained use of cards.
- Consistent spacing.
- Accessible contrast.
- Responsive layouts.
- Circular progress only for compact completion.
- Line charts for trends.
- Heatmaps/calendars for consistency.
- Bars only for meaningful comparisons.
- Text and icons in addition to color.
- Progressive disclosure for advanced controls.

## Source-of-truth rules

- `users_master`: canonical identity.
- `coaches_profile`: coach profile and canonical plan link.
- `athletes_profile`: athlete profile, not a permanent container for every app.
- `athlete_programs`: package, focus, dates, duration and lifecycle.
- `user_preferences`: locale and measurement preferences.
- `system_notifications`: canonical notification source.
- `push_subscriptions`: Push destinations.
- `push_delivery_jobs`: Push delivery operations.
- `daily_logs`: current discipline foundation.
- `athlete_daily_metrics`: current normalized daily metric foundation.
- `biomechanical_library`: initial exercise catalog foundation.
- `athlete_earned_badges`: canonical earned-badge relation.
- `audit_logs`: canonical operational audit foundation.

New training, nutrition, Women’s Performance, wearable and endurance domains
must use dedicated normalized contracts instead of expanding
`athletes_profile` with additional JSON blobs.

## Security gates before beta

- Enable leaked-password protection.
- Re-run Supabase security and performance advisors.
- Review no-policy service-only tables.
- Add defense-in-depth to private tables where it will not break internal RPCs.
- Negative-test privileged RPCs.
- Verify all exposed public tables have appropriate grants and RLS.
- Verify coach/athlete cross-tenant isolation.
- Verify consent and revocation for sensitive data.
- Confirm no service-role or secret key exists in browser code.

The current `genesis_coach_activate_athlete_program` function remains accepted
pending its final negative test because it validates actor identity, role,
assigned coach, package authority, duration and dates, and uses an empty
`search_path`.

## Implementation order

1. `C3B14.3C` — Product Reduction & Canonical UX Contract.
2. `C4V01` — Shared visual system and application shell.
3. `C4V02` — Athlete dashboard and Today’s Training pilot.
4. `C4V03` — Coach athlete-detail pilot.
5. Training 2.0 normalized domain.
6. Professional nutrition domain.
7. Discipline simplification.
8. Women’s Performance domain.
9. Wearables and recovery.
10. Running/Endurance/Ironman.
11. Coach Command Center.
12. Super Admin modules.
13. Announcements and sponsorship surfaces.
14. Entitlement verification.
15. Security and full QA.
16. Controlled beta.
17. Production readiness.

## Definition of contract completion

This contract is complete when:

- It is committed on `rebuild/core-architecture`.
- Local and remote commit hashes match.
- No runtime source or database object changed in this checkpoint.
- The next implementation starts from the visual system without reopening
  settled product-scope questions.