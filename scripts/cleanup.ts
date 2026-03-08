import "dotenv/config";
import { cleanupOldMessages } from "../lib/services/messages";

const RETENTION_DAYS = parseInt(process.env.RETENTION_DAYS || "30", 10);
const DEFAULT_PROJECT_ID = "00000000-0000-0000-0000-000000000001";
const PROJECT_ID = process.env.MESSAGE_BUS_PROJECT_ID ?? DEFAULT_PROJECT_ID;

async function main() {
  console.log(`[cleanup] Cleaning messages older than ${RETENTION_DAYS} days...`);

  const result = await cleanupOldMessages(PROJECT_ID, RETENTION_DAYS);

  console.log(`[cleanup] Deleted: ${result.deleted} messages`);
  console.log("[cleanup] Done.");

  process.exit(0);
}

main().catch((err) => {
  console.error("[cleanup] Error:", err);
  process.exit(1);
});
