# Architecture expansion audit

The existing history starts with the React foundation, shared gateway, connected workspaces and facility-scoped audit/permissions. Preserve those systems and their regression suite.

Five sequential expansions:

1. **Navigation graph**: replace independent lane selection and wrapped movement with graph paths shared by previews, estimates, map overlays and movement. Keep completed routes independent of mutable active routes.
2. **Maintenance and capability eligibility**: lifecycle transitions must affect readiness, missions, reservations and later scheduling.
3. **Warehouse jobs and payload custody**: versioned work with real source/destination ownership and guarded completion/cancellation.
4. **Fleet scheduling**: inspect candidate rejection reasons, then assign atomically against current revisions, capabilities, routes and resource state.
5. **Resource arbitration**: priority queues, ownership, release and deterministic expiry connected to execution and traffic.

Each expansion adds a usable vertical slice. The long-term domain specifications remain larger than these first implementations. No component/test/commit quota justifies filler.

## Navigation validation

Directed weighted paths support multi-edge destinations, one-way travel, disabled edges and disconnection. Robot positions and telemetry derive from their route. Active topology changes do not rewrite completed route snapshots.

Validation: typecheck, 70 Vitest/RTL tests, production build, and 18 Chromium journeys passed. Both overview and floor workspace render the shared graph.
