import { useOperation } from '../hooks/useOperation';
import { recoveryFor } from '../domain/errors';
import { useState } from 'react';
import type { Command } from '../domain/model';
import { commandPermission } from '../domain/permissions';
import { useFleet, useDomainSelector } from '../app/FleetProvider';
export function CommandButton({
  command,
  children,
}: {
  command: Command;
  children: React.ReactNode;
}) {
  const { gateway, actor } = useFleet();
  const { pending } = useOperation(command.id, command.type);
  const [state, setState] = useState<'idle' | 'pending' | 'confirmed' | 'failed'>('idle');
  const [message, setMessage] = useState('');
  const denied = useDomainSelector((state) => commandPermission(state, actor, command));
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
      setMessage(
        (error instanceof Error ? error.message : 'Command failed') +
          recoveryMessage[recoveryFor(error)],
      );
    }
  }
  return (
    <div className="command-action">
      <button
        className={command.type === 'robot.stop' ? 'emergency-stop' : undefined}
        disabled={!allowed || pending}
        onClick={run}
      >
        {pending ? 'Applying…' : children}
      </button>
      {!allowed && <small>{denied}</small>}
      <span role={state === 'failed' ? 'alert' : 'status'}>{message}</span>
    </div>
  );
}

const recoveryMessage = {
  refresh: ' Review the latest state before trying again.',
  'request-access': ' Ask an authorized operator to perform this action.',
  reacquire: ' Acquire control again before continuing.',
  'choose-alternative': ' Choose an available resource or reservation.',
  edit: ' Correct the inputs before trying again.',
  retry: ' Try again when the operation is available.',
  none: '',
};
