import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { fleetSnapshotStorageKey } from '../storage/PersistentStorageAdapter';
afterEach(() => {
  cleanup();
  localStorage.removeItem(fleetSnapshotStorageKey);
});
