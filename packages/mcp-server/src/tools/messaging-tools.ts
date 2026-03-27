import type { MessageBusClient } from "../client/message-bus-client";
import type { ToolArgs, ToolHandler } from "../types/tool-args";
import { shapeMessages } from "./response-shaping";

export function createMessagingToolHandlers(
  client: MessageBusClient
): Record<string, ToolHandler> {
  return {
    send_message: (args: ToolArgs) =>
      client.requestJson("/api/messages/send", {
        method: "POST",
        body: JSON.stringify({
          threadId: args.threadId,
          fromAgentId: args.fromAgentId,
          toAgentId: args.toAgentId,
          payload: args.payload,
          parentId: args.parentId,
        }),
      }),

    get_inbox: async (args: ToolArgs) => {
      const messages = await client.requestJson(`/api/messages/inbox?agentId=${args.agentId}`);
      return shapeMessages(messages as Array<Record<string, unknown>>, args);
    },

    ack_message: (args: ToolArgs) =>
      client.requestJson(`/api/messages/${args.messageId}/ack`, {
        method: "POST",
      }),

    get_dlq: async (args: ToolArgs) => {
      const messages = await client.requestJson("/api/dlq");
      return shapeMessages(messages as Array<Record<string, unknown>>, args);
    },
  };
}
