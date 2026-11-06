# Working in this immersive VR template

Read README.md. This is one project, one package and one lockfile, with React, Vue and native TypeScript UI choices. Select with `npm run setup -- --framework react|vue|typescript`; do not create separate repositories or publish framework-specific packages.

- Keep the default route a full-screen VR tour. Do not add a reset button, R shortcut, API-debug sidebar, developer onboarding panel or activation click.
- `src/frameworks/` contains framework-native UIs. `src/experience.ts` owns the shared Five lifecycle and data access. Dispose it when the view unmounts. Preserve browser-only loading, resize handling and renderer cleanup.
- Preserve exact SDK, Three.js and runtime versions and the targeted protobufjs override. Use Node 24 and the committed package-lock.json.
- Run npm ci, npm run check and npm run build. Verify all three framework choices independently, including actual browser scenes, mode switching and fullscreen.
- Keep credentials and tokens only in the local backend .env. Run `npm run configure -- --device` for Team data; give the user the browser URL and user code, and wait for their approval. Never authorize on their behalf, ask for secrets in chat, expose secrets to frontend code, print .env or overwrite existing credentials.
- Keep local Host/Origin checks, signed Team scene selections, API business-code checks and request deadlines. Do not add a generic proxy or arbitrary upstream URL input.
- A public scene render does not establish Team API access. A successful empty directory is not an API failure or a rendered Team scene. Report real browser and live Team checks separately from local fixtures.
- Preserve LICENSE verbatim and the package's PolyForm-Noncommercial-1.0.0 declaration. Do not substitute a different license. Dependencies keep their own terms.
