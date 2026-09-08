import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  type Dispatch,
  type PropsWithChildren,
} from 'react';
import { newPlan } from '../../domain/planning';
import { draftReducer, initialHistory, type DraftHistory, type DraftAction } from './draftHistory';
const DraftContext = createContext<{
  history: DraftHistory;
  dispatch: Dispatch<DraftAction>;
} | null>(null);
export function MissionDraftProvider({ children }: PropsWithChildren) {
  const [history, dispatch] = useReducer(draftReducer, undefined, () =>
    initialHistory(newPlan('PLAN-' + crypto.randomUUID(), 'FAC-001', 'R-001')),
  );
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
  return <DraftContext.Provider value={{ history, dispatch }}>{children}</DraftContext.Provider>;
}
export function useMissionDraft() {
  const context = useContext(DraftContext);
  if (!context) throw new Error('Mission draft provider required');
  return context;
}
