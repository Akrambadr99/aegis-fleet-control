import { expect, it } from 'vitest';
import { FleetGateway } from '../gateway/FleetGateway';
import { ManualScheduler } from '../gateway/scheduler';
import { defaultConfiguration } from './configuration';
it('rejects disabled routing before any canonical state change and captures configuration', async () => {
  const clock = new ManualScheduler();
  const config = { ...defaultConfiguration, advancedRouting: false };
  const gateway = new FleetGateway(clock, undefined, config);
  config.advancedRouting = true;
  const before = gateway.getSnapshot();
  const ticket = gateway.command(
    { id: 'a', role: 'administrator' },
    { type: 'robot.reroute', id: 'R-001', expectedRevision: 1 },
  );
  const result = expect(ticket.promise).rejects.toMatchObject({ code: 'forbidden' });
  clock.advance(250);
  await result;
  expect(gateway.getSnapshot()).toBe(before);
});
