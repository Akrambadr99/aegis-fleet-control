import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppProviders } from '../app/AppProviders';
import { App } from '../app/App';
export function renderApp(route = '/') {
  return render(
    <AppProviders>
      <MemoryRouter initialEntries={[route]}>
        <App />
      </MemoryRouter>
    </AppProviders>,
  );
}
