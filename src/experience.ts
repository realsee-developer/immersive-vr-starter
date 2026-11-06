import type { Five as FiveInstance } from '@realsee/five';
import type { StarterConfig, TeamDirectory, TeamVr } from '../shared/contracts';
import { requestApi } from './api';

export interface TourState {
  phase: 'loading' | 'ready' | 'error';
  title: string;
  source: 'demo' | 'team';
  mode: string;
  message: string;
  notice: string;
  teamConfigured: boolean;
  catalogOpen: boolean;
  directory: TeamDirectory | null;
  directoryBusy: boolean;
  directoryError: string;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}
export const initialTourState: TourState = {
  phase: 'loading', title: 'The Apartment', source: 'demo', mode: 'Panorama',
  message: 'Opening your space…', notice: '', teamConfigured: false,
  catalogOpen: false, directory: null, directoryBusy: false, directoryError: '',
  hasNextPage: false, hasPreviousPage: false,
};

type MountedScene = { five: FiveInstance; layer: HTMLDivElement; stop?: () => void };

/** The renderer and authorized data flow are shared. Each framework owns its UI. */
export function createTour(host: HTMLElement, onChange: (state: TourState) => void) {
  let state: TourState = { ...initialTourState };
  let disposed = false;
  let sceneGeneration = 0;
  let directoryGeneration = 0;
  let current: MountedScene | null = null;
  const pending = new Set<MountedScene>();
  const configRequest = new AbortController();
  let directoryRequest: AbortController | null = null;
  let workRequest: AbortController | null = null;
  let modeBusy = false;
  const emit = (patch: Partial<TourState>) => {
    if (disposed) return;
    state = { ...state, ...patch };
    onChange(state);
  };
  const destroy = (scene: MountedScene) => {
    scene.stop?.();
    scene.five.dispose();
    scene.layer.remove();
    pending.delete(scene);
  };
  const resize = new ResizeObserver(([entry]) => {
    const rect = entry?.contentRect;
    if (rect) current?.five.refresh({ width: rect.width, height: rect.height });
  });
  resize.observe(host);

  async function loadScene(vr?: TeamVr) {
    const generation = ++sceneGeneration;
    workRequest?.abort();
    const request = new AbortController();
    workRequest = request;
    emit({ phase: 'loading', message: 'Opening your space…', notice: '' });
    let staging: MountedScene | null = null;
    try {
      const [{ Five, parseWork }, work] = await Promise.all([
        import('@realsee/five'),
        vr
          ? requestApi<{ work: unknown }>('/api/team/work', {
              method: 'POST', body: JSON.stringify({ sceneHandle: vr.sceneHandle }), signal: request.signal,
            }).then((result) => result.work)
          : import('./real-demo-work.json').then((module) => module.default),
      ]);
      if (disposed || generation !== sceneGeneration) return;
      const five = new Five({ imageOptions: { size: 1024 }, poweredByRealsee: false });
      const layer = document.createElement('div');
      layer.className = 'scene-layer';
      layer.style.opacity = '0';
      host.append(layer);
      staging = { five, layer };
      pending.add(staging);
      five.appendTo(layer);
      await five.load(parseWork(work as Parameters<typeof parseWork>[0]), 'initial');
      if (disposed || generation !== sceneGeneration) {
        if (pending.has(staging)) destroy(staging);
        return;
      }
      if (current) destroy(current);
      current = staging;
      pending.delete(staging);
      layer.style.opacity = '1';
      staging.stop = five.on('modeChange', (mode) => {
        if (current?.five === five) emit({ mode });
      });
      five.refresh({ width: host.clientWidth, height: host.clientHeight });
      emit({ phase: 'ready', title: vr?.name || 'The Apartment', source: vr ? 'team' : 'demo', mode: five.state.mode, message: 'Ready' });
    } catch {
      if (staging && pending.has(staging)) destroy(staging);
      if (disposed || generation !== sceneGeneration) return;
      emit({ phase: current ? 'ready' : 'error', message: current ? 'Ready' : 'This space could not load.',
        notice: vr ? 'This Team space could not open. Your current view is unchanged. Refresh the space list and try again.' : 'Check your connection and WebGL support, then try again.' });
    }
  }

  async function loadDirectory(page = 1) {
    const generation = ++directoryGeneration;
    directoryRequest?.abort();
    const request = new AbortController();
    directoryRequest = request;
    emit({ directoryBusy: true, directoryError: '' });
    try {
      const directory = await requestApi<TeamDirectory>(`/api/team/vrs?page=${page}&pageSize=12`, { signal: request.signal });
      if (disposed || generation !== directoryGeneration) return;
      emit({ directory, directoryBusy: false, hasPreviousPage: directory.page > 1,
        hasNextPage: directory.totalPages === null ? directory.list.length === 12 : directory.page < directory.totalPages });
    } catch {
      if (disposed || generation !== directoryGeneration) return;
      emit({ directoryBusy: false, directoryError: 'Your spaces could not be listed. Check the local Team configuration and try again.' });
    }
  }

  async function showScenes() {
    emit({ catalogOpen: true });
    if (state.teamConfigured && !state.directory && !state.directoryBusy) await loadDirectory();
  }
  async function changeMode() {
    if (!current || modeBusy || state.phase !== 'ready') return;
    modeBusy = true;
    const scene = current;
    try {
      await scene.five.changeMode(scene.five.state.mode === 'Panorama' ? 'Floorplan' : 'Panorama');
      if (current === scene) emit({ mode: scene.five.state.mode, notice: '' });
    } catch {
      if (current === scene) emit({ notice: 'A floorplan is not available for this space. You can keep exploring the current view.' });
    } finally { modeBusy = false; }
  }
  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (host.parentElement?.requestFullscreen) await host.parentElement.requestFullscreen();
      else emit({ notice: 'Fullscreen is not available in this browser.' });
    } catch { emit({ notice: 'Fullscreen is not available in this browser.' }); }
  }
  const keyboard = (event: KeyboardEvent) => {
    if (event.key === 'Escape') { emit({ catalogOpen: false }); return; }
    if (event.ctrlKey || event.metaKey || event.altKey || /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/u.test((event.target as HTMLElement).tagName)) return;
    if (event.key.toLowerCase() === 'f') void toggleFullscreen();
  };
  document.addEventListener('keydown', keyboard);
  void loadScene();
  void requestApi<StarterConfig>('/api/config', { signal: configRequest.signal }).then((config) => {
    emit({ teamConfigured: config.teamConfigured });
    // Even an explicitly configured Team starts on the public tour. Opening
    // its space list is an intentional action, without inheriting portal state.
  }).catch(() => { /* A static public tour remains usable without the local backend. */ });

  return {
    showScenes, loadDirectory, changeMode, toggleFullscreen,
    closeScenes: () => emit({ catalogOpen: false }),
    openDemo: () => { emit({ catalogOpen: false }); void loadScene(); },
    selectScene: (vr: TeamVr) => { emit({ catalogOpen: false }); void loadScene(vr); },
    dismissNotice: () => emit({ notice: '' }),
    retry: () => { if (!current) void loadScene(); },
    dispose() {
      disposed = true;
      ++sceneGeneration;
      ++directoryGeneration;
      configRequest.abort(); directoryRequest?.abort(); workRequest?.abort();
      resize.disconnect(); document.removeEventListener('keydown', keyboard);
      if (current) destroy(current);
      for (const scene of [...pending]) destroy(scene);
      current = null;
    },
  };
}
export type Tour = ReturnType<typeof createTour>;
