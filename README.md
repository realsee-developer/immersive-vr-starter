# Realsee immersive VR template

One template repository. One download. Choose React, Vue or native TypeScript **inside this project**. You do not need a repository for each framework.

The default page is a real full-screen VR tour with spatial navigation, Panorama/Floorplan, Spaces and fullscreen. There is no reset action, API-debug sidebar, developer onboarding screen or extra click to start the scene.

## Choose and run

Use Node 24. From `realsee-immersive-vr`:

```sh
npm run setup
npm ci
npm run check
npm run dev
```

`setup` asks for your preferred UI. For agents and automation, choose explicitly:

```sh
npm run setup -- --framework react
# or --framework vue
# or --framework typescript
```

You can change the selected framework with the same command in the same project. Selection is stored in local `.starter.json`; it never modifies `.env` or creates another repository. All implementations use the one root package and lockfile. Vite builds only the selected UI.

The frontend defaults to `http://127.0.0.1:5173`, with the local API at `http://127.0.0.1:4101`. `VITE_PORT` and `PORT` select different local ports. Ctrl+C stops the processes. Use `npm run build` then `npm start` for the production frontend served by the local Node server.

The public tour needs no account, Developer app or credentials. It needs WebGL and network access to public scene images/models. Drag to look around and click a floor point to move. Switch Panorama/Floorplan at the bottom; use the fullscreen button or F outside interactive controls.

## Make it yours

| Your stack | UI entry |
| --- | --- |
| React | `src/frameworks/react/App.tsx` |
| Vue | `src/frameworks/vue/App.vue` |
| Native TypeScript | `src/frameworks/typescript/main.ts` |

`src/experience.ts` handles the shared browser-only Five renderer, authorized scene loading, mode changes, resizing and disposal. `src/styles.css` defines the immersive composition and floating HUD. Replace branding, title and controls in your chosen native UI.

Dependencies are pinned, including Five SDK 6.9.2, Three.js 0.117.1 and the targeted protobufjs compatibility override. Preserve `package-lock.json`. Do not upgrade incompatible peers to hide failures.

The React edition has a separate learning page at **Spaces → Open SDK examples** (`?sdk-examples=1`). The optional `extensions/` directory contains independently locked Dnalogel and Vreo examples with default port 4188. It is a learning surface within this repository, not a separate template repository. Install it only when needed; Live/RTC are not included there.

## Connect your own Team spaces

```sh
npm run configure -- --device
```

The helper prints a verification URL and eight-character code. Keep it running while the user signs in, chooses the owning Team and app, and authorizes in their browser. Do not approve on their behalf. It writes only the local server `.env` and preserves existing credentials.

Never paste AK/SK or tokens into chat, print environment values, place credentials in `VITE_` variables or expose them in frontend code. If device authorization is unavailable, create `.env` from `.env.example` only if absent, preserve existing values, and configure the three required fields locally.

Restart, open **Spaces**, and choose a listed Team space. An empty directory is a successful read, not a rendered scene. Refresh expired selections. A failed scene preserves the previous view instead of representing public Demo data as Team data. The template does not create apps, upload data or call write APIs.

## Check the result

`npm run check` checks all three UIs and runs local HTTP, authorization and SDK tests. Build each framework with `npm run setup -- --framework ...` followed by `npm run build`. Verify actual browser rendering separately: full-screen real scene, navigation, mode switching, fullscreen and mobile layout. A canvas or successful build is not rendering evidence. Local fixtures do not prove live Team access.

## License

This template retains **PolyForm Noncommercial License 1.0.0** verbatim from the existing `realsee-developer` Quickstart projects, with the same package license declaration. See [LICENSE](LICENSE). Dependencies retain their own licenses and terms.

## Public photographed Work source

The bundled `src/real-demo-work.json` is the official photographed sample from https://github.com/realsee-developer/dnalogel/tree/f7111018ab6ee8bcde7c6008ddf635cfc9b5aa03/open-works/real/80o024DE2xyva3j5BE . Its SHA-256 is `ebfd41d61c2f100f4dbbe303896c01b578c27888c952114bd39b852df45af6c7`. It has 15 capture viewpoints. Original signatures and public CDN references are retained. This public sample does not establish access to a user's Team data.
