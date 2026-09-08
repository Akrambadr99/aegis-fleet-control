import { useState } from 'react';
import type { Command } from '../domain/model';
import { useFleet } from '../app/FleetProvider';
export function useCommand() {
  const { gateway, actor } = useFleet();
  const [pending, setPending] = useState(false),
    [message, setMessage] = useState('');
  async function run(command: Command) {
    setPending(true);
    setMessage('');
    try {
      await gateway.command(actor, command).promise;
      setMessage(command.id + ': command confirmed');
      return true;
    } catch (error) {
      setMessage(command.id + ': ' + (error instanceof Error ? error.message : 'Command failed'));
      return false;
    } finally {
      setPending(false);
    }
  }
  return { run, pending, message };
}
