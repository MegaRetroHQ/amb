import type { ArgResolvers } from "../args/arg-resolvers";
import type { MessageBusClient } from "../client/message-bus-client";
import type { ToolArgs, ToolHandler } from "../types/tool-args";
import { shapeAgents } from "./response-shaping";

export function createAgentToolHandlers(
  client: MessageBusClient,
  resolvers: ArgResolvers
): Record<string, ToolHandler> {
  return {
    list_project_members: async (args) => {
      const projectId = resolvers.resolveProjectId(args);
      const agents = await client.requestJson(
        `/api/agents?projectId=${encodeURIComponent(projectId)}`
      );
      return shapeAgents(agents as Array<Record<string, unknown>>, args);
    },

    list_agents: async (args) => {
      const agents = await client.requestJson("/api/agents");
      return shapeAgents(agents as Array<Record<string, unknown>>, args);
    },

    register_agent: (args: ToolArgs) =>
      client.requestJson("/api/agents", {
        method: "POST",
        body: JSON.stringify({
          name: args.name,
          role: args.role,
          capabilities: args.capabilities,
        }),
      }),
  };
}
