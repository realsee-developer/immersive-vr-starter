import "./lab-base.css";
import { useEffect, useRef, useState } from "react";
import type { Five, Mode } from "@realsee/five";
import type { Vector3 } from "three";
import { mountScene, type MountedScene } from "./mountScene";
import { changeView, watchView, type SceneView } from "./changeView";
import { listDestinations, goToDestination, lookAt } from "./navigateScene";
import { saveView, restoreView, type SavedView } from "./savedViews";
import { watchLoading, type LoadingFeedback } from "./loadingFeedback";
import { watchPickedPoint } from "./pickPoint";
import { placeLabel } from "./placeLabel";
import { captureImage } from "./captureImage";
import "./recipes.css";

export default function CapabilityLab() {
  const host = useRef<HTMLDivElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const mounted = useRef<MountedScene | null>(null);
  const initial = useRef<SavedView | null>(null);
  const stopPicking = useRef<(() => void) | null>(null);
  const labels = useRef<Array<() => void>>([]);
  const imageUrl = useRef("");
  const [reload, setReload] = useState(0);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("Loading the public sample…");
  const [mode, setMode] = useState<Mode>("Panorama");
  const [feedback, setFeedback] = useState<LoadingFeedback | null>(null);
  const [snapshot, setSnapshot] = useState<SavedView | null>(null);
  const [picking, setPicking] = useState(false);
  const [point, setPoint] = useState<Vector3 | null>(null);
  const [download, setDownload] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    let scene: MountedScene | null = null;
    let stops: Array<() => void> = [];
    setReady(false);
    setError("");
    setMessage("Loading the public sample…");
    async function start() {
      try {
        const work = await import(
          "@realsee/open-works/virtual/816lPVZQkQDF5XOpPo/work.json"
        );
        controller.signal.throwIfAborted();
        scene = await mountScene(host.current!, work.default, controller.signal);
        mounted.current = scene;
        initial.current = saveView(scene.five);
        stops = [
          watchView(scene.five, setMode),
          // Initial load has completed; monitor the next panorama/model action.
          watchLoading(scene.five, setFeedback),
        ];
        setReady(true);
        setMessage("Scene ready. Try a task below, or drag the scene to explore.");
      } catch {
        if (!controller.signal.aborted) {
          setError("The public scene could not render. Check WebGL and access to the scene assets, then reload.");
          setMessage("Scene needs attention.");
        }
      }
    }
    void start();
    return () => {
      stops.forEach((stop) => stop());
      stopPicking.current?.();
      stopPicking.current = null;
      labels.current.forEach((stop) => stop());
      labels.current = [];
      if (imageUrl.current) URL.revokeObjectURL(imageUrl.current);
      imageUrl.current = "";
      mounted.current = null;
      controller.abort();
      scene?.dispose();
    };
  }, [reload]);

  async function run(label: string, action: (five: Five) => void | Promise<void>) {
    const scene = mounted.current;
    if (!scene || busy) return;
    setBusy(true);
    setError("");
    try {
      await action(scene.five);
      if (mounted.current === scene) setMessage(label);
    } catch {
      if (mounted.current === scene)
        setError("The action could not complete. A user gesture may interrupt a transition, or this scene may not support the requested view. Try again.");
    } finally {
      if (mounted.current === scene) setBusy(false);
    }
  }

  function togglePicking() {
    const five = mounted.current?.five;
    if (!five) return;
    if (stopPicking.current) {
      stopPicking.current();
      stopPicking.current = null;
      setPicking(false);
      setMessage("Point picking off. Taps navigate again.");
    } else {
      stopPicking.current = watchPickedPoint(five, (hit) => {
        setPoint(hit?.point.clone() ?? null);
        setMessage(hit ? "Point selected. Place a label at this position." : "No model geometry hit. Try a visible surface.");
      });
      setPicking(true);
      setMessage("Point picking on. Tap a visible surface; default tap navigation is paused.");
    }
  }

  const disabled = !ready || busy;
  const destinations = ready && mounted.current ? listDestinations(mounted.current.five) : [];
  const currentPano = mounted.current?.five.pano;
  const hasNextPanorama = destinations.some((pano) =>
    pano.workCode !== currentPano?.workCode || pano.panoIndex !== currentPano?.panoIndex
  );
  return (
    <div className="lab-shell">
      <header className="lab-header">
        <a href="/" className="lab-brand">Realsee <span>SDK examples</span></a>
        <a href="/">Back to Demo & Team starter</a>
      </header>
      <main>
        <div className="lab-intro">
          <span className="eyebrow">FIVE SDK 6.9.2 · PUBLIC WORK</span>
          <h1>Explore what your scene can do.</h1>
          <p>One live canvas, eight checked recipes. No account, credentials, or Team API calls.</p>
        </div>
        <section className="lab-scene" aria-label="SDK task scene">
          <div ref={host} className="lab-canvas" role="region" aria-label="Interactive public scene" aria-busy={!ready} />
          <div ref={overlay} className="lab-overlay" />
          {!ready && <div className="lab-cover"><span>{error ? "Scene unavailable" : "Loading spatial scene…"}</span></div>}
        </section>
        <div className="lab-status" aria-live="polite">
          <strong data-testid="scene-status">{ready ? "Ready" : error ? "Error" : "Loading"}</strong>
          <span>{message}</span>
          {ready && <span className="lab-mode">{mode}</span>}
        </div>
        {error && <div role="alert" className="lab-error">{error}{!ready && <button onClick={() => setReload((value) => value + 1)}>Reload scene</button>}</div>}
        <div className="lab-tasks">
          <section>
            <span className="lab-task-index">01 / VIEW</span>
            <h2>Change your perspective</h2>
            <p>Floorplan is a model overview. Topview looks straight down.</p>
            <div className="lab-actions">
              {(["Panorama", "Floorplan", "Topview"] as SceneView[]).map((view) => <button key={view} disabled={disabled} aria-pressed={mode === view} onClick={() => void run(`${view} view ready.`, (five) => changeView(five, view))}>{view}</button>)}
            </div>
          </section>
          <section>
            <span className="lab-task-index">02 / NAVIGATE</span>
            <h2>Move and look around</h2>
            <p>Visit an active or explicitly loadable panorama, or rotate the current camera.</p>
            <div className="lab-actions">
              <button disabled={disabled || !hasNextPanorama} onClick={() => void run("Arrived at the next panorama.", async (five) => {
                const choices = listDestinations(five);
                if (!choices.length) throw new Error("No destinations");
                const index = choices.findIndex((pano) => pano.workCode === five.pano.workCode && pano.panoIndex === five.pano.panoIndex);
                await goToDestination(five, choices[(index + 1) % choices.length]!);
              })}>Next panorama</button>
              <button disabled={disabled} onClick={() => void run("Camera turned 30°.", (five) => {
                const state = five.getCurrentState();
                return lookAt(five, { longitude: state.longitude + Math.PI / 6, latitude: state.latitude, fov: state.fov });
              })}>Turn camera</button>
            </div>
            {ready && !hasNextPanorama && <p>No other available panorama in this Work. You can still turn the camera.</p>}
          </section>
          <section>
            <span className="lab-task-index">03 / SAVE</span>
            <h2>Keep a view</h2>
            <p>Save this Work’s view as JSON data, then restore or reset it.</p>
            <div className="lab-actions">
              <button disabled={disabled} onClick={() => void run("View saved for this Work.", (five) => setSnapshot(saveView(five)))}>Save view</button>
              <button disabled={disabled || !snapshot} onClick={() => void run("Saved view requested.", (five) => { if (snapshot) restoreView(five, snapshot); })}>Restore view</button>
              <button disabled={disabled} onClick={() => void run("Initial view requested.", (five) => { if (initial.current) restoreView(five, initial.current); })}>Reset view</button>
            </div>
          </section>
          <section>
            <span className="lab-task-index">04 / PLACE</span>
            <h2>Pick a point, place a label</h2>
            <p>Picking pauses tap navigation. The label follows a real 3D point.</p>
            <div className="lab-actions">
              <button disabled={disabled} aria-pressed={picking} onClick={togglePicking}>{picking ? "Stop picking" : "Pick a point"}</button>
              <button disabled={disabled || !point} onClick={() => void run("Spatial label added.", (five) => {
                if (point && overlay.current) labels.current.push(placeLabel(five, overlay.current, point.clone(), "Selected point"));
              })}>Place label</button>
              <button disabled={disabled} onClick={() => { labels.current.forEach((stop) => stop()); labels.current = []; setMessage("Labels cleared."); }}>Clear labels</button>
            </div>
            <output className="lab-detail">{point ? `x ${point.x.toFixed(2)} · y ${point.y.toFixed(2)} · z ${point.z.toFixed(2)}` : "No point selected"}</output>
          </section>
          <section>
            <span className="lab-task-index">05 / CAPTURE</span>
            <h2>Capture the current frame</h2>
            <p>A PNG from the canvas at its current quality. Nothing is uploaded.</p>
            <div className="lab-actions">
              <button disabled={disabled} onClick={() => void run("PNG ready. Use Download PNG to save it.", async (five) => {
                const blob = await captureImage(five);
                if (mounted.current?.five !== five) return;
                if (imageUrl.current) URL.revokeObjectURL(imageUrl.current);
                imageUrl.current = URL.createObjectURL(blob);
                setDownload(imageUrl.current);
              })}>Capture PNG</button>
              {download && <a href={download} download="realsee-scene.png">Download PNG</a>}
            </div>
          </section>
          <section>
            <span className="lab-task-index">06 / OBSERVE</span>
            <h2>Separate the loading stages</h2>
            <p>Texture progress is for one asset. It does not prove API success.</p>
            <output className="lab-detail" aria-live="polite">{feedback ? `${feedback.stage} · ${feedback.state}${"progress" in feedback ? ` · ${Math.round(feedback.progress * 100)}%` : ""}` : ready ? "Initial Work loaded. Move to watch asset events." : "Waiting for the initial Work."}</output>
          </section>
        </div>
      </main>
      <footer className="lab-footer">React 18 · Five SDK 6.9.2 · Three.js 0.117.1 <a href="https://developer.realsee.ai/docs/five-sdk/quickstart">Read the task guides ↗</a></footer>
    </div>
  );
}
