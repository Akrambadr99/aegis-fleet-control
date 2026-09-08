import { MissionDraftProvider } from '../features/missions';
import { useState, type PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FleetProvider } from './FleetProvider';
import { FleetGateway } from '../gateway/FleetGateway';
import { createSeed } from '../domain/seed';
import { PersistentStorageAdapter } from '../storage/PersistentStorageAdapter';
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 10_000, retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
}
export function AppProviders({ children }: PropsWithChildren) {
  const [client] = useState(createQueryClient);
  const [gateway] = useState(
    () => new FleetGateway(undefined, new PersistentStorageAdapter(localStorage, createSeed())),
  );
  return (
    <QueryClientProvider client={client}>
      <FleetProvider gateway={gateway}>
        <MissionDraftProvider>{children}</MissionDraftProvider>
      </FleetProvider>
    </QueryClientProvider>
  );
}
