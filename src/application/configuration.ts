import type { Command } from '../domain/model';
import { DomainError } from '../domain/errors';
export interface OperationalConfiguration {
  automaticScheduling: boolean;
  advancedRouting: boolean;
  automatedRecovery: boolean;
}
export const defaultConfiguration: Readonly<OperationalConfiguration> = Object.freeze({
  automaticScheduling: true,
  advancedRouting: true,
  automatedRecovery: true,
});
export function assertCapabilityEnabled(
  command: Command,
  config: Readonly<OperationalConfiguration>,
) {
  const capability =
    command.type === 'job.assign'
      ? 'automaticScheduling'
      : command.type === 'robot.reroute'
        ? 'advancedRouting'
        : undefined;
  if (capability && !config[capability])
    throw new DomainError('forbidden', 'Operational capability disabled: ' + capability);
}
