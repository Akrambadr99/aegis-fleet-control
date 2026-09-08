# Aegis Fleet Control

An autonomous robotics fleet management and digital twin platform, developed in small validated milestones.

## Current delivery: Milestone 1 — application foundation

One React 19 + TypeScript application at the repository root. The foundation includes:

- Responsive robotics operations shell and 15 addressable workspaces.
- Facility overview with two fixed demonstration snapshots and a local SVG spatial preview.
- Facility selection encoded in URL search parameters, including browser back/forward support.
- Semantic landmarks, skip navigation, active navigation, visible keyboard focus, route titles and route focus management.
- Route-level render error containment and unknown-route recovery.
- Isolated TanStack Query clients and deterministic test setup.
- Vitest/React Testing Library and Playwright browser journeys.

The remaining domain routes are explicitly marked as planned. The diagram is illustrative, and the summary is fixed seed data. There is no live telemetry, gateway engine, robot control or mission editing yet. This milestone does not claim the complete product or eventual test targets.

## Run locally

Use Node **20.19.5** and npm **10.8.2**. A matching Node 20 version >=20.19 is required.

```sh
npm ci
npm run dev
```

Open the address printed by Vite. No database, credentials, API keys or external application service is required. Dependencies and the test browser must be installed before offline use.

## Validate

```sh
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm run format:check
```

The root test command directly invokes `vitest run`. Browser tests start their own local Vite server on port 4173; keep that port free.

The production output is `dist/`. Static hosts must fall back to `index.html` for application routes. `npm run preview` serves the build locally.

## Structure

- `src/app`: shell, providers, application styles.
- `src/routing`: workspace metadata and route contract.
- `src/components`: shared behavior with actual reuse.
- `src/features/overview`: fixed overview snapshots and spatial preview.
- `src/test`: clean application rendering and test lifecycle.
- `e2e`: browser history, focus, responsive layout and offline-service independence.

Future features add their own domain modules as implemented. See [architecture](docs/architecture.md), [milestones](docs/milestones.md), and the [product brief](docs/product-brief.md).
