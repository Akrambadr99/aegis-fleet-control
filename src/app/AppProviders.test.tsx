import { render, screen } from '@testing-library/react';
import { useQueryClient } from '@tanstack/react-query';
import { expect, it } from 'vitest';
import { AppProviders, createQueryClient } from './AppProviders';
it('isolates server data between application instances', () => {
  const first = createQueryClient();
  const second = createQueryClient();
  first.setQueryData(['robot', 'r1'], { battery: 45 });
  expect(second.getQueryData(['robot', 'r1'])).toBeUndefined();
  first.clear();
  second.clear();
});
it('retains the query cache when its provider rerenders', () => {
  function Probe({ write }: { write: boolean }) {
    const client = useQueryClient();
    if (write) client.setQueryData(['probe'], 'cached');
    return <p>{client.getQueryData<string>(['probe'])}</p>;
  }
  const view = render(
    <AppProviders>
      <Probe write />
    </AppProviders>,
  );
  view.rerender(
    <AppProviders>
      <Probe write={false} />
    </AppProviders>,
  );
  expect(screen.getByText('cached')).toBeVisible();
});
