import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useState,
  type Dispatch,
  type PropsWithChildren,
} from 'react';
import { newPlan } from '../../domain/planning';
import { useFleet } from '../../app/FleetProvider';
import { draftReducer, initialHistory, type DraftHistory, type DraftAction } from './draftHistory';
const DraftContext = createContext<{
  history: DraftHistory;
  dispatch: Dispatch<DraftAction>;
  saving: boolean;
  message: string;
  save: () => Promise<void>;
} | null>(null);
export function MissionDraftProvider({ children }: PropsWithChildren) {
  const { gateway, actor } = useFleet();
  const [saving, setSaving] = useState(false),
    [message, setMessage] = useState('');
  const inFlight = useRef(false);
  const [history, dispatch] = useReducer(draftReducer, undefined, () =>
    initialHistory(newPlan('PLAN-' + crypto.randomUUID(), 'FAC-001', 'R-001')),
  );
  function edit(action: DraftAction) {
    if (inFlight.current) return;
    setMessage('');
    dispatch(action);
  }
  async function save() {
    if (inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setMessage('');
    const plan = history.present;
    const expectedRevision = history.baseline.revision;
    try {
      await gateway.command(actor, { type: 'plan.save', id: plan.id, expectedRevision, plan })
        .promise;
      const saved =
        gateway.getSnapshot().planRevisions[JSON.stringify([plan.id, expectedRevision + 1])].plan;
      dispatch({ type: 'reset', plan: saved });
      setMessage('Mission plan saved');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Save failed');
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }
  const dirty = JSON.stringify(history.present) !== JSON.stringify(history.baseline);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  return (
    <DraftContext.Provider value={{ history, dispatch: edit, saving, message, save }}>
      {children}
    </DraftContext.Provider>
  );
}
export function useMissionDraft() {
  const context = useContext(DraftContext);
  if (!context) throw new Error('Mission draft provider required');
  return context;
}
