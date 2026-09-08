import { useState } from 'react';
import type { Command } from '../domain/model';
import { commandPermission } from '../domain/permissions';
import { useFleet, useDomain } from '../app/FleetProvider';
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
  const confirmed = useDomain();
  const denied = commandPermission(confirmed, actor, command);
  const allowed = !denied;
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
      <button
        className={command.type === 'robot.stop' ? 'emergency-stop' : undefined}
        disabled={!allowed || state === 'pending'}
        onClick={run}
      >
        {state === 'pending' ? 'Applying…' : children}
      </button>
      {!allowed && <small>{denied}</small>}
      <span role={state === 'failed' ? 'alert' : 'status'}>{message}</span>
    </div>
  );
}
