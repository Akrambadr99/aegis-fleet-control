# Roadmap checkpoint

## Stabilized baseline — 2026-09-08

The earlier program-progress report is a historical checkpoint. Current source at
`8a18954` includes later architecture, gateway, capability, ownership, search,
diagnostics, collection and preference work. Those slices do not complete the
whole long-term roadmap.

Stage A revalidation passed on Node 20.19.5: typecheck, ESLint, 193 tests across
44 Vitest/React files, production build and all 43 Chromium journeys. The incoming
Teleoperation test modification has no Git content diff. The unfinished audit
script has been retained, formatted and extended with explicit TypeScript and
component metrics; its stale generated snapshot has been refreshed.

Measured source baseline: 114 production TS/TSX files, 9,352 physical TS/TSX lines,
57 JSX-rendering component declarations (including the error boundary), 12 feature
directories and 28 command-union operations. There are 65 existing commits on
`codex/aegis-foundation`, with no configured remote. The audit report records its
source HEAD; its count intentionally precedes the commit that stores this report.

Run `npm run audit:architecture` for JSON measurements. Component counts identify
named uppercase functions, classes and function-valued variables containing JSX;
they exclude lazy import aliases and test fixtures. Command counts measure union
discriminants, not every helper function. Production metrics exclude tests and
testing fixtures. Feature directory counts do not claim completed roadmap domains.

## Next unfinished product phase

Stage F warehouse jobs still has one transport-shaped workflow. Add explicit job
kinds and capability requirements through the shared planner and scheduler before
expanding batching, retries and partial-success operations. Stage E has a substantial
editor, but execution of nested conditional/parallel plans remains a separate gap.

Other major gaps include cooperative missions, the unified physical model,
component health, policy administration, shift handover and the dense command
center. Existing telemetry, charging, faults, maintenance and replay are usable
slices requiring further depth. The roadmap's scale targets are not yet achieved.
