import { pageCollection } from '../../application/collections';
import { useSearchParams } from 'react-router-dom';
import type { WarehouseJob } from '../../domain/jobs';
import { JobQueue } from './JobQueue';

const statuses = [
  'queued',
  'assigned',
  'in-progress',
  'partially-completed',
  'completed',
  'cancelled',
];
export function JobQueuePanel(props: {
  jobs: WarehouseJob[];
  selected: string;
  select: (id: string) => void;
  tick: number;
}) {
  const [params, setParams] = useSearchParams();
  const query = params.get('jobQuery') ?? '';
  const status = statuses.includes(params.get('jobStatus') ?? '') ? params.get('jobStatus')! : '';
  const priority = /^[1-5]$/.test(params.get('jobPriority') ?? '')
    ? params.get('jobPriority')!
    : '';
  const jobs = props.jobs.filter(
    (job) =>
      (!status || job.status === status) &&
      (!priority || job.priority >= Number(priority)) &&
      [job.id, job.title, job.sourceZoneId, job.destinationZoneId].some((value) =>
        value.toLowerCase().includes(query.trim().toLowerCase()),
      ),
  );
  const page = pageCollection(jobs, Number(params.get('jobPage')), 25);
  function update(key: string, value: string) {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (key !== 'jobPage') next.delete('jobPage');
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: key === 'jobQuery' },
    );
  }
  return (
    <>
      <div className="job-filterbar" aria-label="Job queue filters">
        <label>
          Search jobs
          <input value={query} onChange={(event) => update('jobQuery', event.target.value)} />
        </label>
        <label>
          Job status
          <select value={status} onChange={(event) => update('jobStatus', event.target.value)}>
            <option value="">All statuses</option>
            {statuses.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Minimum job priority
          <select value={priority} onChange={(event) => update('jobPriority', event.target.value)}>
            <option value="">All priorities</option>
            {[1, 2, 3, 4, 5].map((value) => (
              <option value={value} key={value}>
                P{value} and above
              </option>
            ))}
          </select>
        </label>
      </div>
      <p role="status">
        {jobs.length} of {props.jobs.length} jobs shown
      </p>
      {props.selected && !jobs.some((job) => job.id === props.selected) && (
        <p>
          Selected job {props.selected} is outside the queue filters. Its inspector remains open.
        </p>
      )}
      <JobQueue {...props} jobs={page.items} />
      {page.pages > 1 && (
        <nav aria-label="Job pages">
          <button disabled={!page.page} onClick={() => update('jobPage', String(page.page - 1))}>
            Previous jobs
          </button>
          <span>
            Page {page.page + 1} of {page.pages}
          </span>
          <button
            disabled={page.page + 1 === page.pages}
            onClick={() => update('jobPage', String(page.page + 1))}
          >
            Next jobs
          </button>
        </nav>
      )}
    </>
  );
}
