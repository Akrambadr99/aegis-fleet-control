# Architecture and behavior contract

## State ownership

Server-like records will belong to the in-memory gateway and TanStack Query cache. Each application mount owns its query client; no module-global mutable cache is shared across independent instances.

Interaction state belongs to the closest feature/component. Shareable context belongs to React Router paths or search parameters. The current facility overview derives its complete visible snapshot from the URL, without a second local facility selection.

A query-only change must keep focus in the initiating control. Path navigation changes the document title and focuses the main workspace, matching React Router's guidance to handle focus explicitly: https://reactrouter.com/how-to/accessibility

## Domain boundaries

Facilities own spatial geometry and floors. Fleet owns robot identity and operational state. Missions own definitions and execution transitions. Traffic owns corridor reservations. Charging owns limited charger resources. Teleoperation owns expiring session leases. Telemetry/replay/simulation own temporal data. Rules and audit operate on typed domain events.

Avoid a single global store. Cross-domain operations must become explicit gateway transactions with declared invariants and audit effects, not chains of unrelated component setters.

## Next milestone: deterministic async gateway

Inject clock/scheduler and request plans. Tests must choose latency, failures and response order directly, without random sleep. Requests accept cancellation signals, clean up pending timers/listeners, and record ownership.

Reads return snapshots, not shared mutable references. Use stable query keys containing entity/filter context. Writes check authorization and expected revision at execution time. Per-resource serialization and explicit conflict errors protect concurrent writes. Atomic changes include their audit events.

Optimistic updates require mutation ownership: failure of an earlier mutation must not restore a stale snapshot over later success. Define and test reconciliation before enabling commands.

## Accessibility

Use native links, buttons, labels and controls first. Custom spatial, timeline and drag interactions require keyboard equivalents. Route focus is separate from query filter updates. Dialogs will need focus entry, containment, Escape handling and restoration.

## Validation

Every milestone retains existing tests and adds behavior tests for its actual transitions. Browser journeys cover integration that jsdom cannot prove. Eventual 400+ unit/component tests and 30+ browser journeys are growth targets, never reasons to add count-only assertions.

Node 20.19.5 satisfies Vite's Node 20.19+ baseline: https://vite.dev/guide/
