import { Component, type ErrorInfo, type PropsWithChildren } from 'react';
export class ErrorBoundary extends Component<PropsWithChildren, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Workspace render failed', error, info.componentStack);
  }
  render() {
    if (this.state.failed)
      return (
        <section className="empty-state" role="alert">
          <h1>Workspace unavailable</h1>
          <p>The interface could not render. Reload to restore the local demonstration.</p>
          <button onClick={() => window.location.reload()}>Reload application</button>
        </section>
      );
    return this.props.children;
  }
}
