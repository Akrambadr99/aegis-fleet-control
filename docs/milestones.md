# Delivery milestones

| #     | Milestone                                        | Status                                                                                                   |
| ----- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| 1     | Application foundation                           | Complete                                                                                                 |
| 2     | Gateway and deterministic async engine           | Implemented with versioned atomic commands and deterministic tests                                       |
| 3     | Facilities model                                 | Core relationships implemented; doors, elevators, docks and full navigation graph remain                 |
| 4     | Digital twin                                     | Connected floor view and corridor control; advanced editing remains                                      |
| 5     | Robot fleet                                      | Connected table, filters, sorting, pagination and partial bulk pause; broader commands remain            |
| 6     | Robot detail                                     | Shared inspector and async route preview; expanded detail remains                                        |
| 7–9   | Mission model/editor/execution                   | Runtime references, pause/resume/reroute exist; editor and full state machine remain                     |
| 10    | Telemetry                                        | Deterministic stepping and bounded battery/position history; advanced analysis remains                   |
| 11    | Traffic                                          | Corridor closures, route health, reservation effects and explicit reroute; queues/deadlock logic remains |
| 12    | Charging                                         | Availability and displaced reservations; moves/reordering/progression remain                             |
| 13    | Faults                                           | Robot fault acknowledgement and readiness effects; resource faults/recovery remain                       |
| 14    | Teleoperation                                    | Lease revocation on stop only; control workflow remains                                                  |
| 15    | Replay                                           | Cross-domain command frames; timeline reconstruction/playback remains                                    |
| 16    | Simulation                                       | Shared scenario inputs; seeded comparison execution remains                                              |
| 17    | Automation                                       | Planned                                                                                                  |
| 18    | Activity/audit                                   | Shared command/system events; advanced filtering remains                                                 |
| 19    | Search and command palette                       | Planned                                                                                                  |
| 20    | Permissions and hardening                        | Gateway role checks exist; full role/workspace hardening remains                                         |
| 21–22 | Broad integration, accessibility and performance | Incremental checks running; final product gates remain                                                   |

The next milestone expands the facility topology and navigation graph, maintaining the connected behaviors already validated. Each domain grows with tests of its effects on other domains. No existing panel is considered a complete domain merely because it is routed.
