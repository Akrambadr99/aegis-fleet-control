## Expand the project into a very large interconnected React codebase

The application must evolve into a substantial software system with deep relationships between domains.

Do not increase size by creating disconnected pages, duplicate CRUD modules, artificial abstractions, or filler code.

Increase size through:

- richer domain models
- shared infrastructure
- reusable behavior
- cross-feature workflows
- asynchronous coordination
- state machines
- derived data
- permissions
- history
- simulation
- background-like deterministic events
- complex navigation
- real dependencies between features

The product should feel like one large operating system for autonomous robotics rather than a collection of separate mini-apps.

---

# Target architecture scale

Grow the repository toward approximately:

- 25–30 major feature domains
- 180–250 meaningful React components
- 100+ hooks and reusable domain utilities
- 80–120 routes, panels, dialogs, inspectors, or major workspaces
- 80+ domain entities/value objects/state models
- 150+ gateway operations
- 600–900 meaningful Vitest/RTL tests
- 50–80 Playwright journeys
- 120–180 meaningful commits

These are architectural targets, not quotas.

Do not generate filler code merely to reach the numbers.

---

# Core domain graph

Model the product as an interconnected graph.

Facility
↔ Floor
↔ Zone
↔ Corridor
↔ Door
↔ Elevator
↔ Workstation
↔ Charger
↔ NavigationNode

Robot
↔ Facility
↔ Position
↔ Mission
↔ Route
↔ Telemetry
↔ Battery
↔ Fault
↔ Maintenance
↔ ChargingReservation
↔ ControlSession

Mission
↔ MissionTemplate
↔ MissionStep
↔ Robot
↔ Facility
↔ Route
↔ TrafficReservation
↔ ResourceReservation
↔ Execution
↔ Replay
↔ Audit

Route
↔ FacilityTopology
↔ Corridor
↔ Traffic
↔ Robot
↔ Mission
↔ Restrictions
↔ Reservations

Fault
↔ Robot
↔ Mission
↔ FacilityResource
↔ Charger
↔ Traffic
↔ RecoveryAction
↔ AutomationRule

Charging
↔ Robot
↔ MissionPriority
↔ Charger
↔ Queue
↔ Reservation
↔ BatteryTelemetry
↔ Traffic

Simulation
↔ Facility
↔ Fleet
↔ Missions
↔ Traffic
↔ Charging
↔ Faults
↔ Automation

Replay
↔ Mission
↔ Telemetry
↔ RobotMovement
↔ Faults
↔ TrafficEvents
↔ OperatorActions

Every major entity should participate in several workflows.

---

# Add more domains

In addition to the existing platform areas, add these domains.

## 1. Warehouse Job Orchestration

Represent business jobs that require robots.

Examples:

- move pallet
- replenish station
- retrieve container
- inspect aisle
- transfer tote
- clear staging area

A job may produce one or multiple missions.

Support:

- job priorities
- deadlines
- dependencies
- assignment policies
- retry policies
- batching
- cancellation
- partial completion

Jobs should affect fleet scheduling and mission generation.

---

## 2. Multi-Robot Cooperative Missions

Support missions requiring multiple robots.

Examples:

- synchronized pickup
- convoy movement
- heavy load transport
- shared inspection
- zone sweep

Model:

- participants
- coordinator robot
- synchronization barriers
- waiting states
- participant failures
- replacement robot assignment
- abort policies

One robot failure may affect the entire cooperative mission.

---

## 3. Resource Arbitration

Model shared resources such as:

- elevators
- automatic doors
- narrow corridors
- docking stations
- inspection stations
- loading bays

Robots must acquire reservations before using them.

Support:

- queues
- priority
- ownership
- expiration
- cancellation
- conflicts

This system must integrate with mission execution and traffic management.

---

## 4. Fleet Scheduler

Create a scheduling engine that determines which robot should execute each job.

Consider:

- robot location
- battery
- capability
- current workload
- faults
- facility
- mission priority
- deadlines
- traffic
- charging requirements

The UI should allow operators to inspect assignment reasoning and manually override assignments.

---

## 5. Robot Capabilities

Different robots should support different capabilities.

Examples:

- payload capacity
- lift capability
- camera
- scanner
- temperature tolerance
- indoor/outdoor operation
- supported docking types

Mission eligibility must depend on capabilities.

---

## 6. Maintenance

Model robot maintenance.

Include:

- maintenance schedules
- service intervals
- component health
- maintenance windows
- technicians
- parts
- inspections

A robot under maintenance cannot accept normal missions.

Upcoming maintenance should affect scheduling decisions.

---

## 7. Component Health

Represent subsystems such as:

- motors
- battery
- lidar
- camera
- IMU
- wheels
- lift mechanism

Telemetry should contribute to health state.

Health degradation may generate faults or maintenance recommendations.

---

## 8. Inventory and Payload Tracking

Track payloads transported by robots.

Include:

- containers
- pallets
- totes
- payload ownership
- source
- destination
- weight
- status

Mission completion must update payload location.

Cancelled or failed missions must not incorrectly move inventory.

---

## 9. Facility Resource Control

Support:

- doors
- elevators
- conveyor interfaces
- dock locks
- loading bays

Resources have their own state machines.

Example elevator:

Idle
→ Reserved
→ Moving to pickup
→ Boarding
→ Moving
→ Unloading
→ Available

Robot missions interact with these states.

---

## 10. Shift Operations

Model operator shifts.

Support:

- current operators
- handover
- outstanding incidents
- active overrides
- control ownership
- unresolved faults

Create a shift handover workspace summarizing operational state.

---

## 11. Policy Engine

Create operational policies.

Examples:

- maximum robot speed by zone
- minimum battery before mission
- restricted robot classes
- emergency rules
- charging reserve threshold

Policy changes should propagate through eligibility and validation.

---

## 12. Geofencing and Safety

Support:

- restricted areas
- speed zones
- temporary exclusion zones
- emergency zones
- human-only areas

Changing a zone should affect route validation and active missions.

---

## 13. Command Center

Create a high-density operations workspace combining:

- map
- selected robot
- active mission
- faults
- traffic
- telemetry
- operator actions

Use resizable panes and contextual inspectors.

This should be one of the most complex React screens in the product.

---

# Shared infrastructure

Build substantial reusable infrastructure.

## Entity cache

Create centralized server-state caching behavior through TanStack Query or focused abstractions.

Entities updated in one workspace should update other relevant views.

---

## Mutation coordination

Build reusable handling for:

- optimistic updates
- rollback
- request ownership
- stale mutation completion
- partial failure
- concurrent mutations

Do not globally serialize unrelated operations.

---

## Selection framework

Provide reusable selection behavior for:

- tables
- maps
- queues
- search results
- bulk actions

Support:

- single select
- multi-select
- shift-range selection where appropriate
- selection preservation
- selected-but-filtered entities

---

## Keyboard command system

Create a centralized command registry.

Support:

- global shortcuts
- context-specific commands
- command palette
- disabled command reasons
- keyboard scope
- focus-safe shortcuts

---

## Overlay system

Create reusable:

- dialogs
- drawers
- inspectors
- popovers
- confirmation workflows

Support nested UI without broken focus behavior.

---

## Notification system

Application events can generate:

- toast notifications
- activity entries
- persistent alerts

Do not duplicate notification logic across features.

---

## Permissions engine

Permissions should support:

- role
- facility scope
- action type
- entity state

Example:

An operator may control robots in Facility A but only view Facility B.

---

## Audit infrastructure

Every important mutation should generate structured audit records.

Example:

actor
action
entity
previous state
new state
timestamp
reason

---

# Shared state machines

Create explicit lifecycle models for important entities.

Robot:

Offline
→ Booting
→ Available
→ Assigned
→ Executing
→ Paused
→ Faulted
→ Recovering
→ Available

Mission:

Draft
→ Validating
→ Ready
→ Scheduled
→ Assigned
→ Running
→ Paused
→ Recovering
→ Completed / Failed / Cancelled

Job:

Created
→ Planned
→ Assigned
→ Executing
→ Partially completed
→ Completed / Failed

Charger reservation:

Requested
→ Queued
→ Reserved
→ Approaching
→ Docked
→ Charging
→ Released

Resource reservation:

Requested
→ Waiting
→ Granted
→ Active
→ Released / Expired

Maintenance:

Scheduled
→ Due
→ In progress
→ Verification
→ Completed

These states should influence UI controls and cross-domain logic.

---

# Complex cross-feature workflows

Implement workflows that cross many domains.

## Example: mission assignment

Creating a mission should potentially involve:

1. validate mission structure
2. check robot capability
3. check battery
4. check maintenance eligibility
5. check facility restrictions
6. calculate route
7. estimate battery consumption
8. inspect traffic
9. inspect shared resource availability
10. create reservations
11. schedule execution
12. emit activity
13. update robot state

Each step should be represented through real domain logic.

---

## Example: robot fault during mission

If a robot faults while executing:

1. telemetry generates fault
2. robot state changes
3. mission execution pauses
4. route reservations may be released
5. shared resource reservations may be released
6. traffic state updates
7. automation rules run
8. recovery options appear
9. scheduler may search for replacement robot
10. cooperative mission participants may wait
11. activity/audit records update
12. replay records the event

---

## Example: facility restriction update

Adding a temporary exclusion zone should:

1. update digital twin
2. increment topology revision
3. invalidate affected route calculations
4. detect active robots in the area
5. flag impacted missions
6. recompute route previews
7. update traffic
8. notify relevant operators
9. affect simulations
10. add audit history

---

# Cross-route persistence

Users should be able to move between workspaces without losing unrelated state.

Examples:

- Fleet filters survive opening robot detail.
- Returning from mission execution restores the previous mission list.
- Replay time position persists when opening an event inspector.
- Map zoom and floor selection survive opening a robot drawer.
- Search may open an entity without corrupting the destination workspace state.

Use nested routes and URL search parameters where appropriate.

---

# Concurrent operations

Support multiple operations at once.

Examples:

Robot A may be pausing while:

- Robot B is being rerouted
- Robot C is receiving telemetry
- charging queue is being reordered
- facility route validation is running

Never represent the entire application with one global `isLoading`.

Pending state should be scoped to the correct entity/action.

---

# Revision-aware async state

Important data should have revision/version identifiers.

Examples:

Facility topology revision
Mission revision
Route revision
Automation rule revision
Charging queue revision

Any asynchronous result should be associated with the revision that created it.

Old results must not overwrite newer edits.

---

# Event engine

Create a deterministic application event engine.

Events can include:

- telemetry tick
- robot moved
- mission step completed
- fault detected
- resource released
- charger became available
- reservation expired
- automation triggered

The engine should be test-controllable.

Do not use real external services.

---

# Data realism

Generate consistent interconnected seed data.

Do not generate unrelated random objects.

Example:

If Robot R-018 has mission M-203:

- M-203 must reference R-018
- R-018 must expose M-203 as active
- its route must belong to M-203
- traffic reservations must reference the route
- telemetry should place R-018 along that route
- replay data should use the same mission and robot
- faults should reference valid entities

Maintain referential integrity.

---

# Code quality

The application may be large, but it must not become intentionally messy.

Avoid:

- giant god components
- giant global context
- duplicated domain logic
- circular imports
- arbitrary global variables
- unstable hooks
- unnecessary effects

Prefer:

- domain modules
- selectors
- focused hooks
- state machines
- reusable application infrastructure
- typed gateway contracts
- test factories
- deterministic fixtures

---

# Important development rule

Do not implement the entire target architecture in one commit.

Continue expanding the repository through small coherent milestones.

Each milestone should:

1. add real product capability,
2. connect to existing domains,
3. add meaningful tests,
4. preserve all previous behavior,
5. include a coherent git commit.

Before each commit run:

- typecheck
- tests
- production build

Periodically run the Playwright suite as well.

The final result should feel like a codebase that has evolved over a long period of real product development.
