import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';
it.each(['workspace', 'application'] as const)(
  'contains a failed %s render and offers explicit reload recovery',
  (scope) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    function Broken(): never {
      throw new Error('test render failure');
    }
    render(
      <ErrorBoundary scope={scope}>
        <Broken />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      scope === 'application' ? 'Application unavailable' : 'Workspace unavailable',
    );
    expect(screen.getByRole('button', { name: 'Reload application' })).toBeVisible();
  },
);
it('renders healthy children without an error alert', () => {
  render(
    <ErrorBoundary>
      <p>Healthy workspace</p>
    </ErrorBoundary>,
  );
  expect(screen.getByText('Healthy workspace')).toBeVisible();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
