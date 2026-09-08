import { usePreference } from '../../hooks/usePreference';
import { NavigationMap } from './NavigationMap';
interface TwinView {
  zoom: number;
  x: number;
  y: number;
  nodes: boolean;
  topology: boolean;
  labels: boolean;
}
const initial: TwinView = { zoom: 1, x: 0, y: 0, nodes: true, topology: true, labels: true };
function valid(value: unknown): value is TwinView {
  if (!value || typeof value !== 'object') return false;
  const v = value as TwinView;
  return (
    Number.isFinite(v.zoom) &&
    v.zoom >= 1 &&
    v.zoom <= 3 &&
    Number.isFinite(v.x) &&
    v.x >= 0 &&
    v.x <= 700 - 700 / v.zoom &&
    Number.isFinite(v.y) &&
    v.y >= 0 &&
    v.y <= 320 - 320 / v.zoom &&
    ['nodes', 'topology', 'labels'].every(
      (key) => typeof (value as Record<string, unknown>)[key] === 'boolean',
    )
  );
}
export function DigitalTwinCanvas({
  floorId,
  label,
  robotId,
  selectRobot,
}: {
  floorId: string;
  label: string;
  robotId: string | null;
  selectRobot: (id: string) => void;
}) {
  const [view, setView] = usePreference('twin-view-' + floorId, initial, valid);
  function move(x: number, y: number, zoom = view.zoom) {
    setView({
      ...view,
      zoom,
      x: Math.max(0, Math.min(700 - 700 / zoom, x)),
      y: Math.max(0, Math.min(320 - 320 / zoom, y)),
    });
  }
  return (
    <section className="twin-canvas" aria-label="Digital twin spatial controls">
      <div className="twin-toolbar">
        <div className="twin-zoom">
          <button
            aria-label="Zoom digital twin in"
            disabled={view.zoom >= 3}
            onClick={() => move(view.x, view.y, view.zoom + 0.25)}
          >
            +
          </button>
          <button
            aria-label="Zoom digital twin out"
            disabled={view.zoom <= 1}
            onClick={() => move(view.x, view.y, view.zoom - 0.25)}
          >
            −
          </button>
          <button onClick={() => setView(initial)}>Fit floor</button>
          <output aria-label="Digital twin zoom">{Math.round(view.zoom * 100)}%</output>
        </div>
        <div className="twin-layers">
          {(['topology', 'nodes', 'labels'] as const).map((layer) => (
            <label key={layer}>
              <input
                type="checkbox"
                checked={view[layer]}
                onChange={(event) => setView({ ...view, [layer]: event.target.checked })}
              />
              {layer === 'topology'
                ? 'Corridors'
                : layer === 'nodes'
                  ? 'Navigation nodes'
                  : 'Zone labels'}
            </label>
          ))}
        </div>
      </div>
      <NavigationMap
        floorId={floorId}
        label={label}
        robotId={robotId}
        viewBox={`${view.x} ${view.y} ${700 / view.zoom} ${320 / view.zoom}`}
        showNodes={view.nodes}
        showTopology={view.topology}
        showLabels={view.labels}
        onSelectRobot={selectRobot}
      />
      <div className="twin-coordinate-bar">
        <span>Floor coordinates · Select a robot marker to inspect its route</span>
        <div>
          <button
            aria-label="Pan floor left"
            disabled={view.x === 0}
            onClick={() => move(view.x - 40, view.y)}
          >
            ←
          </button>
          <button
            aria-label="Pan floor up"
            disabled={view.y === 0}
            onClick={() => move(view.x, view.y - 30)}
          >
            ↑
          </button>
          <button
            aria-label="Pan floor down"
            disabled={view.y >= 320 - 320 / view.zoom}
            onClick={() => move(view.x, view.y + 30)}
          >
            ↓
          </button>
          <button
            aria-label="Pan floor right"
            disabled={view.x >= 700 - 700 / view.zoom}
            onClick={() => move(view.x + 40, view.y)}
          >
            →
          </button>
        </div>
      </div>
    </section>
  );
}
