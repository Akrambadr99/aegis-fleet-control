# Interconnected architecture

## Authoritative state and boundaries

CanonicalStorage owns normalized server-like records keyed by IDs. FleetGateway coordinates commands and queries through that boundary, while the in-memory adapter validates, structurally shares, freezes and publishes canonical snapshots. React receives immutable snapshots through useSyncExternalStore. A single atomic commit makes related record changes visible together; components cannot mutate confirmed snapshots.

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

The application transaction layer clones the current snapshot, applies domain behavior and automation, and enforces invariants before returning a candidate plus the exact range of events it created. The storage adapter then checks the expected canonical revision and publishes the candidate atomically. Command receipts consume only that bounded committed event range, so their cost does not grow with retained audit history. A stale or invalid candidate leaves the previous snapshot and subscribers untouched.

After a successful storage commit, the gateway publishes the exact event range to an ordered in-process event stream. Simulation events use the same path. Reentrant publication is queued, event batches are detached and immutable, and subscriber failures enter a bounded diagnostic ledger without changing a confirmed command into a reported failure. Persisted activity remains the durable history; the live stream is a post-commit integration surface for workers attached to the current application instance.

The React diagnostics workspace subscribes independently to canonical state, request state and event-stream state. Event-stream observers run after the complete queued delivery cycle, so they see failures from workers regardless of subscription order. The workspace reports bounded committed-batch, event and delivery-failure counts and exposes recent worker failures without polling or coupling operational screens to infrastructure details.

Operational alerts are the first event-driven read model. The projection bootstraps once from durable activity, then consumes only the exact committed batches and retains a bounded immutable alert window. Facility scope is applied when an operator reads the projection, so role changes do not rebuild it. Alert React rendering subscribes to this projection instead of rescanning all canonical entities and activity after unrelated state changes.

Closing a corridor invalidates affected routes, holds reservations and pauses running missions. Reopening never silently resumes execution. Explicit reroute uses the same route-candidate selector as preview, then a separate resume validates mission feasibility. The initial topology models alternative transfer lanes; arbitrary graph pathfinding is pending.

Disabling a charger displaces its queue entries and increments affected robot revisions. Re-enabling it does not silently reinstate displaced ownership.

Emergency stop pauses execution, releases traffic and revokes an existing manual lease. Lease acquisition and expiry are pending. Fault acknowledgement never resolves the underlying safety condition.

## Async and clock

RequestEngine supplies identifiable tickets with pending, confirmed, failed, cancelled, stale and explicitly superseded outcomes. A request plan can choose each operation's latency and failure independently. Abort/supersede clears the scheduled work and listeners. ManualScheduler provides stable due-time and insertion-order execution in tests.

Read snapshots retain their invocation context. Route previews reject results if topology or robot revision changed. React query keys and cancellation prevent an old selected robot's preview from appearing under the new selection.

FleetGateway.advance(n) deterministically moves eligible robots, drains battery, progresses missions and appends telemetry. Completion releases reservations. Low battery pauses execution. Stopped/disconnected robots do not move. Tests drive the scheduler and simulation clock explicitly without network or random wall-clock assertions.

Optimistic edits will require per-mutation overlays and revision-aware rollback. They are deliberately not represented as confirmed server state in this milestone.

## Snapshot schemas and migrations

Snapshots carry independent schema, fixture and snapshot versions plus deterministic migration history. Migration functions are registered one version at a time; restoration walks each required step in order, never mutates the supplied snapshot, and validates the final canonical state. Current exports begin at the current schema with an empty migration history, while restored historical snapshots retain the exact steps applied during restoration.

Schema migrations add compatibility defaults only for the version that introduced them. Seed fixtures remain separately versioned, so a schema change does not require rewriting every deterministic fixture. Unknown future schemas, unsupported fixture versions, malformed roots, incomplete canonical table shapes, discontinuous migration histories and revision metadata mismatches fail before publication.

The browser application restores canonical state from one versioned local snapshot. Persisted records carry their own format version and deterministic corruption checksum around the schema-versioned payload. The checksum detects accidental or partial alteration; it is not an authenticity signature. Legacy plain snapshots still enter the migration pipeline, while altered records and unknown storage formats fail closed.

A commit is serialized and written before the in-memory adapter publishes it, so a storage access or quota failure leaves the visible snapshot and subscribers unchanged. Tests and explicitly supplied gateways remain isolated in memory. Corrupt persisted data fails closed rather than silently discarding operational history.

The persistent commit path creates one detached, validated snapshot clone. Its payload is serialized once, checksummed from that exact string and embedded directly in the storage record before the same detached state is handed to the in-memory publisher. Persistence failures leave both canonical state and the caller's transaction candidate unchanged.

Each persistent adapter also retains the exact source record from which it restored. Before writing, it verifies that the backing record is unchanged. A stale application instance therefore fails without overwriting a newer sequential commit made by another tab or instance. Fully simultaneous multi-tab serialization requires a future shared locking service; this synchronous browser adapter does not claim that guarantee.

## Derived values

Readiness derives from connectivity, emergency stop, battery, fault state, lease ownership and displaced charging reservations. Feasibility adds route health, distance, energy reserve and charger availability. Scenario inputs derive facility population, available chargers and closed corridors. No page persists its own copy of these values.

## Multi-workspace UI

A non-modal robot inspector can coexist with map, fleet, traffic, charging or replay content. Entity links and sidebar navigation preserve URL context. Robot-only deep links infer the facility/floor. Opening and dismissing the inspector manage keyboard focus; Escape dismisses it.

Fleet filtering, sorting and pagination limit visible rows. Map scope is one floor. Event views retain only the latest 50 matching entries in the DOM; live telemetry retains 2,400 samples.

## Future acceptance gates

Extend the actual product rather than adding disconnected placeholder CRUD pages. Every future workflow must prove downstream consequences, failure rollback, permissions and revision ownership in both domain tests and observable React behavior.

Long-term targets are 20+ domains, 150+ meaningful components, 100+ focused modules, 500+ behavior tests, 40+ Chromium journeys and 100+ genuine commits. These are growth targets, never reasons to create filler.

## Facility-scoped authorization and command audit

An actor's optional facilityIds grant constrains every domain command, including administrator commands. Omitted means all facilities; an empty list grants no control. Read-only access remains available across facilities. UI control eligibility and the gateway share the same permission resolver, which resolves corridors through their floor and faults through their robot.

The command-to-role policy is an exhaustive typed registry. Adding a command without an explicit role definition fails compilation rather than inheriting access from a name prefix. The authorization boundary validates actor identity and grants, checks role eligibility before resolving command entities, then checks facility scope. This ordering prevents unauthorized roles from using denial details to test whether an entity exists. Gateway failures retain typed `forbidden` or `missing` codes for deterministic recovery behavior.

Each asynchronous command deep-copies its actor grant at invocation. Changing the local simulation role or scope governs subsequent commands; it does not revoke already-issued commands. Production authentication and live grant revocation are separate future work.

Successful commands record immutable before/after snapshots for every entity whose revision changed, alongside actor, role, action, entity and a deterministic simulation timestamp. The simulation epoch is 2026-01-01 UTC. Activity exposes native expandable details. Failed commands do not produce successful-command audit entries. Seed history and simulation tick events do not claim complete historical before/after snapshots.

The expanded product brief is retained in expansion-brief.md. Its scale targets supersede the earlier long-term estimates; they remain architectural goals rather than quotas.

## Commit discipline

Every coherent implementation milestone must pass typecheck, tests and production build, receive a diff review, and be committed with a meaningful message. Run browser journeys for affected integration flows and periodically run the full suite. Commit related documentation with its implementation. Do not squash unrelated capabilities together, invent historical work, or create empty commits for read-only inspection and test execution.
