import "dotenv/config";
import { retryTimedOutMessages } from "../lib/services/messages";

const DEFAULT_PROJECT_ID = "00000000-0000-0000-0000-000000000001";
const PROJECT_ID = process.env.MESSAGE_BUS_PROJECT_ID ?? DEFAULT_PROJECT_ID;

async function main() {
  console.log("[retry-worker] Starting retry cycle...");

  const results = await retryTimedOutMessages(PROJECT_ID);

  console.log(`[retry-worker] Retried: ${results.retried}`);
  console.log(`[retry-worker] Moved to DLQ: ${results.movedToDlq}`);
  console.log("[retry-worker] Done.");

  process.exit(0);
}

main().catch((err) => {
  console.error("[retry-worker] Error:", err);
  process.exit(1);
});
