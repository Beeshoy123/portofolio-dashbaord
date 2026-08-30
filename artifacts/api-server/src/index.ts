import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dotenvPathCandidates = [
  path.resolve(process.cwd(), "../../.secrets/api-server.env"),
  path.resolve(process.cwd(), ".env"),
  path.resolve(__dirname, "../.env"),
  path.resolve(__dirname, ".env"),
];

const dotenvPath = dotenvPathCandidates.find((candidate) => fs.existsSync(candidate));

const { config } = await import("dotenv");
config(
  dotenvPath
    ? {
        path: dotenvPath,
        // Workflow-provided values such as PORT must take precedence over
        // local .env defaults (the Replit API workflow uses port 8080).
        override: false,
      }
    : undefined,
);

if (dotenvPath) {
  console.info(`Loaded environment from ${dotenvPath}`);
}

const { default: app } = await import("./app");
const { logger } = await import("./lib/logger");

const rawPort = process.env["PORT"] ?? "8080";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
