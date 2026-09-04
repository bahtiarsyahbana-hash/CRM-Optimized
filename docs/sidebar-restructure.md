# Sidebar Restructure — change summary

Option **B**: group only the pages that exist. Groups follow the lifecycle order
acquire → bind → service → reference → admin, and grow as features land.

## Nav structure

```
Dashboard                    (ungrouped, top level)

BUSINESS
  Submissions
  Pipeline

POLICIES
  Policy Register

SERVICING
  Claims
  Endorsements

DIRECTORY
  Clients

ADMINISTRATION
  Settings
  System Docs
```

## Label changes

| Old label | New label | View id | Component |
|---|---|---|---|
| Dashboard | Dashboard *(unchanged)* | `dashboard` | `DashboardOverview` |
| Submission | **Submissions** | `submission` | `SubmissionView` |
| Pipelines | **Pipeline** | `pipelines` | `PipelineView` |
| Policies | **Policy Register** | `policies` | `PoliciesView` |
| Claims | Claims *(unchanged)* | `claims` | `ClaimsView` |
| Aftersales | **Endorsements** | `aftersales` | `AftersalesView` (opens on endorsements tab) |
| Clients | Clients *(unchanged)* | `clients` | `ClientsView` |
| Settings | Settings *(unchanged)* | `settings` | `SettingsView` |
| System Docs | System Docs *(unchanged)* | `architecture` | `ArchitectureView` |
| Reports | **removed** | — | was a dead stub; replaced by Dashboard widgets |

**View ids are unchanged.** There is no router, so ids are internal only — they were
left alone to avoid churn in `GlobalSearch`, which navigates by id.

## Not implemented, and why

| Spec item | Status |
|---|---|
| Redirects (`/security` → `/insurers`, etc.) | **N/A** — no router, no URLs. Navigation is React state. |
| `is_renewal` / `expiring_policy_id` migration | **N/A** — no database. `Deal.dealType` already carries the renewal split. |
| Row count for backfill | **Not obtainable** — data is in browser `localStorage`. Run `JSON.parse(localStorage.getItem('deals')||'[]').length` in the console. |
| Certificates stub | **Omitted** under option B (no page, no entity). |
| Invoices, Open Covers, Cancellations, Insurers, Products, Benefits, Users & Roles | **Omitted** — no pages or entities exist. They slot into the same `NAV` array when built. |

## Files

### Added
| Path | Purpose |
|---|---|
| `src/lib/navigation.ts` | `ViewId`, `NavTarget`, `Navigate`. Lets deep components request navigation without importing App. |
| `src/utils/dealTrack.ts` | `trackOf()` / `isRenewal()` — the single definition of what counts as a renewal. |
| `src/components/dashboard/widgets/shared.tsx` | `WidgetProps`, `WidgetDefinition`, `WidgetShell`, shared selectors and formatters. |
| `src/components/dashboard/widgets/registry.ts` | `WIDGET_REGISTRY`, `DEFAULT_LAYOUT`, `resolveLayout()`. |
| `src/components/dashboard/widgets/PortfolioWidget.tsx` | Bound book: policies, premium, sum insured, product mix. |
| `src/components/dashboard/widgets/ProductionWidget.tsx` | Premium written MTD vs last month, new business vs renewal. |
| `src/components/dashboard/widgets/RetentionWidget.tsx` | Expiries within 90 days, bucketed; renewals in funnel. |
| `src/components/dashboard/widgets/InsurerPanelWidget.tsx` | Premium share by insurer, each row drillable. |

### Modified
| Path | Change |
|---|---|
| `src/App.tsx` | Declarative grouped `NAV` config; collapsible groups; holds `NavTarget` instead of a bare view id; passes drill-through params. |
| `src/components/dashboard/DashboardOverview.tsx` | Takes `navigate`; renders the widget grid from the registry above existing content. |
| `src/components/submission/SubmissionView.tsx` | Track tab strip (All / New Business / Renewals); accepts `initialTrack`. |
| `src/components/policies/PoliciesView.tsx` | Accepts `initialSearch`; search now also matches `insuranceCompany`. |
| `src/components/aftersales/AftersalesView.tsx` | Accepts `initialTab`. |

## Drill-through targets

| Widget | Target |
|---|---|
| Portfolio | Policy Register |
| Production | Pipeline |
| Retention | Submissions, Renewals tab (`params.track = 'Renewal'`) |
| Insurer Panel | Policy Register; each row filters to that insurer (`params.insurer`) |

Views seed filters from props on mount, so the content area is keyed on
view + params — re-entering the same view with different params remounts and
re-seeds. Sidebar clicks navigate without params, clearing any drill-through filter.

## Dashboard phase 2 — scaffolded, not built

Deliberately deferred: per-user layout persistence, add/remove widgets, drag and resize.

The seams left open:

- Layouts are plain `string[]` of widget ids; `resolveLayout()` accepts any array and
  skips ids it doesn't recognise, so a stale persisted layout degrades rather than crashes.
- `defaultSpan` lives on each definition, so a persisted layout can override span
  per user without touching a widget.
- Every widget takes identical `WidgetProps` and reads its own data, so one can be
  mounted, removed or reordered with no coordination.
- `title` / `description` exist for an "add widget" picker that doesn't exist yet.

Widget ids are permanent. Never reuse one for a different widget — a stale layout
would render the wrong thing.

## Known duplication, left alone

- `PipelineView` still has the renewal/new-business split inline in its filter rather
  than importing `trackOf`. Same rule, two definitions. Three-line fix when wanted.
- Claims is reachable twice: its own page, and the Claims tab inside Aftersales.
  Pre-existing.
