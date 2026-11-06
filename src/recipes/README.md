# Five SDK task recipes

These browser examples target the published `@realsee/five@6.9.2` package. They
are included in the starter's TypeScript check and can be included directly in
the portal's task guides. Import them into your React component or event handler
after the starter's Demo scene works. They are small integration building blocks,
not separate projects or an additional framework layer.

Run the starter and open `/?sdk-examples=1` (or choose **Open SDK examples** in
the footer) for a single-canvas page that uses all eight recipes with the bundled
public Work. Its view/navigation/save/placement/capture controls are explicit
user actions. Capturing produces a download link and never uploads the image.

| Task | Source and exports | Verified public SDK surface | Conditions and limits |
| --- | --- | --- | --- |
| Mount a scene and release it | `mountScene.ts`: `mountScene(host, rawWork, signal?)` | `Five`, `parseWork`, `appendTo`, `load`, `refresh`, `dispose` | Browser only; give the host a height. Call `dispose` on unmount, or abort the signal. An abort releases this instance; it does not prove that every SDK asset request was canceled. Work/assets must be accessible. |
| Switch panorama, model overview, and top view | `changeView.ts`: `changeView`, `watchView` | `changeMode`, `mode.change`, `Mode` | `Floorplan` is a perspective model overview; `Topview` is the orthographic top view. Model data must exist. Await transitions and handle rejection. |
| Visit an observer and look around | `navigateScene.ts`: `listDestinations`, `goToDestination`, `lookAt` | `observers`, `WorkObserver.active/loadable`, `Pano`, `moveToPano`, `updateCamera` | Accept `active || loadable`, as the 6.9.2 runtime does; the public sample has active observers with `loadable: false`. Use real observer identifiers. Angles are radians; animation durations are milliseconds. A user action or another transition can interrupt and reject a camera move. `updateCamera` does not navigate to a new panorama. |
| Save and restore a view | `savedViews.ts`: `SavedView`, `saveView`, `restoreView` | `getCurrentState`, `State`, `setState`, Three.js `Vector3` | Snapshots are for the same loaded Work. Keep `workCode`; convert the live vector to JSON and reconstruct it. `setState` returns `void`, so returning from `restoreView` does not promise a completed animation. Validate any untrusted persisted input separately. |
| Show loading feedback | `loadingFeedback.ts`: `LoadingFeedback`, `watchLoading` | `works.ready`, `pano.texture.progress/success/error`, `models.load/refined`, `model.error` | Bind before loading. Panorama progress belongs to that texture, not all resources. Model refinement depends on the current camera and can change again. API success and visual readiness remain separate. |
| Pick a spatial point | `pickPoint.ts`: `watchPickedPoint` | `gesture.tap`, `GestureEvent.center.raycaster`, `preventDefault`, `model.intersectRaycaster`, `Intersection` | Enable only while a placement tool is active; it suppresses default tap navigation. A click may miss or lack loaded model geometry. A hit is a geometric intersection, not a semantic room/object identity. |
| Place a label in space | `placeLabel.ts`: `placeLabel` | `project2d`, `render`, Three.js `Vector3` | Overlay and canvas must share a positioned box. The function hides labels outside the view or occluded by the model. Per-label raycasts have a cost. This is a basic text label, not the full Dnalogel tag editor. |
| Capture the current frame | `captureImage.ts`: `captureImage` | `getSize`, `getPixels`, Three.js `Vector2` | Capture after load and from a user action. Reads pixels synchronously and returns a PNG `Blob`; it does not upload anything. It captures the current assets/quality, not a guarantee that all future high-resolution tiles are ready. Test browser/device asset permissions. |

All returned listener/label cleanups must run before disposing their Five
instance. In React, call cleanup from the effect's return function and catch
rejected async operations in the UI. Do not silently replace an unsuccessful
Team scene with Demo data.

## Evidence and verification

The source of truth for these names is the installed release's
`five/application/five.d.ts`, `five/application/events.d.ts`,
`five/controllers/events.d.ts`, `five/utils/event.d.ts`,
`five/work/work.d.ts`, and `five/types/state.d.ts`. The same package's
`llms.txt` and `ai_guides/` provide a useful capability map. Match those guides
against the types and runtime before copying their snippets. For example, the
6.9.2 loading guide spells the tile event `model.tileLoad`, while the subscription
key in both types and runtime is `models.tileLoad`; the event object's `type`
field still uses the singular spelling. These examples do not subscribe to the
incorrect key.

`npm run check` compiles all recipes, parses the bundled Work with the actual
SDK, verifies the actual runtime method exports, exercises modern events and
listener cleanup through a headless SDK instance, and checks JSON snapshot
ownership. The protocol fixtures independently check the local API boundary.
These checks do not create a WebGL renderer or prove visual behavior for every
recipe or a real Team. Run the scene and affected task in a browser for visual
acceptance; verify Team credentials separately on the local server.

The starter keeps React 18 to meet the peer constraints of the separately
installed Dnalogel, Vreo, and Live extension path. None of those extensions is
installed by default. The recipes above use Five SDK directly.
