import { useFleet } from '../../app/FleetProvider';
import { MaintenancePanel } from '../maintenance/MaintenancePanel';
import type { Role } from '../../domain/model';
import { useScope } from './useScope';
import { FleetTable } from './FleetTable';
import { TopologyPanel } from './TopologyPanel';
import {
  ChargingPanel,
  FaultPanel,
  ExecutionPanel,
  ActivityPanel,
  SimulationPanel,
  TelemetryPanel,
} from './ResourcePanels';
import { RobotInspector } from './RobotInspector';
import type { Workspace } from '../../routing/workspaces';
export const connectedPaths = [
  '/fleet',
  '/maintenance',
  '/facilities',
  '/traffic',
  '/charging',
  '/faults',
  '/execution',
  '/activity',
  '/simulation',
  '/telemetry',
  '/replay',
];
export function OperationsWorkspace({ workspace }: { workspace: Workspace }) {
  const { state, facility, floor, change } = useScope(),
    { gateway, actor, setRole, controlScope, setControlScope } = useFleet();
  const panels: Record<string, React.ReactNode> = {
    '/fleet': <FleetTable key={facility.id} />,
    '/maintenance': <MaintenancePanel />,
    '/facilities': <TopologyPanel map />,
    '/traffic': <TopologyPanel />,
    '/charging': <ChargingPanel />,
    '/faults': <FaultPanel />,
    '/execution': <ExecutionPanel />,
    '/activity': <ActivityPanel />,
    '/simulation': <SimulationPanel />,
    '/telemetry': <TelemetryPanel />,
    '/replay': <ActivityPanel replay />,
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">CONNECTED OPERATIONS</p>
          <h1>{workspace.title}</h1>
          <p>Shared facility state · Tick {state.tick}</p>
        </div>
        <span className="pill">Local simulation</span>
      </div>
      <div className="control-row scope-controls">
        <label>
          Operating facility
          <select value={facility.id} onChange={(e) => change('facility', e.target.value)}>
            {Object.values(state.facilities).map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Floor
          <select value={floor.id} onChange={(e) => change('floor', e.target.value)}>
            {facility.floorIds.map((id) => (
              <option key={id} value={id}>
                {state.floors[id].name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Simulation role
          <select value={actor.role} onChange={(e) => setRole(e.target.value as Role)}>
            {['viewer', 'operator', 'fleet-manager', 'facility-manager', 'administrator'].map(
              (role) => (
                <option key={role}>{role}</option>
              ),
            )}
          </select>
        </label>
        <label>
          Control scope
          <select value={controlScope} onChange={(event) => setControlScope(event.target.value)}>
            <option value="all">All facilities</option>
            {Object.values(state.facilities).map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
        <button onClick={() => gateway.advance()}>Advance simulation</button>
      </div>
      <div className="operations-layout">
        <div className="operations-content">{panels[workspace.path]}</div>
        <RobotInspector />
      </div>
    </>
  );
}
