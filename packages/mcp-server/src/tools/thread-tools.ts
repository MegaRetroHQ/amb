import type { MessageBusClient } from "../client/message-bus-client";
import type { ToolArgs, ToolHandler } from "../types/tool-args";
import { shapeMessages, shapeThreads } from "./response-shaping";

export function createThreadToolHandlers(client: MessageBusClient): Record<string, ToolHandler> {
  return {
    list_threads: async (args) => {
      const threads = await client.requestJson("/api/threads");
      return shapeThreads(threads as Array<Record<string, unknown>>, args);
    },

    create_thread: (args: ToolArgs) =>
      client.requestJson("/api/threads", {
        method: "POST",
        body: JSON.stringify({
          title: args.title,
          status: args.status,
        }),
      }),

    get_thread_messages: async (args: ToolArgs) => {
      const messages = await client.requestJson(`/api/threads/${args.threadId}/messages`);
      return shapeMessages(messages as Array<Record<string, unknown>>, args);
    },

    get_thread: (args: ToolArgs) => client.requestJson(`/api/threads/${args.threadId}`),

    update_thread: (args: ToolArgs) =>
      client.requestJson(`/api/threads/${args.threadId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: args.status }),
      }),

    close_thread: (args: ToolArgs) =>
      client.requestJson(`/api/threads/${args.threadId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "closed" }),
      }),
  };
}
