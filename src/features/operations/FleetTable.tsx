import { useMemo, useState } from 'react';
import { useFleet } from '../../app/FleetProvider';
import { readiness } from '../../domain/selectors';
import { useScope } from './useScope';
import { facilityPermission } from '../../domain/permissions';
export function FleetTable() {
  const { state, facility, params, change } = useScope(),
    { gateway, actor } = useFleet();
  const [selection, setSelection] = useState<Set<string>>(new Set()),
    [pending, setPending] = useState(false),
    [outcomes, setOutcomes] = useState<{ id: string; message: string; status: string }[]>([]);
  const search = params.get('q') ?? '',
    status = params.get('status') ?? 'all',
    sort = params.get('sort') ?? 'id';
  const rows = useMemo(
    () =>
      Object.values(state.robots)
        .filter(
          (r) =>
            r.facilityId === facility.id &&
            r.id.toLowerCase().includes(search.toLowerCase()) &&
            (status === 'all' || r.status === status),
        )
        .sort((a, b) => (sort === 'battery' ? a.battery - b.battery : a.id.localeCompare(b.id))),
    [state.robots, facility.id, search, status, sort],
  );
  const page = Math.max(
    0,
    Math.min(
      Math.floor(Number(params.get('page')) || 0),
      Math.max(0, Math.ceil(rows.length / 10) - 1),
    ),
  );
  const visible = rows.slice(page * 10, page * 10 + 10);
  async function bulkPause() {
    const ids = [...selection].filter((id) => state.robots[id].facilityId === facility.id);
    setPending(true);
    setOutcomes([]);
    const result = await gateway.bulk(
      actor,
      ids.map((id) => ({ type: 'robot.pause', id, expectedRevision: state.robots[id].revision })),
    );
    setOutcomes(result);
    setPending(false);
  }
  return (
    <section className="panel">
      <div className="control-row">
        <label>
          Find robot
          <input value={search} onChange={(e) => change('q', e.target.value)} />
        </label>
        <label>
          Status
          <select value={status} onChange={(e) => change('status', e.target.value)}>
            {['all', 'running', 'paused', 'emergency-stopped', 'idle'].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          Sort
          <select value={sort} onChange={(e) => change('sort', e.target.value)}>
            <option value="id">Robot ID</option>
            <option value="battery">Battery, lowest first</option>
          </select>
        </label>
        <button
          disabled={
            pending ||
            ![...selection].some((id) => state.robots[id].facilityId === facility.id) ||
            !!facilityPermission(actor, facility.id, 'robot.pause')
          }
          onClick={bulkPause}
        >
          {pending ? 'Pausing selected robots…' : 'Pause selected'}
        </button>
      </div>
      <p>
        {rows.length} robots · {selection.size} selected
      </p>
      <div className="table-scroll">
        <table>
          <caption>Fleet in {facility.name}</caption>
          <thead>
            <tr>
              <th>Select</th>
              <th>Robot</th>
              <th>Status</th>
              <th>Battery</th>
              <th>Mission</th>
              <th>Readiness</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((robot) => (
              <tr key={robot.id}>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Select ${robot.id}`}
                    checked={selection.has(robot.id)}
                    onChange={() =>
                      setSelection((previous) => {
                        const next = new Set(previous);
                        if (next.has(robot.id)) next.delete(robot.id);
                        else next.add(robot.id);
                        return next;
                      })
                    }
                  />
                </td>
                <th>
                  <button className="text-button" onClick={() => change('robot', robot.id)}>
                    {robot.id}
                  </button>
                </th>
                <td>{robot.status}</td>
                <td>{robot.battery.toFixed(1)}%</td>
                <td>{robot.activeMissionId}</td>
                <td>{readiness(state, robot).join('; ') || 'Ready'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && <p>No robots match these filters.</p>}
      <div className="control-row">
        <button disabled={page === 0} onClick={() => change('page', String(page - 1))}>
          Previous
        </button>
        <span>Page {page + 1}</span>
        <button
          disabled={(page + 1) * 10 >= rows.length}
          onClick={() => change('page', String(page + 1))}
        >
          Next
        </button>
        <button onClick={() => setSelection(new Set())}>Clear selection</button>
      </div>
      <ul aria-label="Bulk command outcomes" aria-live="polite">
        {outcomes.map((outcome) => (
          <li key={outcome.id}>
            {outcome.id}: {outcome.status} — {outcome.message}
          </li>
        ))}
      </ul>
    </section>
  );
}
