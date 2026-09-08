import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './app/App';
import { AppProviders } from './app/AppProviders';
import { ErrorBoundary } from './components/ErrorBoundary';
import './app/styles.css';
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary scope="application">
      <AppProviders>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AppProviders>
    </ErrorBoundary>
  </StrictMode>,
);
