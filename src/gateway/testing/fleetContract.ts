import { describe, expect, it } from 'vitest';
import type { FleetQueries, FleetCommands } from '../ports';
export function fleetContract(
  name: string,
  create: () => { gateway: FleetQueries & FleetCommands; settle: () => void },
) {
  describe(name, () => {
    it('returns detached query records', async () => {
      const { gateway, settle } = create();
      const ticket = gateway.readRobot('R-001');
      settle();
      const robot = await ticket.promise;
      robot.battery = 0;
      expect(gateway.getSnapshot().robots[robot.id].battery).not.toBe(0);
    });
    it('rejects revision conflicts without a second publish', async () => {
      const { gateway, settle } = create();
      let notifications = 0;
      const unsub = gateway.subscribe(() => notifications++);
      const command = {
        type: 'robot.stop' as const,
        id: 'R-001',
        expectedRevision: gateway.getSnapshot().robots['R-001'].revision,
      };
      const actor = { id: 'a', role: 'administrator' as const };
      const first = gateway.command(actor, command);
      const second = gateway.command(actor, command);
      const failed = expect(second.promise).rejects.toMatchObject({ code: 'stale' });
      settle();
      await first.promise;
      await failed;
      expect(notifications).toBe(1);
      unsub();
    });
    it('keeps failed authorization atomic', async () => {
      const { gateway, settle } = create();
      const before = gateway.getSnapshot();
      const ticket = gateway.command(
        { id: 'v', role: 'viewer' },
        { type: 'robot.stop', id: 'R-001', expectedRevision: 1 },
      );
      const result = expect(ticket.promise).rejects.toMatchObject({ code: 'forbidden' });
      settle();
      await result;
      expect(gateway.getSnapshot()).toBe(before);
    });
  });
}
