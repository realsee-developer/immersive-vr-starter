# Spatial interface examples

This optional project is included in the same Realsee starter download. It renders the real public scene with Dnalogel text hotspots and measurement, plus a silent Vreo camera-and-caption story. It needs no account, credentials or Team API calls.

With Node 24 installed, open a terminal in `realsee-react-five/extensions`:

```sh
npm ci
npm run check
npm run build
npm run dev
```

Open the actual local address printed in the terminal (default `http://127.0.0.1:4188`). Wait for **Scene ready**, then try **Add text hotspot**, **Start measurement** and **Play camera and caption**. Pick two visible surfaces and finish the measurement. The eight-second story is deliberately silent; test Pause, Resume and Stop separately. Network access to public scene assets and WebGL are required.

Stop with Ctrl+C. To preview the production build, run `npm run preview`. If the port is occupied, use `npm run dev -- --port 4189` or choose another unused port.

The lockfile pins Five SDK 6.9.2, Dnalogel 3.81.10, Vreo 2.6.4, React 18.3.1 and compatible Three.js 0.117.1. Keep the supplied versions and protobufjs override. This project contains no Live/RTC code or dependencies.

The public [Dnalogel](https://developer.realsee.ai/docs/dnalogel/quickstart) and [Vreo](https://developer.realsee.ai/docs/vreo/quickstart) guides use these same source files. In the portal repository, their maintained source is in `examples/sdk-guides`; the release tool copies its Dnalogel/Vreo files into this project during publication. No private repository checkout is needed to run the downloaded example.
