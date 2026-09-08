import { MissionDraftProvider } from '../features/missions';
import { useState, type PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FleetProvider } from './FleetProvider';
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
  return (
    <QueryClientProvider client={client}>
      <FleetProvider>
        <MissionDraftProvider>{children}</MissionDraftProvider>
      </FleetProvider>
    </QueryClientProvider>
  );
}
