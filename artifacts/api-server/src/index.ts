import app from "./app";
import { logger } from "./lib/logger";
import { initPool } from "./lib/oracle";
import { initDatabase } from "./lib/db-init";
import { mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const rawPort = process.env["PORT"];
if (!rawPort) throw new Error("PORT environment variable is required");
const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) throw new Error(`Invalid PORT: "${rawPort}"`);

// Ensure uploads directory exists
const uploadsDir = resolve(__dirname, "../uploads");
mkdirSync(uploadsDir, { recursive: true });

async function start() {
  // Initialize Oracle connection pool
  logger.info("Initializing Oracle connection pool...");
  await initPool();
  logger.info("Oracle connection pool initialized ✓");

  // Initialize database schema + seed
  logger.info("Initializing database schema...");
  const dbResult = await initDatabase();
  logger.info({ tablesCreated: dbResult.tablesCreated, errors: dbResult.errors }, "Database initialization complete");

  // Start HTTP server
  app.listen(port, (err?: Error) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "🏠 Real Estate API Server listening");
  });
}

start().catch((err) => {
  logger.error({ err }, "Startup failed");
  process.exit(1);
});
