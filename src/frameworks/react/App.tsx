import { useEffect, useRef, useState } from 'react';
import { createTour, initialTourState, type Tour } from '../../experience';

export function App() {
  const host = useRef<HTMLDivElement>(null);
  const tour = useRef<Tour | null>(null);
  const [state, setState] = useState(initialTourState);
  useEffect(() => {
    if (!host.current) return;
    const instance = createTour(host.current, setState);
    tour.current = instance;
    return () => { instance.dispose(); tour.current = null; };
  }, []);
  return (
    <main className="tour" aria-label="Immersive VR tour">
      <div ref={host} className="scene" role="region" aria-label="VR scene" aria-busy={state.phase === 'loading'} tabIndex={0} aria-keyshortcuts="F" />
      <div className="tour-shade" aria-hidden="true" />
      <header className="tour-heading">
        <div><span className="tour-eyebrow">{state.source === 'demo' ? 'Public tour' : 'Your Team'}</span><h1>{state.title}</h1><p>Look around. Find your next perspective.</p></div>
        <button className="glass-button" onClick={() => void tour.current?.showScenes()} aria-expanded={state.catalogOpen}>Spaces <span aria-hidden="true">▦</span></button>
      </header>
      {state.phase !== 'ready' && <div className="scene-loading" role="status"><span className="loading-mark" aria-hidden="true">◌</span><p>{state.message}</p>{state.phase === 'error' && <button className="glass-button" onClick={() => tour.current?.retry()}>Try again</button>}</div>}
      {state.notice && <div className="tour-notice" role="alert"><span>{state.notice}</span><button aria-label="Dismiss message" onClick={() => tour.current?.dismissNotice()}>×</button></div>}
      <footer className="tour-footer">
        <a className="tour-brand" href="https://developer.realsee.ai" target="_blank" rel="noreferrer">realsee<span>Spatial tour</span></a>
        <div className="tour-controls" role="group" aria-label="Tour controls">
          <button onClick={() => void tour.current?.changeMode()} disabled={state.phase !== 'ready'} aria-label={state.mode === 'Panorama' ? 'Switch to Floorplan' : 'Switch to Panorama'}><span aria-hidden="true">{state.mode === 'Panorama' ? '◇' : '◎'}</span>{state.mode === 'Panorama' ? 'Floorplan' : 'Panorama'}</button>
        </div>
        <button className="glass-button fullscreen-button" onClick={() => void tour.current?.toggleFullscreen()} aria-label="Toggle fullscreen"><span aria-hidden="true">⛶</span></button>
      </footer>
      <span className="sr-only" role="status" aria-live="polite">{state.phase === 'ready' ? `Ready. ${state.mode} view.` : ''}</span>
      {state.catalogOpen && <section className="space-menu" aria-label="Spaces">
        <div className="space-menu-heading"><h2>Choose a space</h2><button onClick={() => tour.current?.closeScenes()} aria-label="Close spaces">×</button></div>
        <button className="space-option" onClick={() => tour.current?.openDemo()}><span>The Apartment</span><small>Public tour</small></button>
        {state.teamConfigured ? <>
          <div className="space-list-heading"><h3>Your Team</h3><button onClick={() => void tour.current?.loadDirectory(state.directory?.page || 1)} disabled={state.directoryBusy}>Refresh</button></div>
          {state.directoryBusy && <p role="status">Loading your spaces…</p>}
          {state.directoryError && <p role="alert">{state.directoryError}</p>}
          {!state.directoryBusy && !state.directoryError && state.directory?.list.map((vr) => <button key={vr.resourceCode} className="space-option" onClick={() => tour.current?.selectScene(vr)}>{vr.name}</button>)}
          {!state.directoryBusy && !state.directoryError && state.directory?.list.length === 0 && <p>No spaces on this page. {state.hasPreviousPage ? 'Return to the previous page or refresh the list.' : 'Your Team directory is empty.'}</p>}
          {state.directory && <div className="space-pagination"><button disabled={!state.hasPreviousPage || state.directoryBusy} onClick={() => void tour.current?.loadDirectory(state.directory!.page - 1)}>Previous</button><span>Page {state.directory.page} · {state.directory.list.length} loaded</span><button disabled={!state.hasNextPage || state.directoryBusy} onClick={() => void tour.current?.loadDirectory(state.directory!.page + 1)}>Next</button></div>}
        </> : <p className="space-menu-note">This project opens a real public space without an account. To use your Team’s spaces, follow the configuration steps in the project README.</p>}
        <a className="example-link" href="?sdk-examples=1">Open SDK examples ↗</a>
      </section>}
    </main>
  );
}
