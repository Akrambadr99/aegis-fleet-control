# Interconnected architecture

## Authoritative state and boundaries

FleetGateway owns normalized server-like records, keyed by IDs. React receives immutable snapshots through useSyncExternalStore. A single atomic publish makes related record changes visible together; components cannot mutate confirmed snapshots.

This is a simulated repository, not a global store for UI state. Filter and selected-entity context belong in React Router search parameters. Fleet selection and command feedback remain local interaction state. TanStack Query owns asynchronous route previews keyed by robot ID, robot revision and topology revision.

The overview contains selectors and URL alias compatibility only. It has no independent robot/facility fixtures. Map and operational workspaces derive from the same facility geometry and entity references.

## Relationships

Facility -> floor -> zone/corridor/charger.
Robot -> facility/floor/position -> active mission/charging reservation/control lease/fault IDs.
Mission -> robot/destination/route.
Route -> robot/facility/corridor reservations/topology revision.
Reservation -> robot/charger.
Fault -> robot in this milestone; polymorphic resource faults are still pending.
Activity records significant changes; replay frames capture affected robot/mission/reservation state after each transaction.

The next topology expansion adds buildings, navigation nodes/edges, doors, elevators, docks, restricted areas and workstations. Cross-domain IDs and gateway transactions remain the integration boundary.

## Transaction semantics

Commands capture their actor, payload and expected entity revision at invocation. On completion they validate permission, existence, revision and lifecycle constraints against the latest confirmed state, then apply all changes on a draft. Success publishes exactly once with audit/replay effects. Failure publishes nothing.

Independent resources can complete in any order. Competing writes to one resource cannot overwrite a newer revision. Commands that continue after navigation still update the shared repository. Bulk operations capture target IDs/revisions and settle independently; result handling does not rewrite current selection.

Closing a corridor invalidates affected routes, holds reservations and pauses running missions. Reopening never silently resumes execution. Explicit reroute uses the same route-candidate selector as preview, then a separate resume validates mission feasibility. The initial topology models alternative transfer lanes; arbitrary graph pathfinding is pending.

Disabling a charger displaces its queue entries and increments affected robot revisions. Re-enabling it does not silently reinstate displaced ownership.

Emergency stop pauses execution, releases traffic and revokes an existing manual lease. Lease acquisition and expiry are pending. Fault acknowledgement never resolves the underlying safety condition.

## Async and clock

RequestEngine supplies identifiable tickets with pending, confirmed, failed, cancelled, stale and explicitly superseded outcomes. A request plan can choose each operation's latency and failure independently. Abort/supersede clears the scheduled work and listeners. ManualScheduler provides stable due-time and insertion-order execution in tests.

Read snapshots retain their invocation context. Route previews reject results if topology or robot revision changed. React query keys and cancellation prevent an old selected robot's preview from appearing under the new selection.

FleetGateway.advance(n) deterministically moves eligible robots, drains battery, progresses missions and appends telemetry. Completion releases reservations. Low battery pauses execution. Stopped/disconnected robots do not move. Tests drive the scheduler and simulation clock explicitly without network or random wall-clock assertions.

Optimistic edits will require per-mutation overlays and revision-aware rollback. They are deliberately not represented as confirmed server state in this milestone.

## Derived values

Readiness derives from connectivity, emergency stop, battery, fault state, lease ownership and displaced charging reservations. Feasibility adds route health, distance, energy reserve and charger availability. Scenario inputs derive facility population, available chargers and closed corridors. No page persists its own copy of these values.

## Multi-workspace UI

A non-modal robot inspector can coexist with map, fleet, traffic, charging or replay content. Entity links and sidebar navigation preserve URL context. Robot-only deep links infer the facility/floor. Opening and dismissing the inspector manage keyboard focus; Escape dismisses it.

Fleet filtering, sorting and pagination limit visible rows. Map scope is one floor. Event views retain only the latest 50 matching entries in the DOM; live telemetry retains 2,400 samples.

## Future acceptance gates

Extend the actual product rather than adding disconnected placeholder CRUD pages. Every future workflow must prove downstream consequences, failure rollback, permissions and revision ownership in both domain tests and observable React behavior.

Long-term targets are 20+ domains, 150+ meaningful components, 100+ focused modules, 500+ behavior tests, 40+ Chromium journeys and 100+ genuine commits. These are growth targets, never reasons to create filler.
