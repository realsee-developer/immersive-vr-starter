import { readConfig } from "./config.ts";
import { createGateway } from "./gateway.ts";
import { createStarterServer } from "./http.ts";

const config = readConfig();
const server = createStarterServer(config, createGateway(config));
server.listen(config.port, "127.0.0.1", () => {
  console.log(`Realsee starter API: http://127.0.0.1:${config.port}`);
  if (!config.dev) console.log(`Open the app: http://127.0.0.1:${config.port}`);
});
server.on("error", () => {
  console.error(
    "The local server could not start. Check whether PORT is already in use."
  );
  process.exitCode = 1;
});
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close();
    server.closeIdleConnections();
  });
}
