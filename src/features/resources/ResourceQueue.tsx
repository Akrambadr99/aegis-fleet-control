import type { DomainState } from '../../domain/model';
import type { FacilityResource } from '../../domain/resources';
import { CommandButton } from '../../components/CommandButton';
export function ResourceQueue({
  resource,
  state,
}: {
  resource: FacilityResource;
  state: DomainState;
}) {
  const leases = Object.values(state.resourceReservations)
    .filter((r) => r.resourceId === resource.id && ['owned', 'queued'].includes(r.state))
    .sort(
      (a, b) =>
        Number(b.state === 'owned') - Number(a.state === 'owned') ||
        b.priority - a.priority ||
        a.requestedTick - b.requestedTick,
    );
  return (
    <section className="resource-queue">
      <h2>{resource.name}</h2>
      <p>
        {resource.id} · {resource.zoneId} · Capacity {resource.capacity}
      </p>
      <CommandButton
        command={{
          type: 'resource.set',
          id: resource.id,
          expectedRevision: resource.revision,
          available: !resource.available,
        }}
      >
        {resource.available ? 'Take out of service' : 'Restore resource'}
      </CommandButton>
      <h3>Ownership & waiting queue</h3>
      <ol>
        {leases.map((lease) => (
          <li key={lease.id}>
            <strong>
              {lease.robotId} · {lease.state}
            </strong>
            <p>
              {lease.missionId ?? 'Manual reservation'} · P{lease.priority} ·{' '}
              {lease.expiresTick - state.tick}s remaining
            </p>
            <CommandButton
              command={{ type: 'resource.release', id: lease.id, expectedRevision: lease.revision }}
            >
              Release {lease.robotId}
            </CommandButton>
          </li>
        ))}
      </ol>
      {!leases.length && <p>No active ownership or waiting requests.</p>}
    </section>
  );
}
