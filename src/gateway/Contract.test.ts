import { FleetGateway } from './FleetGateway';
import { ManualScheduler } from './scheduler';
import { fleetContract } from './testing/fleetContract';
for (const restore of [false, true])
  fleetContract(restore ? 'restored gateway' : 'fresh gateway', () => {
    const clock = new ManualScheduler();
    const seed = new FleetGateway(clock);
    const gateway = restore ? FleetGateway.fromSnapshot(seed.exportSnapshot(), clock) : seed;
    return { gateway, settle: () => clock.advance(250) };
  });
