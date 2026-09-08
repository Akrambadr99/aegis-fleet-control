import type { DomainState } from '../../domain/model';
import { CommandButton } from '../../components/CommandButton';
export function CorridorControls({ state, floorId }: { state: DomainState; floorId: string }) {
  return (
    <section className="corridor-controls">
      <h2>Corridor control</h2>
      <div>
        {state.floors[floorId].corridorIds.map((id) => {
          const corridor = state.corridors[id];
          const routes = Object.values(state.routes).filter(
            (r) => r.corridorIds.includes(id) && r.reservationState !== 'released',
          );
          return (
            <section key={id}>
              <strong>
                {id} · {corridor.name}
              </strong>
              <span>
                {corridor.open ? 'Open' : 'Closed'} · {routes.length} reservations
              </span>
              <CommandButton
                command={{
                  type: 'corridor.set',
                  id,
                  expectedRevision: corridor.revision,
                  open: !corridor.open,
                }}
              >
                {corridor.open ? 'Close' : 'Open'} {id}
              </CommandButton>
            </section>
          );
        })}
      </div>
    </section>
  );
}
