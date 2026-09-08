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

## Warehouse job kinds and capabilities

Seven explicit job kinds now share one definition used by dispatch, mission
requirements and the job editor. Cargo jobs generate collection/delivery plans;
inspection adds an inspection step and requires a suitable robot; support jobs
reach the support station without inventing payload custody. Additional capability
requirements constrain ranking and remain on generated missions. Existing jobs
without a kind retain transport behavior. Partially completed work locks its kind,
stations, payload and capability meaning while allowing priority/deadline updates.

Validation: typecheck, lint, 204 Vitest/React tests and build passed; all four
scheduler Chromium journeys passed, including inspection creation and capability
filtering. The resulting workspace screenshot was inspected. This is a Stage F
slice, not completion: the simulation still advances route progress at a fixed
rate and does not execute individual plan actions. Job grouping, explicit retry
history and partial-success bulk dispatch remain unfinished.

## Assignment release and retry history

Assignments can now be returned to the queue before payload pickup with an
explicit reason. The cancelled mission, released reservations and attributed
attempt remain inspectable. Re-dispatch creates a new mission and attempt;
completion records the successful attempt without counting released units.
Gateway revision and custody checks reject releases that arrive after pickup,
and facility-scoped permission checks also apply to release. History invariants
connect each attempt to its mission, robot and current ownership.

Validation: 209 tests across 46 Vitest/React files, typecheck, lint and production
build passed. All five scheduler Chromium journeys passed, including release,
retry and completion with both attempts visible in mission history.

## Partial-success batch dispatch

Dispatch selection spans queue filters. Each batch captures job revisions and
quantities, settles each command independently, and reports confirmed/failed
outcomes in input order. Cancellation affects unfinished tickets only. Retrying
failed jobs explicitly captures current revisions; batch commands cannot replace
an already assigned mission. Query mutation state retains pending ownership and
the latest five visible reports across workspace remounts (30-minute cache).
Unrelated controls and queue selection remain usable during dispatch.

Validation: 216 tests across 48 Vitest/React files, typecheck, lint and build
passed. Six scheduler Chromium journeys passed. Coverage includes reversed
completion, partial cancellation, duplicate-batch rejection, selection/filter
changes and navigation before/after settlement. Grouping and physical execution
remain separate unfinished work.

## Dispatch groups

Groups are canonical, revisioned records with exclusive job membership, a shared
ready/held/closed lifecycle and attributed decisions. Holding a group blocks new
assignments at completion time while allowing already running missions to finish.
The queue supports group filtering and selecting queued members for batch dispatch;
global search links to the same group filter. Closing requires every member job to
be completed or cancelled. Snapshot schema 2 migrates earlier states with an empty
group table, preserving source objects and all existing job history.

Validation: 223 tests across 49 Vitest/React files, typecheck, lint and build
passed; all seven scheduler Chromium journeys passed. Gateway coverage proves both
hold/assignment completion orders, membership conflicts, closure rules, scoped
permissions, audit changes, referential integrity and legacy migration. The next
scheduler phase adds dispatcher ownership and richer assignment decisions.

## Dispatcher ownership

Job dispatch locks use shared lease rules for acquire, renew, release and timed
expiry. Only the owning dispatcher can modify locked jobs or group them; an
administrator may explicitly take over with a reason. Takeover changes the job
revision, invalidating earlier pending edits. Expiry records before/after audit
state, and terminal jobs release their lock. UI controls reflect ownership and
facility scope. Safety controls on robots remain independent of dispatch locks.

Validation: 228 tests across 50 Vitest/React files, typecheck, lint, production
build and eight scheduler Chromium journeys passed. Next repair: the job editor's
revision-keyed remount currently discards unsaved fields on metadata changes;
retain drafts across lock revisions and handle competing requirement edits explicitly.

## Revision-aware job editing

The editor now follows requirement snapshots rather than remounting on every job
revision. Lock/group metadata changes preserve local fields and refresh the save
revision. Competing requirement edits retain the draft, show current and local
values, and require an explicit reload or reapplication of only locally edited
fields. Untouched fields retain the latest canonical values. The submitted command
uses the draft's reviewed revision, so subsequent races still fail atomically.

Validation: 232 tests across 51 Vitest/React files, typecheck, lint and production
build passed; all nine scheduler Chromium journeys passed. Tests include metadata
updates, competing edits, clean refresh and an unsaved title surviving lock acquisition.
