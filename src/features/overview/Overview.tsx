import { Link, useSearchParams } from 'react-router-dom';
import { facilities, resolveFacility } from './snapshot';
import { FacilityPreview } from './FacilityPreview';
import { useDomain } from '../../app/FleetProvider';
export function Overview() {
  const [params, setParams] = useSearchParams();
  const state = useDomain();
  const facility = resolveFacility(state, params.get('facility'));
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">COMMAND CENTER / OPERATIONS</p>
          <h1>Every robot. One clear picture.</h1>
          <p>Operational context for your autonomous fleet.</p>
        </div>
        <span className="pill">
          <span className="status-dot" /> Shared simulation state
        </span>
      </div>
      <div className="facility-bar">
        <div>
          <label htmlFor="facility">Facility</label>
          <select
            id="facility"
            value={facility.id}
            onChange={(event) =>
              setParams((previous) => {
                const next = new URLSearchParams(previous);
                next.set('facility', event.target.value);
                return next;
              })
            }
          >
            {facilities.map((item) => (
              <option key={item.id} value={item.id}>
                {state.facilities[item.domainId].name}
              </option>
            ))}
          </select>
        </div>
        <span>{facility.location}</span>
        <span className="facility-area">{facility.floors.length} floors</span>
      </div>
      <section className="metrics" aria-label="Facility summary">
        <article>
          <p>Fleet online</p>
          <strong>
            {facility.online}
            <span> / {facility.fleet}</span>
          </strong>
          <small>{facility.offline} robots offline</small>
        </article>
        <article>
          <p>Robots active</p>
          <strong>{facility.active}</strong>
          <small>Assigned to operations</small>
        </article>
        <article>
          <p>Missions completed</p>
          <strong>{facility.missions}</strong>
          <small>Retained completed missions</small>
        </article>
        <article>
          <p>Needs attention</p>
          <strong className="amber">{facility.attention.toString().padStart(2, '0')}</strong>
          <small>Open operational advisories</small>
        </article>
      </section>
      <div className="overview-grid">
        <section className="panel map-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">SPATIAL CONTEXT</p>
              <h2>{facility.name}</h2>
            </div>
            <span className="muted">{facility.floors[0]}</span>
          </div>
          <FacilityPreview facility={facility} />
          <div className="map-footer">
            <div>
              <span className="legend-dot robot-dot" />
              Robot <span className="legend-dot route-dot" />
              Corridor
            </div>
            <Link to={`/facilities?facility=${facility.domainId}`}>Open digital twin ↗</Link>
          </div>
        </section>
        <section className="panel shift-panel">
          <p className="eyebrow">SHIFT READINESS</p>
          <h2>Capacity at a glance</h2>
          <div className="capacity-value">
            {facility.throughput}
            <span>%</span>
          </div>
          <p>Active fleet utilization</p>
          <progress aria-label="Active fleet utilization" max="100" value={facility.throughput} />
          <dl>
            <div>
              <dt>Active robots</dt>
              <dd>{facility.active}</dd>
            </div>
            <div>
              <dt>At charging stations</dt>
              <dd>{facility.charging}</dd>
            </div>
            <div>
              <dt>Available for assignment</dt>
              <dd>{facility.available}</dd>
            </div>
            <div>
              <dt>Needs attention</dt>
              <dd>{facility.attention}</dd>
            </div>
            <div>
              <dt>Offline</dt>
              <dd>{facility.offline}</dd>
            </div>
          </dl>
          <p className="snapshot-note">
            Shared gateway state. Advance the simulation from an operational workspace to update
            telemetry.
          </p>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">OPERATIONS BRIEF</p>
              <h2>Facility advisories</h2>
            </div>
            <span className="pill">{facility.attention} robots</span>
          </div>
          <ul className="advisories">
            {facility.activity.map((activity, index) => (
              <li key={activity}>
                <span className="advisory-number">{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <strong>{activity}</strong>
                  <p>Robot advisory · {facility.name}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
        <section className="panel next-panel">
          <p className="eyebrow">WORKSPACE DIRECTORY</p>
          <h2>Explore the control platform</h2>
          <Link to="/missions">
            <span>
              Mission management<small>Composition & execution</small>
            </span>
            <span aria-hidden="true">↗</span>
          </Link>
          <Link to={`/traffic?facility=${facility.domainId}`}>
            <span>
              Traffic control<small>Reservations & routing</small>
            </span>
            <span aria-hidden="true">↗</span>
          </Link>
          <Link to={`/simulation?facility=${facility.domainId}`}>
            <span>
              Scenario simulator<small>Capacity & planning</small>
            </span>
            <span aria-hidden="true">↗</span>
          </Link>
        </section>
      </div>
    </>
  );
}
