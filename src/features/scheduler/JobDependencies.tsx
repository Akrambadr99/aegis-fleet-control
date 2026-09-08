import type { WarehouseJob } from '../../domain/jobs';

export function JobDependencies({
  job,
  jobs,
  select,
}: {
  job: WarehouseJob;
  jobs: WarehouseJob[];
  select: (id: string) => void;
}) {
  const following = jobs.filter((entry) => entry.dependsOn.includes(job.id));
  function link(id: string) {
    const entry = jobs.find((candidate) => candidate.id === id);
    return (
      <li key={id}>
        <button disabled={!entry} onClick={() => select(id)}>
          {id}
        </button>{' '}
        · {entry?.status ?? 'unavailable'}
      </li>
    );
  }
  return (
    <section aria-label="Job dependency graph" className="job-dependency-graph">
      <div>
        <h3>Depends on</h3>
        {job.dependsOn.length ? <ul>{job.dependsOn.map(link)}</ul> : <p>No predecessors</p>}
      </div>
      <div>
        <h3>Selected job</h3>
        <strong>{job.id}</strong>
        <p>{job.status}</p>
        <p>All predecessors must complete before dispatch.</p>
      </div>
      <div>
        <h3>Unlocks</h3>
        {following.length ? (
          <ul>{following.map((entry) => link(entry.id))}</ul>
        ) : (
          <p>No dependent jobs</p>
        )}
      </div>
    </section>
  );
}
