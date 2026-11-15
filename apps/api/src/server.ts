import { createApp } from "./app.js";

const configuredPort = Number.parseInt(process.env["PORT"] ?? "4000", 10);
const port = Number.isNaN(configuredPort) ? 4000 : configuredPort;

createApp().listen(port, () => {
  process.stdout.write(`FolioAgent API listening on port ${port}\n`);
});
