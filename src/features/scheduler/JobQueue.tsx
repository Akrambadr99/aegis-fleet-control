import type { WarehouseJob } from '../../domain/jobs';
export function JobQueue({
  jobs,
  selected,
  select,
  tick,
}: {
  jobs: WarehouseJob[];
  selected: string;
  select: (id: string) => void;
  tick: number;
}) {
  return (
    <section className="job-queue">
      <h2>Warehouse queue</h2>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Job / station transfer</th>
              <th>Priority</th>
              <th>Deadline</th>
              <th>Delivered</th>
              <th>Assignment</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id} className={selected === job.id ? 'selected-row' : ''}>
                <td>
                  <button
                    className="text-button"
                    aria-pressed={selected === job.id}
                    onClick={() => select(job.id)}
                  >
                    {job.id}
                  </button>
                  <strong>{job.title}</strong>
                  <small>
                    {job.sourceZoneId} → {job.destinationZoneId}
                  </small>
                </td>
                <td>P{job.priority}</td>
                <td className={tick > job.deadlineTick ? 'overdue' : ''}>
                  {job.deadlineTick - tick}s
                </td>
                <td>
                  {job.completedUnits}/{job.units}
                </td>
                <td>
                  {job.status}
                  <small>{job.robotId ?? 'Unassigned'}</small>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!jobs.length && <p>No jobs in this facility queue.</p>}
    </section>
  );
}
