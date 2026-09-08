import { Link, useSearchParams } from 'react-router-dom';
import { facilities, resolveFacility } from './snapshot';
import { FacilityPreview } from './FacilityPreview';
import { useDomain } from '../../app/FleetProvider';

export function Overview() {
  const [params, setParams] = useSearchParams();
  const state = useDomain();
  const facility = resolveFacility(state, params.get('facility'));
  const jobs = Object.values(state.jobs)
    .filter(
      (job) =>
        job.facilityId === facility.domainId && !['completed', 'cancelled'].includes(job.status),
    )
    .sort((a, b) => b.priority - a.priority || a.deadlineTick - b.deadlineTick);
  return (
    <div className="operations-desk">
      <header className="desk-header">
        <div>
          <p className="eyebrow">FLEET CONTROL / SHIFT OPERATIONS</p>
          <h1>Operations desk</h1>
        </div>
        <span className="desk-clock">
          Simulation tick <strong>{state.tick}</strong> · Topology rev{' '}
          {state.facilities[facility.domainId].topologyRevision}
        </span>
      </header>
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
      <dl className="fleet-strip" aria-label="Facility summary">
        <div>
          <dt>Connected robots</dt>
          <dd>
            {facility.online} / {facility.fleet}
          </dd>
        </div>
        <div>
          <dt>Executing missions</dt>
          <dd>{facility.active}</dd>
        </div>
        <div>
          <dt>Ready for dispatch</dt>
          <dd>{facility.available}</dd>
        </div>
        <div>
          <dt>Charging</dt>
          <dd>{facility.charging}</dd>
        </div>
        <div>
          <dt>Offline</dt>
          <dd>{facility.offline}</dd>
        </div>
      </dl>
      <div className="desk-layout">
        <div className="desk-spatial">
          <section className="desk-map" aria-label="Facility operating picture">
            <header>
              <div>
                <h2>{facility.name}</h2>
                <span>{facility.floors[0]} · Current robot positions and routes</span>
              </div>
              <Link to={`/facilities?facility=${facility.domainId}`}>Open digital twin ↗</Link>
            </header>
            <FacilityPreview facility={facility} />
            <div className="map-footer">
              <span>● Robot position · Lines: navigation corridors</span>
              <Link to={`/traffic?facility=${facility.domainId}`}>Route reservations ↗</Link>
            </div>
          </section>
          <section className="desk-dispatch" aria-label="Dispatch commitments">
            <header>
              <h2>Dispatch commitments</h2>
              <Link to={`/scheduler?facility=${facility.domainId}`}>Open scheduler ↗</Link>
            </header>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Job / priority</th>
                    <th>Transfer</th>
                    <th>Custody</th>
                    <th>Fulfillment</th>
                    <th>Deadline</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr key={job.id}>
                      <td>
                        <Link to={`/scheduler?facility=${facility.domainId}&job=${job.id}`}>
                          {job.id}
                        </Link>{' '}
                        · P{job.priority}
                      </td>
                      <td>
                        {job.title}
                        <small>
                          {job.sourceZoneId} → {job.destinationZoneId}
                        </small>
                      </td>
                      <td>{job.custody}</td>
                      <td>
                        {job.completedUnits} / {job.units} · {job.status}
                      </td>
                      <td className={job.deadlineTick < state.tick ? 'overdue' : undefined}>
                        {job.deadlineTick < state.tick ? 'Overdue' : 'Due'} tick {job.deadlineTick}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!jobs.length && <p>No outstanding warehouse commitments in this facility.</p>}
          </section>
        </div>
        <aside className="desk-watch" aria-label="Operational watch">
          <header>
            <h2>Operator attention</h2>
            <span>{facility.attention} affected robots</span>
          </header>
          <ul className="watch-list">
            {facility.activity.map((activity) => {
              const robotId = activity.split(':')[0];
              return (
                <li key={activity}>
                  <Link to={`/fleet?facility=${facility.domainId}&robot=${robotId}`}>
                    {activity}
                  </Link>
                  <small>Inspect robot state and recovery controls ↗</small>
                </li>
              );
            })}
          </ul>
          {!facility.activity.length && <p>No active robot advisories.</p>}
          <section className="desk-capacity">
            <h3>Dispatch capacity</h3>
            <label htmlFor="fleet-utilization">
              Active fleet utilization · {facility.throughput}%
            </label>
            <progress
              id="fleet-utilization"
              aria-label="Active fleet utilization"
              max="100"
              value={facility.throughput}
            />
            <p>
              {facility.available} ready · {facility.charging} charging · {facility.offline}{' '}
              disconnected
            </p>
            <Link to={`/fleet?facility=${facility.domainId}`}>Inspect fleet eligibility ↗</Link>
          </section>
          <section className="desk-handover">
            <h3>Shift record</h3>
            <p>{facility.missions} retained completed missions</p>
            <Link to={`/activity?facility=${facility.domainId}`}>
              Operator actions and audit ↗
            </Link>
            <Link to={`/replay?facility=${facility.domainId}`}>Execution replay ↗</Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
