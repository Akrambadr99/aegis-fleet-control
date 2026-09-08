# Aegis operational interface contract

Aegis is a robotics operations console. Build each workspace around an operator task and the canonical fleet state. Do not introduce a universal title-toolbar-cards-table page template.

## Workspace identities

- Operations desk: spatial context, actionable robot advisories, and outstanding dispatch commitments. Keep fleet counts in a compact instrument strip, not KPI cards.
- Digital Twin: floor canvas, independent spatial layers, persistent per-floor viewport, direct robot selection, topology controls, and a shared inspector.
- Mission Planning: step editor, dependencies, revision history, feasibility and contextual properties.
- Scheduler: assignment lanes, dispatch ownership, queue filters, candidate comparison and assignment rationale. Unknown routes have no valid distance or ETA; never display them as a zero-cost route.
- Traffic: routes, shared-resource ownership, conflict inspection and nearby corridor controls.
- Teleoperation: ownership and connectivity strip, motion console, acknowledged commands and a distinct emergency interlock.
- Maintenance: service order register, due state, technician, operational hold and verification gate. Component health must come from the domain when available; do not invent health scores.
- Charging: charger terminals and ordered reservation queues with robot battery context.
- Faults: severity-led triage rows with the affected robot and acknowledgement or recovery context.
- Execution: mission register with current robot, route progress, remaining estimates and execution interlocks. This presentation does not replace the planned action execution domain.
- Telemetry: comparable instrument readings with explicit units and sample ticks. Inspect recorded history through Replay.
- Replay: recorded scene, state inspector, calibrated telemetry tracks, timeline transport and event markers. An insufficient time window gets an explicit state, not a decorative chart.

## Shared visual language

Use the existing shared buttons, command feedback, fields, tables, typography and focus behavior. Favor 4/8/12 px spacing, restrained borders, small corner radii, tabular numeric readings and compact toolbars. Preserve visible keyboard focus and responsive layouts; tables may scroll within their own region on narrow displays.

Keep emergency stop visually distinct from normal commands. Show blocked states, ownership loss and critical faults next to their affected controls. Do not rely on color alone. Successful command feedback and failures remain tied to their existing operation state.

Avoid marketing headlines, generic dashboard labels, repeated card grids, gradients, glass surfaces, decorative shadows, oversized numbers, excessive pills and whitespace added purely for appearance. Panels can have different widths and control densities. Consistency comes from shared interaction rules, not page symmetry.

## Data and visual acceptance

Use canonical robot, job, route, facility and reservation identifiers across workspaces. Do not create a display-only seed or change domain initial conditions to improve screenshots. Missing data must remain explicit. Charts need units, a meaningful time axis and real recorded values.

Review changed workspaces at desktop and narrow viewport sizes, including populated, empty, selected and blocked states where relevant. Confirm that controls remain near their context, keyboard access works, and visual hierarchy explains the robotics workflow. A layout that can be relabeled as a generic CRM without structural changes needs another design pass.
