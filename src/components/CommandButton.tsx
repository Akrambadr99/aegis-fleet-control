import { useState } from 'react';
import type { Command } from '../domain/model';
import { canExecute } from '../domain/selectors';
import { useFleet } from '../app/FleetProvider';
export function CommandButton({
  command,
  children,
}: {
  command: Command;
  children: React.ReactNode;
}) {
  const { gateway, actor } = useFleet();
  const [state, setState] = useState<'idle' | 'pending' | 'confirmed' | 'failed'>('idle');
  const [message, setMessage] = useState('');
  const allowed = canExecute(actor.role, command.type);
  async function run() {
    setState('pending');
    setMessage('');
    try {
      await gateway.command(actor, command).promise;
      setState('confirmed');
      setMessage('Applied');
    } catch (error) {
      setState('failed');
      setMessage(error instanceof Error ? error.message : 'Command failed');
    }
  }
  return (
    <div className="command-action">
      <button disabled={!allowed || state === 'pending'} onClick={run}>
        {state === 'pending' ? 'Applying…' : children}
      </button>
      {!allowed && <small>Role cannot execute</small>}
      <span role={state === 'failed' ? 'alert' : 'status'}>{message}</span>
    </div>
  );
}
