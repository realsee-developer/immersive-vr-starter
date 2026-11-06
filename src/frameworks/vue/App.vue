<script setup lang="ts">
import { onMounted, onUnmounted, ref, shallowRef } from 'vue';
import { createTour, initialTourState, type Tour } from '../../experience';
const host = ref<HTMLDivElement>();
const state = shallowRef({ ...initialTourState });
let tour: Tour | undefined;
onMounted(() => { if (host.value) tour = createTour(host.value, (next) => { state.value = next; }); });
onUnmounted(() => tour?.dispose());
</script>

<template>
  <main class="tour" aria-label="Immersive VR tour">
    <div ref="host" class="scene" role="region" aria-label="VR scene" :aria-busy="state.phase === 'loading'" tabindex="0" aria-keyshortcuts="F" />
    <div class="tour-shade" aria-hidden="true" />
    <header class="tour-heading">
      <div><span class="tour-eyebrow">{{ state.source === 'demo' ? 'Public tour' : 'Your Team' }}</span><h1>{{ state.title }}</h1><p>Look around. Find your next perspective.</p></div>
      <button class="glass-button" :aria-expanded="state.catalogOpen" @click="tour?.showScenes()">Spaces <span aria-hidden="true">▦</span></button>
    </header>
    <div v-if="state.phase !== 'ready'" class="scene-loading" role="status"><span class="loading-mark" aria-hidden="true">◌</span><p>{{ state.message }}</p><button v-if="state.phase === 'error'" class="glass-button" @click="tour?.retry()">Try again</button></div>
    <div v-if="state.notice" class="tour-notice" role="alert"><span>{{ state.notice }}</span><button aria-label="Dismiss message" @click="tour?.dismissNotice()">×</button></div>
    <footer class="tour-footer">
      <a class="tour-brand" href="https://developer.realsee.ai" target="_blank" rel="noreferrer">realsee<span>Spatial tour</span></a>
      <div class="tour-controls" role="group" aria-label="Tour controls">
        <button :disabled="state.phase !== 'ready'" :aria-label="state.mode === 'Panorama' ? 'Switch to Floorplan' : 'Switch to Panorama'" @click="tour?.changeMode()"><span aria-hidden="true">{{ state.mode === 'Panorama' ? '◇' : '◎' }}</span>{{ state.mode === 'Panorama' ? 'Floorplan' : 'Panorama' }}</button>
      </div>
      <button class="glass-button fullscreen-button" aria-label="Toggle fullscreen" @click="tour?.toggleFullscreen()"><span aria-hidden="true">⛶</span></button>
    </footer>
    <span class="sr-only" role="status" aria-live="polite">{{ state.phase === 'ready' ? `Ready. ${state.mode} view.` : '' }}</span>
    <section v-if="state.catalogOpen" class="space-menu" aria-label="Spaces">
      <div class="space-menu-heading"><h2>Choose a space</h2><button aria-label="Close spaces" @click="tour?.closeScenes()">×</button></div>
      <button class="space-option" @click="tour?.openDemo()"><span>The Apartment</span><small>Public tour</small></button>
      <template v-if="state.teamConfigured">
        <div class="space-list-heading"><h3>Your Team</h3><button :disabled="state.directoryBusy" @click="tour?.loadDirectory(state.directory?.page || 1)">Refresh</button></div>
        <p v-if="state.directoryBusy" role="status">Loading your spaces…</p><p v-if="state.directoryError" role="alert">{{ state.directoryError }}</p>
        <template v-if="!state.directoryBusy && !state.directoryError">
          <button v-for="vr in state.directory?.list" :key="vr.resourceCode" class="space-option" @click="tour?.selectScene(vr)">{{ vr.name }}</button>
          <p v-if="state.directory?.list.length === 0">No spaces on this page. {{ state.hasPreviousPage ? 'Return to the previous page or refresh the list.' : 'Your Team directory is empty.' }}</p>
        </template>
        <div v-if="state.directory" class="space-pagination"><button :disabled="!state.hasPreviousPage || state.directoryBusy" @click="tour?.loadDirectory(state.directory!.page - 1)">Previous</button><span>Page {{ state.directory.page }} · {{ state.directory.list.length }} loaded</span><button :disabled="!state.hasNextPage || state.directoryBusy" @click="tour?.loadDirectory(state.directory!.page + 1)">Next</button></div>
      </template>
      <p v-else class="space-menu-note">This project opens a real public space without an account. To use your Team’s spaces, follow the configuration steps in the project README.</p>
      <a class="example-link" href="https://developer.realsee.ai/docs/five-sdk" target="_blank" rel="noreferrer">Read SDK guides ↗</a>
    </section>
  </main>
</template>
