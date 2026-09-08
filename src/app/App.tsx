import { GlobalSearch } from '../components/GlobalSearch';
import { TrafficWorkspace } from '../features/traffic';
import { TeleoperationWorkspace } from '../features/teleoperation';
import { ResourcesWorkspace } from '../features/resources';
import { MissionPlanning } from '../features/missions';
import { lazy, Suspense, useLayoutEffect } from 'react';
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Overview } from '../features/overview';
import { OperationsWorkspace, connectedPaths } from '../features/operations';
import { workspaces, type Workspace } from '../routing/workspaces';
const AutomationWorkspace = lazy(() =>
  import('../features/automation').then((module) => ({
    default: module.AutomationWorkspace,
  })),
);
const ReplayWorkspace = lazy(() =>
  import('../features/replay').then((module) => ({
    default: module.ReplayWorkspace,
  })),
);
const SchedulerWorkspace = lazy(() =>
  import('../features/scheduler').then((module) => ({
    default: module.SchedulerWorkspace,
  })),
);
const DiagnosticsWorkspace = import.meta.env.DEV
  ? lazy(() =>
      import('../features/diagnostics').then((module) => ({
        default: module.DiagnosticsWorkspace,
      })),
    )
  : null;
function RouteEffects() {
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    const workspace = workspaces.find((item) => item.path === pathname);
    document.title = `${workspace?.title ?? 'Workspace not found'} | Aegis Fleet Control`;
    document.getElementById('workspace-content')?.focus({ preventScroll: true });
  }, [pathname]);
  return null;
}
function PlannedWorkspace({ workspace }: { workspace: Workspace }) {
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            {workspace.group} / {workspace.short}
          </p>
          <h1>{workspace.title}</h1>
          <p>{workspace.description}</p>
        </div>
        <span className="pill">Planned · M{workspace.milestone}</span>
      </div>
      <section className="empty-state">
        <span className="blueprint-mark" aria-hidden="true">
          {workspace.code}
        </span>
        <h2>Workspace planned</h2>
        <p>
          This domain is part of the product roadmap. Operational controls will arrive with its
          validated implementation milestone.
        </p>
        <Link className="button-link" to="/">
          Return to operations overview
        </Link>
      </section>
    </>
  );
}
function NotFound() {
  return (
    <section className="empty-state">
      <p className="eyebrow">404 / Unknown route</p>
      <h1>Workspace not found</h1>
      <p>This address does not match an Aegis workspace.</p>
      <Link className="button-link" to="/">
        Return to operations overview
      </Link>
    </section>
  );
}
export function App() {
  const location = useLocation();
  return (
    <div className="app-shell">
      <a className="skip-link" href="#workspace-content">
        Skip to workspace
      </a>
      <aside className="sidebar">
        <Link className="brand" to="/" aria-label="Aegis Fleet Control home">
          <span className="brand-mark" aria-hidden="true">
            A
          </span>
          <span>
            AEGIS<small>FLEET CONTROL</small>
          </span>
        </Link>
        <div className="sidebar-caption">ROBOTICS OPERATIONS</div>
        <nav aria-label="Main navigation">
          {['Operate', 'Coordinate', 'Analyze', 'System'].map((group) => (
            <div className="nav-group" key={group}>
              <p>{group}</p>
              {workspaces
                .filter((item) => item.group === group)
                .map((item) => (
                  <NavLink
                    key={item.path}
                    end
                    to={{ pathname: item.path, search: location.search }}
                  >
                    <span className="nav-code" aria-hidden="true">
                      {item.code}
                    </span>
                    {item.short}
                  </NavLink>
                ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="status-dot" /> Local demonstration
          <small>Connected operations · v0.2</small>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <GlobalSearch />
          <span>
            Autonomous systems <span className="separator">/</span> Fleet operations
          </span>
          <span className="environment-label">SIMULATED ENVIRONMENT</span>
        </header>
        <main id="workspace-content" tabIndex={-1}>
          <ErrorBoundary key={location.pathname}>
            <Suspense fallback={<p role="status">Loading workspace…</p>}>
              <Routes>
                <Route path="/" element={<Overview />} />
                {DiagnosticsWorkspace && (
                  <Route path="/diagnostics" element={<DiagnosticsWorkspace />} />
                )}
                {workspaces
                  .filter((item) => item.path !== '/')
                  .map((item) => (
                    <Route
                      key={item.path}
                      path={item.path}
                      element={
                        item.path === '/automation' ? (
                          <AutomationWorkspace />
                        ) : item.path === '/traffic' ? (
                          <TrafficWorkspace />
                        ) : item.path === '/replay' ? (
                          <ReplayWorkspace />
                        ) : item.path === '/teleoperation' ? (
                          <TeleoperationWorkspace />
                        ) : item.path === '/resources' ? (
                          <ResourcesWorkspace />
                        ) : item.path === '/scheduler' ? (
                          <SchedulerWorkspace />
                        ) : item.path === '/missions' ? (
                          <MissionPlanning />
                        ) : connectedPaths.includes(item.path) ? (
                          <OperationsWorkspace workspace={item} />
                        ) : (
                          <PlannedWorkspace workspace={item} />
                        )
                      }
                    />
                  ))}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </main>
        <footer className="page-footer">
          Aegis Fleet Control <span>Shared simulation · No physical robots connected</span>
        </footer>
      </div>
      <RouteEffects />
    </div>
  );
}
