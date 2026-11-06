import { createTour, initialTourState, type TourState, type Tour } from '../../experience';
import '../../styles.css';
const root = document.getElementById('root');
if (!root) throw new Error('The root element is missing');
root.innerHTML = `<main class="tour" aria-label="Immersive VR tour">
  <div class="scene" role="region" aria-label="VR scene" tabindex="0" aria-keyshortcuts="F"></div><div class="tour-shade" aria-hidden="true"></div>
  <header class="tour-heading"><a class="tour-brand" href="https://developer.realsee.ai" target="_blank" rel="noreferrer">realsee<span>Spatial tour</span></a><button class="glass-button" data-action="spaces">Spaces <span aria-hidden="true">▦</span></button></header>
  <div class="scene-loading" role="status" data-loading><span class="loading-mark" aria-hidden="true">◌</span><p data-message></p><button class="glass-button" data-action="retry" hidden>Try again</button></div>
  <div class="tour-notice" role="alert" data-notice hidden><span></span><button aria-label="Dismiss message" data-action="dismiss">×</button></div>
  <footer class="tour-footer"><div class="tour-caption"><span class="tour-eyebrow" data-source></span><h1 data-title></h1><p>Drag or swipe to look around.</p></div><div class="tour-controls" role="group" aria-label="Tour controls"><button data-action="mode"></button></div><button class="glass-button fullscreen-button" aria-label="Toggle fullscreen" data-action="fullscreen"><span aria-hidden="true">⛶</span></button></footer>
  <span class="sr-only" role="status" aria-live="polite" data-status></span><section class="space-menu" aria-label="Spaces" data-catalog hidden></section>
</main>`;
const get = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
let tour: Tour;
let latest: TourState = initialTourState;
function text(selector: string, value: string) { get(selector).textContent = value; }
function button(label: string, action: () => void, className = '', disabled = false) {
  const element = document.createElement('button');
  element.type = 'button'; element.textContent = label; element.className = className; element.disabled = disabled;
  element.addEventListener('click', action); return element;
}
function update(state: TourState) {
  latest = state;
  text('[data-title]', state.title); text('[data-source]', state.source === 'demo' ? 'Public tour' : 'Your Team');
  get('.scene').setAttribute('aria-busy', String(state.phase === 'loading'));
  get('[data-loading]').hidden = state.phase === 'ready'; text('[data-message]', state.message);
  get('[data-action="retry"]').hidden = state.phase !== 'error';
  const mode = get<HTMLButtonElement>('[data-action="mode"]'); const modeIcon = document.createElement('span'); modeIcon.setAttribute('aria-hidden', 'true'); modeIcon.textContent = state.mode === 'Panorama' ? '◇' : '◎'; mode.replaceChildren(modeIcon, document.createTextNode(state.mode === 'Panorama' ? 'Floorplan' : 'Panorama')); mode.setAttribute('aria-label', state.mode === 'Panorama' ? 'Switch to Floorplan' : 'Switch to Panorama'); mode.disabled = state.phase !== 'ready';
  get('[data-notice]').hidden = !state.notice; text('[data-notice] span', state.notice);
  text('[data-status]', state.phase === 'ready' ? `Ready. ${state.mode} view.` : '');
  get('[data-action="spaces"]').setAttribute('aria-expanded', String(state.catalogOpen));
  const catalog = get('[data-catalog]'); catalog.hidden = !state.catalogOpen;
  if (!state.catalogOpen) return;
  catalog.replaceChildren();
  const heading = document.createElement('div'); heading.className = 'space-menu-heading';
  const title = document.createElement('h2'); title.textContent = 'Choose a space';
  const close = button('×', () => tour.closeScenes()); close.setAttribute('aria-label', 'Close spaces'); heading.append(title, close); catalog.append(heading);
  catalog.append(button('The Apartment · Public tour', () => tour.openDemo(), 'space-option'));
  const paragraph = (value: string, role?: string) => { const p = document.createElement('p'); p.textContent = value; if (role) p.setAttribute('role', role); catalog.append(p); };
  if (state.teamConfigured) {
    const teamHeading = document.createElement('div'); teamHeading.className = 'space-list-heading';
    const h3 = document.createElement('h3'); h3.textContent = 'Your Team';
    teamHeading.append(h3, button('Refresh', () => void tour.loadDirectory(state.directory?.page || 1), '', state.directoryBusy)); catalog.append(teamHeading);
    if (state.directoryBusy) paragraph('Loading your spaces…', 'status');
    else if (state.directoryError) paragraph(state.directoryError, 'alert');
    else if (state.directory) {
      for (const vr of state.directory.list) catalog.append(button(vr.name, () => tour.selectScene(vr), 'space-option'));
      if (!state.directory.list.length) paragraph(`No spaces on this page. ${state.hasPreviousPage ? 'Return to the previous page or refresh the list.' : 'Your Team directory is empty.'}`);
    }
    if (state.directory) {
      const pager = document.createElement('div'); pager.className = 'space-pagination';
      const page = document.createElement('span'); page.textContent = `Page ${state.directory.page} · ${state.directory.list.length} loaded`;
      pager.append(button('Previous', () => void tour.loadDirectory(state.directory!.page - 1), '', !state.hasPreviousPage || state.directoryBusy), page, button('Next', () => void tour.loadDirectory(state.directory!.page + 1), '', !state.hasNextPage || state.directoryBusy)); catalog.append(pager);
    }
  } else paragraph('This project opens a real public space without an account. To use your Team’s spaces, follow the configuration steps in the project README.');
  const docs = document.createElement('a'); docs.className = 'example-link'; docs.textContent = 'Read SDK guides ↗'; docs.href = 'https://developer.realsee.ai/docs/five-sdk'; docs.target = '_blank'; docs.rel = 'noreferrer'; catalog.append(docs);
}
const actions: Record<string, () => void> = {
  spaces: () => void tour.showScenes(), retry: () => tour.retry(), dismiss: () => tour.dismissNotice(),
  mode: () => void tour.changeMode(), fullscreen: () => void tour.toggleFullscreen(),
};
root.addEventListener('click', (event) => { const action = (event.target as HTMLElement).closest<HTMLElement>('[data-action]')?.dataset.action; if (action && actions[action]) actions[action](); });
tour = createTour(get('.scene'), update);
update(latest);
window.addEventListener('pagehide', () => tour.dispose(), { once: true });
