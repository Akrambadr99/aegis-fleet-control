# Milestone 1 validation

Validated locally on Windows on 2026-09-08 using Node 20.19.5 and npm 10.8.2.

| Check                     | Result                                                             |
| ------------------------- | ------------------------------------------------------------------ |
| npm install               | Passed; lockfile created; audit reported 0 vulnerabilities         |
| npm run typecheck         | Passed                                                             |
| npm test                  | 15 passed across 3 files                                           |
| npm run build             | Passed; production JS 271.08 kB / 86.01 kB gzip                    |
| npm run test:e2e          | 7 Chromium journeys passed                                         |
| npm run format:check      | Passed                                                             |
| Desktop/mobile inspection | Reviewed at 1440px and 390px; initial-focus scroll issue corrected |

Browser coverage includes reload/back/forward facility state, unrelated query preservation, direct routes, unknown-route recovery, keyboard navigation, skip focus, initial scroll position, mobile overflow/navigation, and absence of external application requests or browser errors.

Scope is the foundation only. No assertion is made about future domain operations, live telemetry, production readiness, remote CI, or the eventual 400+/30+ test targets.

# Connected engine and React operations validation

Validated locally on Windows on 2026-09-08 with Node 20.19.5 and npm 10.8.2.

| Check                          | Result                                                                                          |
| ------------------------------ | ----------------------------------------------------------------------------------------------- |
| TypeScript                     | Passed                                                                                          |
| Vitest / React Testing Library | 47 passed across 5 files                                                                        |
| Chromium                       | 16 journeys passed                                                                              |
| Production build               | Passed; JS 307.83 kB / 97.07 kB gzip                                                            |
| Dependency audit               | 0 vulnerabilities reported                                                                      |
| Visual inspection              | Connected map/robot inspector reviewed at desktop and 390px mobile; no horizontal page overflow |

New evidence includes atomic corridor/charger/stop propagation; immutable snapshots; authorization and expected-revision rejection; independent out-of-order commands; cancellation/supersession cleanup; stale route previews; partial bulk results; selection changes during pending operations; writes surviving route changes; explicit reroute/resume; failed reroute rollback; deterministic ticks; inspector Escape/focus restoration; shared robot identity across navigation; and derived facility/floor deep links.

The foundation browser history, recovery, keyboard and offline-service independence tests remain. Fixture-specific overview assertions were updated to the authoritative seed and the traffic placeholder assertion now verifies the real workspace.

These are local results. Full navigation-graph simulation, optimistic editors, mission graphs, automated recovery rules, production authentication and full replay remain unimplemented, as recorded in the milestone table.

# Scoped permissions and structured audit milestone

Node 20.19.5 / npm 10.8.2, locally validated on Windows, 2026-09-08:

- Typecheck passed.
- Vitest/RTL: 62 tests passed across 6 files.
- Chromium: 18 journeys passed.
- Production build passed: JS 310.13 kB / 97.72 kB gzip.
- Added authorization coverage for every command type, empty grants, mixed-facility partial results, request-owned actor snapshots, before/after audit completeness and immutable history.
- Browser evidence verifies cross-workspace grant persistence, retained read access, disabled out-of-scope commands and inspectable cross-domain changes.

The preceding milestone validation records remain historical snapshots of their own implementations.
