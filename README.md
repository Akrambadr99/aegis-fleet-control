# Aegis Fleet Control

A self-contained React 19 robotics operations platform built in coherent, tested milestones.

## Current delivery

The foundation now runs on one normalized, versioned in-memory fleet gateway. The overview, fleet table, facility map, traffic, charging, faults, mission execution, telemetry, activity, replay events and scenario inputs observe the same confirmed records.

Implemented cross-domain workflows:

- Close a corridor: update topology, invalidate affected routes, pause running missions, hold reservations, record activity/replay and change scenario inputs.
- Recalculate a route: choose an available transfer lane, update reservation and mission estimates, then explicitly resume if readiness permits.
- Disable a charger: displace reservations, expose robot warnings and update mission feasibility and scenario capacity.
- Emergency stop: latch robot stop, pause its mission, release traffic reservations, revoke an existing control lease and record a replay frame.
- Pause selected robots: independent per-robot success/failure results while filters and selection remain usable.
- Acknowledge faults: record operator identity while retaining the recovery safety block.
- Advance the deterministic simulation: update positions, battery, mission progress, telemetry and completion/battery-reserve events.

The seed contains 4 facilities, 12 floors, 120 zones, 120 robots, 240 missions, 36 chargers, 36 reservations, 12 faults, 600 telemetry samples and 240 activity events.

## Run locally

Use Node **20.19.5** and npm **10.8.2**.

```sh
npm ci
npm run dev
```

No external database, service, credentials or API keys are required. Package and browser installation require internet access; the running application does not.

## Validation

```sh
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm run format:check
```

The root test command is directly `vitest run`. Chromium journeys start their own local server on port 4173. The production output is `dist/`; static hosting needs an `index.html` route fallback.

## Try an interconnected workflow

1. Open `/traffic?robot=R-004`.
2. Close C-001 and observe the mission pause and held/invalid reservation.
3. Recalculate the robot's route.
4. Open Execution from the sidebar and explicitly resume M-004.
5. Inspect Activity, Replay or the facility map. The same robot and facility remain selected.

R-004 starts with 53% battery and can take the 130 m detour while retaining the 20% reserve. R-001 starts with 32% and correctly remains paused: that detour requires 15.6 percentage points of energy plus the reserve. These initial batteries are unchanged.

Open `/charging?robot=R-001` and disable CHG-001 to see its reservations displaced and the robot's feasibility warning update.

The role selector is an explicit local simulation feature. The gateway checks role eligibility on every command. This is not a production authentication system.

## Current boundaries

This is an interconnected implementation with a substantial development program still ahead. Routing uses a facility navigation graph. Mission graph editing, saved revisions, templates, typed facility-resource steps, reservation arbitration, teleoperation leases, historical playback and event-driven automation are implemented. Advanced scheduling, cooperative execution, charging progression, configuration, comparative scenarios and the remaining expansion phases still require work. Simulation is stepped manually; optimistic editing has not been introduced.

Operational state is stored as a versioned browser snapshot and survives a full reload. Snapshot restoration runs deterministic schema migrations and rejects corrupt or unsupported data instead of silently replacing it. URL context also survives reload. Telemetry retains a bounded live window; activity and command replay frames retain persisted history.

See [architecture](docs/architecture.md), [milestones](docs/milestones.md), [validation](docs/validation.md), and the original [product brief](docs/product-brief.md).

The [development program checkpoints](docs/program-progress.md) record current phase scope, measured repository size, commits and validation results. Earlier milestone documents retain historical context.

## Scoped control and audit history

Use **Control scope** to grant command access to one facility while retaining read access to the others. Role and facility eligibility are enforced by the gateway as well as visible controls. Commands keep the actor grant captured when issued.

After a command, open **Activity** and expand **Inspect changes** to review immutable before/after records for affected robots, missions, routes and facility resources.

Changes are delivered as coherent commits after typecheck, tests, build and diff review. Read-only actions do not generate filler commits. See the expanded [product requirements](docs/expansion-brief.md).
