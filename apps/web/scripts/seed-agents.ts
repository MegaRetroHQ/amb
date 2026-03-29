import "dotenv/config";
import fs from "fs/promises";

import {
  messageBusFetchHeaders,
  resolveSeedMessageBusConfig,
  type SeedMessageBusConfig,
} from "./message-bus-env";
import { resolveRegistryJsonPath } from "./registry-path";

type Registry = {
  project: string;
  mode: string;
  agents: {
    id: string;
    name: string;
    role: string;
    defaultThreads?: string[];
  }[];
};

type Agent = {
  id: string;
  name: string;
  role: string;
};

async function getExistingAgents(
  apiUrl: string,
  config: SeedMessageBusConfig
): Promise<Map<string, Agent>> {
  try {
    const res = await fetch(apiUrl, {
      headers: messageBusFetchHeaders(config, false),
    });
    if (!res.ok) return new Map();
    const json = await res.json();
    const agents = json.data as Agent[];
    return new Map(agents.map((a) => [a.role, a]));
  } catch {
    return new Map();
  }
}

async function main() {
  const bus = await resolveSeedMessageBusConfig();
  const apiUrl = `${bus.baseUrl}/api/agents`;

  const registryPath = await resolveRegistryJsonPath();

  const raw = await fs.readFile(registryPath, "utf-8");
  const registry = JSON.parse(raw) as Registry;

  console.log(`🌱 Seeding agents for: ${registry.project}\n`);

  console.log("⚙️  Config:");
  console.log(`   API URL     ${bus.baseUrl}  (${bus.sources.baseUrl})`);
  console.log(`   Project ID  ${bus.projectId ?? "—"}  (${bus.sources.projectId})`);
  console.log(`   Auth token  ${bus.accessToken ? "***" : "—"}  (${bus.sources.accessToken})`);
  console.log(`   Registry    ${registryPath}\n`);

  const existingAgents = await getExistingAgents(apiUrl, bus);
  console.log(`📋 Existing agents in project: ${existingAgents.size}\n`);

  let created = 0;
  let skipped = 0;

  for (const agent of registry.agents) {
    const existing = existingAgents.get(agent.role);
    if (existing) {
      console.log(`⏭️  Skip (exists): ${agent.role} → ${existing.id}`);
      skipped++;
      continue;
    }

    const res = await fetch(apiUrl, {
      method: "POST",
      headers: messageBusFetchHeaders(bus, true),
      body: JSON.stringify({
        name: agent.name,
        role: agent.role,
      }),
    });

    if (!res.ok) {
      console.error(`❌ Failed to seed agent ${agent.id}`);
      console.error(await res.text());
      continue;
    }

    const json = await res.json();
    console.log(`✅ Created: ${agent.role} → ${json.data.id}`);
    created++;
  }

  console.log("\n────────────────────────────────────");
  console.log(`✅ Created: ${created}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log("🎉 Agent seeding complete.");
}

main().catch((err) => {
  console.error("Fatal seed error:", err);
  process.exit(1);
});
