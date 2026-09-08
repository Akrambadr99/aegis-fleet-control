Build a large, production-style React application called **Aegis Fleet Control**.

The product is an **Autonomous Robotics Fleet Management and Digital Twin Platform** used to operate robots inside warehouses, factories, and large facilities.

This must be a serious multi-domain software product, not a CRUD demo, dashboard template, or small prototype.

## Primary goal

Create a large React codebase with many realistic, independently testable user behaviors involving:

* asynchronous state
* concurrent requests
* optimistic updates
* stale request protection
* selection state
* filtering and sorting
* keyboard interaction
* focus management
* drag and drop
* route state
* URL state
* undo/redo
* live simulated telemetry
* resource ownership
* cancellation
* partial failures
* loading states
* error recovery
* cross-view synchronization
* accessibility

The application should naturally contain many focused React behavior surfaces that could later be maintained, extended, and repaired independently.

Do not intentionally insert bugs. Build correct, maintainable software with realistic complexity.

---

# Technology requirements

Use:

* React 19
* TypeScript
* Vite
* React Router
* TanStack Query where appropriate
* Vitest
* React Testing Library
* jsdom
* Playwright
* Node.js 20
* npm

The repository must contain exactly one React application at the repository root.

The root `package.json` must have a direct test command such as:

`vitest run`

Do not use `react-scripts`.

Keep the project completely self-contained.

Do not require:

* external databases
* API keys
* private credentials
* SaaS services
* cloud infrastructure
* external APIs for tests

Use an in-memory asynchronous application gateway / repository layer to simulate server operations.

Simulated backend operations should support deterministic:

* latency
* failures
* stale responses
* cancellation
* concurrent mutations

Tests must remain deterministic.

---

# Product architecture

Build the application around these major domains.

## 1. Facility Digital Twin

Support:

* facilities
* buildings
* floors
* zones
* corridors
* restricted areas
* workstations
* loading areas
* charging stations
* elevators
* doors
* navigation nodes

Create an interactive 2D facility workspace.

Users should be able to:

* switch floors
* zoom
* pan
* select entities
* multi-select entities
* toggle map layers
* inspect entities
* edit zones
* create restricted areas
* move navigation points
* preview robot routes
* follow a robot
* open contextual side panels

Keep the visualization implemented with React/SVG or normal browser technologies instead of external mapping services.

---

## 2. Robot Fleet

Represent a large fleet of autonomous robots.

Each robot should have realistic state such as:

* online/offline
* idle
* navigating
* executing mission
* paused
* blocked
* charging
* maintenance
* emergency stopped
* manual control

Track:

* battery
* current position
* velocity
* active mission
* assigned zone
* connectivity
* localization confidence
* temperature
* motor load
* active faults

Build:

* fleet table
* compact robot cards
* robot detail workspace
* grouping
* filtering
* sorting
* bulk selection
* bulk commands

---

## 3. Mission Management

Support mission creation and execution.

Mission steps can include:

* navigate
* pickup
* dropoff
* wait
* inspect
* dock
* charge
* open door
* call elevator
* conditional step
* parallel branch

Build a mission editor supporting:

* drag and drop
* reordering
* nested branches
* dependencies
* validation
* save
* duplicate
* cancel
* undo
* redo

Include both list and graph-like representations where useful.

Mission validation should be asynchronous through the simulated gateway.

---

## 4. Mission Execution

Create a live mission execution workspace showing:

* current step
* completed steps
* upcoming steps
* robot position
* progress
* execution logs
* warnings
* operator actions

Operators should be able to:

* pause
* resume
* cancel
* retry
* skip eligible steps

Commands must have realistic pending and failure states.

---

## 5. Traffic Management

Create a traffic control workspace showing:

* route reservations
* congested corridors
* robot queues
* route conflicts
* blocked areas
* deadlock warnings
* priority robots

Allow operators to:

* inspect reservations
* release reservations
* prioritize routes
* reroute robots
* temporarily block corridors

Route preview and validation should use asynchronous requests.

---

## 6. Charging Management

Model limited charging infrastructure.

Support:

* charger availability
* charging queues
* battery-based priority
* reservations
* unavailable chargers
* expected charging time
* mission urgency

Users should be able to reorder charging queues and move robots between chargers.

---

## 7. Telemetry

Implement deterministic simulated telemetry streams.

Telemetry should include:

* position
* battery
* temperature
* velocity
* motor load
* connectivity
* localization confidence

Build:

* current telemetry panel
* history charts
* time range controls
* robot comparison
* telemetry loading states

Do not rely on a real WebSocket server.

Provide a simulation abstraction that behaves like live updates but is deterministic under tests.

---

## 8. Fault and Recovery Center

Support faults such as:

* localization lost
* blocked path
* motor temperature
* battery warning
* sensor degradation
* connectivity loss
* charger failure

Operators can:

* acknowledge
* resolve
* suppress
* retry
* pause robot
* reroute robot

Keep audit history for operator actions.

---

## 9. Teleoperation

Build a manual robot control workspace.

Support:

* acquire control
* release control
* forward
* reverse
* rotate left
* rotate right
* stop
* emergency stop

Include keyboard operation.

Model control ownership explicitly.

Only one operator/session should own manual control at a time.

Handle:

* control expiration
* lost connection
* lost ownership
* command acknowledgement
* pending commands

Accessibility and keyboard behavior are especially important here.

---

## 10. Mission Replay

Build a replay workspace for completed missions.

Support:

* timeline
* play
* pause
* seek
* jump backward
* jump forward
* speed 0.5x
* speed 1x
* speed 2x
* speed 4x

Replay:

* robot movement
* mission state
* faults
* telemetry events

Allow event markers on the timeline.

---

## 11. Scenario Simulator

Create a simulation workspace.

Users can configure scenarios including:

* robot count
* mission arrival rate
* available chargers
* disabled corridors
* elevator latency
* robot speed limits
* congestion

Users can run multiple scenarios and compare results.

Metrics include:

* throughput
* mission completion time
* robot utilization
* charger utilization
* congestion
* deadlocks
* idle time

Simulation results must be deterministic for a given input and seed.

---

## 12. Automation Rules

Allow operators to configure rules such as:

* if battery below threshold, assign charging
* if corridor blocked, reroute affected robots
* if temperature exceeds threshold, pause robot
* if mission fails repeatedly, escalate fault

Provide:

* rule list
* rule editor
* enable/disable
* priority ordering
* validation
* test rule against example event

---

## 13. Activity and Audit

Track significant system and operator activity.

Support:

* filters
* time ranges
* entity filters
* user filters
* event type filters
* expandable event details

---

## 14. Global Search and Command Palette

Create global search across:

* robots
* missions
* facilities
* zones
* faults
* charging stations

Create a command palette for navigation and common actions.

Support complete keyboard navigation and sensible focus behavior.

---

## 15. Permissions

Create roles such as:

* viewer
* operator
* fleet manager
* facility manager
* administrator

Permissions should affect both visible actions and execution eligibility.

Do not merely hide buttons; protected actions must also reject unauthorized operations in the application gateway.

---

# React behavior requirements

The application should contain meaningful interaction complexity.

Model scenarios such as:

* switching robot while a previous robot request is still loading
* switching floors during a pending map operation
* changing selection during a bulk request
* editing a mission while validation is pending
* route previews arriving out of order
* multiple robot commands pending simultaneously
* filters changing while results load
* optimistic updates that can fail
* undo operations while saves are pending
* modal state surviving relevant rerenders
* URL state and visible UI staying synchronized
* keyboard focus remaining correct after dynamic list updates

Implement these correctly rather than intentionally creating failures.

Use request identifiers, cancellation, mutation ownership, or other appropriate patterns where required.

---

# State design

Avoid putting the entire application in one global store.

Use the appropriate state location for each concern:

* server-like data through query/gateway abstractions
* local interaction state in components/hooks
* URL-addressable state in routing/search parameters
* reusable domain state in focused feature modules

Avoid unnecessary duplicated derived state.

Avoid effects whose only purpose is synchronizing state that could be derived during render.

Keep hooks unconditional and dependencies correct.

---

# Accessibility

Use:

* semantic HTML
* real buttons
* labels
* keyboard navigation
* focus management
* ARIA only where necessary
* status text that does not rely only on color

Interactive custom widgets must be keyboard usable.

---

# Repository structure

Prefer domain-oriented organization such as:

src/
app/
components/
gateway/
routing/
test/
features/
facilities/
fleet/
missions/
traffic/
charging/
telemetry/
faults/
teleoperation/
replay/
simulation/
automation/
activity/
search/
permissions/

Keep domains reasonably isolated.

Do not create giant 2,000-line components.

Extract reusable behavior only when there is a real abstraction.

---

# Testing requirements

Create extensive automated tests.

Target eventually:

* 400+ Vitest / React Testing Library tests
* 30+ Playwright journeys

Do not create hundreds of trivial tests simply to increase the count.

Tests should emphasize behavior.

Test:

* async transitions
* race conditions
* keyboard behavior
* focus
* loading
* failure
* retries
* optimistic updates
* route changes
* stale request handling
* selection
* permissions
* undo/redo
* concurrent operations

Use fake timers only when appropriate.

Avoid flaky timing-dependent assertions.

---

# Development strategy

Do NOT attempt to generate the whole application as one massive unreviewable change.

Develop the repository incrementally.

Use roughly these milestones:

1. application foundation
2. gateway and deterministic async engine
3. facilities model
4. digital twin
5. robot fleet
6. robot detail
7. mission model
8. mission editor
9. mission execution
10. telemetry
11. traffic control
12. charging
13. faults and recovery
14. teleoperation
15. replay
16. scenario simulation
17. automation rules
18. activity/audit
19. global search and command palette
20. permissions and hardening
21. broad integration testing
22. accessibility and performance refinement

Make multiple small, meaningful commits during development.

Do not manufacture meaningless commits simply to increase commit count.

Each commit should represent a coherent implementation step.

---

# Important restrictions

Do not turn the product into an issue tracker, project management system, Jira clone, ServiceNow clone, or generic admin dashboard.

The central concepts must remain:

* robots
* spatial facilities
* missions
* telemetry
* routing
* traffic
* charging
* simulation
* teleoperation
* replay

Do not use a UI template that makes every page look like the same CRUD table.

Use several interaction paradigms:

* tables
* spatial views
* timelines
* graph editors
* drawers
* dialogs
* command palettes
* keyboard-driven controls
* charts
* drag and drop
* split-pane workspaces

Create realistic seed data so the application feels like an active robotics environment.

---

Start by inspecting the current repository.

If it is empty, establish the React 19 + TypeScript + Vite foundation first.

Then implement **Milestone 1 only**, thoroughly.

Verify:

* npm install
* typecheck
* tests
* production build

Commit the milestone with a meaningful commit message.

After that, continue milestone by milestone, maintaining all previously working behavior and tests.
