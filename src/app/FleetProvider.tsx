import {
  createContext,
  useContext,
  useState,
  useSyncExternalStore,
  type PropsWithChildren,
} from 'react';
import { FleetGateway } from '../gateway/FleetGateway';
import type { Actor, Role } from '../domain/model';
const FleetContext = createContext<{
  gateway: FleetGateway;
  actor: Actor;
  setRole: (role: Role) => void;
} | null>(null);
export function FleetProvider({
  children,
  gateway: provided,
}: { gateway?: FleetGateway } & PropsWithChildren) {
  const [gateway] = useState(() => provided ?? new FleetGateway());
  const [role, setRole] = useState<Role>('administrator');
  return (
    <FleetContext.Provider value={{ gateway, actor: { id: 'local-operator', role }, setRole }}>
      {children}
    </FleetContext.Provider>
  );
}
export function useFleet() {
  const value = useContext(FleetContext);
  if (!value) throw new Error('FleetProvider required');
  return value;
}
export function useDomain() {
  const { gateway } = useFleet();
  return useSyncExternalStore(gateway.subscribe, gateway.getSnapshot, gateway.getSnapshot);
}
