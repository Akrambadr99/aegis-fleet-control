import { useState } from 'react';
import type { RuleInput } from '../../domain/automation';
import { useDomain, useFleet } from '../../app/FleetProvider';
export function RuleTester({ input }: { input: RuleInput }) {
  const state = useDomain(),
    { gateway } = useFleet();
  const [eventId, setEventId] = useState(''),
    [pending, setPending] = useState(false),
    [result, setResult] = useState<{
      key: string;
      message: string;
      targets: { robotId: string; matched: boolean; reason: string }[];
    } | null>(null);
  const events = state.activity
      .filter((e) => e.type === input.trigger)
      .slice(-40)
      .reverse(),
    key = JSON.stringify(input) + eventId + state.revision;
  async function test() {
    setPending(true);
    try {
      const value = await gateway.validateAutomation(input, eventId).promise;
      setResult({
        key,
        message: value.issues.join('; ') || 'Evaluation complete · No actions executed',
        targets: value.targets,
      });
    } catch (error) {
      setResult({
        key,
        message: error instanceof Error ? error.message : 'Evaluation failed',
        targets: [],
      });
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="rule-tester">
      <h2>Test against recorded event</h2>
      <label>
        Recorded event
        <select value={eventId} onChange={(e) => setEventId(e.target.value)}>
          <option value="">Choose a matching event</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              Tick {e.tick} · {e.entityId} · {e.type}
            </option>
          ))}
        </select>
      </label>
      <button disabled={pending || !events.some((e) => e.id === eventId)} onClick={test}>
        {pending ? 'Evaluating…' : 'Test current rule'}
      </button>
      {!events.length && <p>No matching events are recorded in this session.</p>}
      {result?.key === key && (
        <div role="status">
          <p>{result.message}</p>
          <ul>
            {result.targets.map((t) => (
              <li key={t.robotId}>
                {t.robotId} · {t.matched ? 'Would execute' : 'Would skip'} · {t.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
