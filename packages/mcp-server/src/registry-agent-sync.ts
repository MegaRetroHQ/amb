import type { MessageBusClient } from "./client/message-bus-client";
import type { Registry } from "./agent-registry";

type AgentRow = { id: string; name: string; role: string };

/**
 * Создаёт в API агентов из registry, если для роли ещё нет записи в текущем проекте.
 */
export async function syncRegistryAgents(
  client: MessageBusClient,
  registry: Registry
): Promise<{ created: number; skipped: number; createdRows: AgentRow[] }> {
  if (!registry.agents.length) {
    return { created: 0, skipped: 0, createdRows: [] };
  }

  const existing = await client.requestJson<AgentRow[]>("/api/agents");
  const byRole = new Map(existing.map((a) => [a.role, a]));

  let created = 0;
  let skipped = 0;
  const createdRows: AgentRow[] = [];

  for (const agent of registry.agents) {
    if (byRole.has(agent.role)) {
      skipped++;
      continue;
    }
    const row = await client.requestJson<AgentRow>("/api/agents", {
      method: "POST",
      body: JSON.stringify({
        name: agent.name,
        role: agent.role,
      }),
    });
    created++;
    createdRows.push(row);
    byRole.set(agent.role, row);
  }

  return { created, skipped, createdRows };
}
