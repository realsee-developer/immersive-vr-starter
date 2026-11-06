import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
import type { Five as FiveInstance, ModeChangeEvent, PanoTextureEvent } from "@realsee/five";
import { watchView } from "../src/recipes/changeView.ts";
import { watchLoading, type LoadingFeedback } from "../src/recipes/loadingFeedback.ts";
import { saveView } from "../src/recipes/savedViews.ts";
import { listDestinations } from "../src/recipes/navigateScene.ts";

// The CommonJS entry supports headless contract checks. The app still imports
// the browser ESM entry through Vite; these tests do not create a WebGL context.
const require = createRequire(import.meta.url);
const { Five, parseWork } = require("@realsee/five");
const sdkRequire = createRequire(require.resolve("@realsee/five"));
const publicWork = require(
  "../src/real-demo-work.json"
);

test("the pinned SDK parses the bundled public Work and exports the task APIs", () => {
  assert.equal(Five.version, "6.9.2");
  assert.equal(sdkRequire("protobufjs/package.json").version, "8.8.1");
  const work = parseWork(publicWork);
  assert.ok(work.observers.length > 0);
  assert.equal(typeof work.model.file, "string");
  assert.ok(work.observers.every((observer: { position: { isVector3: boolean } }) => observer.position.isVector3));
  for (const name of [
    "appendTo", "refresh", "dispose", "load", "changeMode", "updateCamera",
    "moveToPano", "getCurrentState", "setState", "project2d", "getPixels",
  ]) assert.equal(typeof Five.prototype[name], "function", name);
});

test("navigation includes the public Work's active observers even when loadable is false", () => {
  const work = parseWork(publicWork);
  const five: FiveInstance = new Five();
  try {
    // Exercise the real SDK observers getter with real parsed Work; no renderer/network needed.
    Object.defineProperty(five, "work", { value: work });
    assert.equal(five.observers.filter((observer) => observer.active && observer.loadable).length, 0);
    const destinations = listDestinations(five);
    assert.equal(destinations.length, work.observers.length);
    assert.ok(destinations.length > 1);
    assert.ok(destinations.every((pano) => pano.workCode === work.workCode));
    assert.deepEqual(destinations.map((pano) => pano.panoIndex), work.observers.map((observer: { panoIndex: number }) => observer.panoIndex));
  } finally {
    five.dispose();
  }
});

test("navigation accepts explicit loadability and excludes observers with neither flag", () => {
  const raw = structuredClone(publicWork);
  raw.panorama.list.forEach((pano: { active: boolean; loadable: boolean }, index: number) => {
    pano.active = index === 0;
    pano.loadable = index === 1;
  });
  const work = parseWork(raw);
  const five: FiveInstance = new Five();
  try {
    Object.defineProperty(five, "work", { value: work });
    assert.deepEqual(listDestinations(five).map((pano) => pano.panoIndex), [0, 1]);
  } finally {
    five.dispose();
  }
});

test("modern mode events update UI state and their disposer removes the listener", () => {
  const five: FiveInstance = new Five();
  try {
    const seen: string[] = [];
    const stop = watchView(five, (mode) => seen.push(mode));
    const event = { mode: "Floorplan", prevMode: "Panorama", state: five.getCurrentState(), userAction: true } as ModeChangeEvent;
    five.emit("mode.change", event);
    assert.deepEqual(seen, ["Panorama", "Floorplan"]);
    stop();
    five.emit("mode.change", { ...event, mode: "Topview" });
    assert.deepEqual(seen, ["Panorama", "Floorplan"]);
  } finally {
    five.dispose();
  }
});

test("asset feedback stays distinct from app/API success and cleans up all subscriptions", () => {
  const five: FiveInstance = new Five();
  try {
    const seen: LoadingFeedback[] = [];
    const stop = watchLoading(five, (value) => seen.push(value));
    const event = { pano: five.pano, progress: 0.5, error: null, meta: null } as PanoTextureEvent;
    five.emit("pano.texture.progress", event);
    five.emit("pano.texture.error", event);
    assert.deepEqual(seen, [
      { stage: "panorama", state: "loading", progress: 0.5 },
      { stage: "panorama", state: "error" },
    ]);
    stop();
    five.emit("pano.texture.progress", event);
    five.emit("pano.texture.error", event);
    assert.equal(seen.length, 2);
  } finally {
    five.dispose();
  }
});

test("saved views are JSON data and do not retain a live Three.js vector", () => {
  const five: FiveInstance = new Five();
  try {
    const snapshot = saveView(five);
    assert.deepEqual(JSON.parse(JSON.stringify(snapshot)), snapshot);
    const before = [...snapshot.offset];
    five.camera.pose.offset.set(1, 2, 3);
    assert.deepEqual(snapshot.offset, before);
    assert.equal(snapshot.mode, "Panorama");
  } finally {
    five.dispose();
  }
});
