# Development program checkpoints

## Phase 0 — Maintenance stabilization

The incoming repository already contained the completed maintenance milestone in `9261013`. At incoming HEAD `0e64a0c`, the working tree was clean. Revalidation on Node 20.19.5 passed all 127 Vitest/RTL tests, 37 Chromium journeys, typecheck, lint and production build. No duplicate maintenance commit or seed rewrite was needed.

The regressions verify released traffic ownership during service and verification, released charger reservations across availability changes, domain eligibility, service transitions and preservation of the original seed counts.

Incoming checkpoint: 21 commits; 65 production TS/TSX files; 7,470 physical production lines; zero new Phase 0 commits; clean working tree. Next phase: mission planning core.

Last ten incoming commits:

```text
0e64a0c feat(automation): add rule editing, event testing and execution history
10c12c4 feat(automation): execute scoped rules from real operational events
a8203d9 feat(traffic): add spatial route layers and contextual ownership controls
f909f34 feat(replay): add synchronized timeline playback and historical inspectors
cc4876a feat(replay): record immutable robot history at ticks and command boundaries
aba02e3 feat(teleoperation): add keyboard control console and emergency interlock UI
19fe217 feat(teleoperation): enforce exclusive leases and acknowledged robot motion
d27a732 feat(resources): expose ownership queues and facility availability controls
4840d3a feat(resources): arbitrate shared ownership across jobs, routes and maintenance
dbed668 feat(scheduler): add warehouse queue and explainable dispatch workspace
```

## Phase 1 — Mission planning core

Completed the planning-core expansion at `43a99b9`, building on the existing editor and gateway rather than replacing them.

- Stable step identifiers, insertion, duplication, removal, ordering, whole-draft undo/redo, save, discard and mission duplication.
- Twelve selectable step types: navigate, pickup, dropoff, inspect, wait, charge, dock, open-door, call-elevator, resource, conditional-branch and parallel-branch.
- Conditional control nodes require an explicit condition and dependent work; parallel control nodes require two children. Join dependencies derive the longest planning path. Feasibility conservatively checks every branch.
- Saved revisions retain immutable step graphs, creator attribution, saving operator and simulation tick. Restoring history creates an editable draft; saving it appends a revision.
- Templates retain their source revision and create independent drafts in the source facility. Current robot, resource, topology and battery constraints still apply.
- Planned robot assignment and saved-plan ownership are visible. Saving a plan does not dispatch or interrupt the robot's active mission; operational dispatch remains the scheduling domain's responsibility.
- Pending saves and failure messages survive editor navigation, with deterministic retry coverage.

New implementation commits:

```text
ebbdfa1 feat(missions): insert and duplicate steps with reversible dependencies
a235096 feat(missions): retain attributed revisions and restore historical drafts
57cabd9 feat(missions): create reusable templates from attributed plan revisions
5ef475f feat(missions): validate dock door and elevator step resources
7302df1 fix(missions): preserve pending saves and retry state across navigation
43a99b9 feat(missions): model conditional and parallel planning branches
```

Measured at `43a99b9`: **27 Git commits**, **68 production TypeScript/TSX files**, **7,798 physical lines** (7,791 nonblank), **143 passing Vitest/RTL cases in 20 files**, and **39 passing Chromium journeys**. Production counts include tracked `src/**/*.ts(x)` excluding `*.test.*` and `src/test/`. These are source counts, not a claim of 7,798 executable statements.

Validation: Node 20.19.5; focused tests, typecheck, ESLint, full Vitest suite, production build, full Chromium suite, Prettier and `git diff --check` passed. Working tree clean after the implementation commits. All results are local; no remote is configured.

Last ten commits at this checkpoint:

```text
43a99b9 feat(missions): model conditional and parallel planning branches
7302df1 fix(missions): preserve pending saves and retry state across navigation
5ef475f feat(missions): validate dock door and elevator step resources
57cabd9 feat(missions): create reusable templates from attributed plan revisions
a235096 feat(missions): retain attributed revisions and restore historical drafts
ebbdfa1 feat(missions): insert and duplicate steps with reversible dependencies
0e64a0c feat(automation): add rule editing, event testing and execution history
10c12c4 feat(automation): execute scoped rules from real operational events
a8203d9 feat(traffic): add spatial route layers and contextual ownership controls
f909f34 feat(replay): add synchronized timeline playback and historical inspectors
```

Next: **Phase 2 — Advanced mission feasibility**, including request ordering, cancellation, reassignment, permission changes and richer current-state constraints. Existing later-domain slices do not imply completion of their corresponding expansion phases.

## Phase 2 — Advanced mission feasibility

Completed this phase against the current domain model at `9879ed4`.

- Validation is scoped to draft contents, operational revision, operator grants and retry generation. A superseded transport response cannot replace the current result even if it arrives after cancellation.
- Deterministic coverage includes normal and reversed completion, edit during pending validation, robot reassignment, permission changes, operational invalidation, cancellation and retry.
- Robot capabilities, battery reserve, maintenance and faults use current domain state. Immediate workload and charging commitments are shared with scheduler eligibility.
- A valid plan may be saved for later while its robot is busy. The editor separately displays immediate dispatch blockers; saving does not dispatch work.
- Typed resources must be available, match the action, and be reachable through current topology. Occupied resource capacity and chargers produce dispatch blockers. Charging requires positive duration and a reachable floor.
- Existing distance/battery estimates remain the current conservative planning model. The unified physical model belongs to Phase 10; feasibility does not invent charge gains or claim to execute the saved step graph.

New commits:

```text
0f5358b feat(feasibility): scope async validation to draft fleet and operator context
d9f2bd1 feat(feasibility): share dispatch commitments with fleet scheduling
9879ed4 feat(feasibility): validate facility access and resource occupancy
```

Measured checkpoint: **31 commits**, **71 production TS/TSX files**, **7,916 physical production lines**, **153 tests in 22 Vitest/RTL files**, **39 Chromium journeys**. Focused tests, full tests, typecheck, ESLint, build, Chromium, formatting and diff checks passed. Working tree was clean. Next: Phase 3 warehouse job expansion.

Last ten commits at Phase 2:

```text
9879ed4 feat(feasibility): validate facility access and resource occupancy
d9f2bd1 feat(feasibility): share dispatch commitments with fleet scheduling
0f5358b feat(feasibility): scope async validation to draft fleet and operator context
5937db5 docs: record verified mission planning core and program boundaries
43a99b9 feat(missions): model conditional and parallel planning branches
7302df1 fix(missions): preserve pending saves and retry state across navigation
5ef475f feat(missions): validate dock door and elevator step resources
57cabd9 feat(missions): create reusable templates from attributed plan revisions
a235096 feat(missions): retain attributed revisions and restore historical drafts
ebbdfa1 feat(missions): insert and duplicate steps with reversible dependencies
```

## Phase 3 — Warehouse jobs, in progress

Two coherent integrations are completed:

- `d56788c`: every dispatched job plan uses the same attributed immutable revision writer as the editor. Jobs retain all generated mission IDs through partial deliveries and reassignment, with an inspectable mission history.
- `d97b787`: queue search, status and minimum-priority filters persist in URL state. The selected inspector survives filtering, and dependency navigation retains unrelated URL context. Predecessors and dependent jobs are visible with their current status.

Phase 3 is **not complete**. Remaining work includes the seven explicit job kinds and their differentiated mission generation, required capability configuration, job groups, broader batching workflows, retry lifecycle and partial-success bulk actions. Existing transport dispatch and partial delivery remain functional.

Final implementation checkpoint `d97b787`: **33 commits**, **75 production TS/TSX files**, **8,100 physical production lines**. **156 Vitest/RTL tests in 24 files** and **40 Chromium journeys** passed, as did typecheck, ESLint, production build, formatting and diff checks. The scheduler screenshot was visually reviewed; the mission suite also checks a narrow viewport. Working tree clean after the implementation commit. The report commit adds documentation only.

Last ten implementation commits:

```text
d97b787 feat(jobs): add persistent queue filters and dependency navigation
d56788c feat(jobs): retain mission provenance across partial deliveries
9879ed4 feat(feasibility): validate facility access and resource occupancy
d9f2bd1 feat(feasibility): share dispatch commitments with fleet scheduling
0f5358b feat(feasibility): scope async validation to draft fleet and operator context
5937db5 docs: record verified mission planning core and program boundaries
43a99b9 feat(missions): model conditional and parallel planning branches
7302df1 fix(missions): preserve pending saves and retry state across navigation
5ef475f feat(missions): validate dock door and elevator step resources
57cabd9 feat(missions): create reusable templates from attributed plan revisions
```

Next work remains **Phase 3**, not Phase 4. The large-codebase targets and phases 4–29 have not been completed or certified by these checkpoints. Original Git history is preserved; no remote push or submission occurred.
