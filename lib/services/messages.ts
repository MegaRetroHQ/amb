import { prisma } from "@/lib/prisma";
import { Prisma } from "../../prisma/generated/client";
import { ConflictError, NotFoundError } from "@/lib/services/errors";

export type SendMessageInput = {
  projectId: string;
  threadId: string;
  fromAgentId: string;
  toAgentId?: string | null;
  payload: Prisma.InputJsonValue;
  parentId?: string | null;
};

async function ensureThreadExists(projectId: string, threadId: string) {
  const thread = await prisma.thread.findFirst({
    where: { id: threadId, projectId },
  });

  if (!thread) {
    throw new NotFoundError("Thread");
  }
}

async function ensureAgentExists(projectId: string, agentId: string, label: "From agent" | "To agent") {
  const agent = await prisma.agent.findFirst({
    where: { id: agentId, projectId },
  });

  if (!agent) {
    throw new NotFoundError(label);
  }
}

async function ensureMessageExists(projectId: string, messageId: string) {
  const message = await prisma.message.findFirst({
    where: { id: messageId, projectId },
  });

  if (!message) {
    throw new NotFoundError("Parent message");
  }
}

export async function sendMessage(input: SendMessageInput) {
  await ensureThreadExists(input.projectId, input.threadId);
  await ensureAgentExists(input.projectId, input.fromAgentId, "From agent");

  if (input.toAgentId) {
    await ensureAgentExists(input.projectId, input.toAgentId, "To agent");
  }

  if (input.parentId) {
    await ensureMessageExists(input.projectId, input.parentId);
  }

  return prisma.message.create({
    data: {
      projectId: input.projectId,
      threadId: input.threadId,
      fromAgentId: input.fromAgentId,
      toAgentId: input.toAgentId ?? null,
      payload: input.payload,
      parentId: input.parentId ?? null,
      status: "pending",
      retries: 0,
    },
  });
}

export async function getInboxMessages(projectId: string, agentId: string) {
  return prisma.$transaction(async (tx) => {
    // Mark pending messages as delivered
    // Include both direct messages (toAgentId = agentId) and broadcast messages (toAgentId = null)
    // Exclude messages from the agent itself (fromAgentId != agentId)
    await tx.message.updateMany({
      where: {
        projectId,
        OR: [
          { toAgentId: agentId },
          { toAgentId: null }, // Broadcast messages
        ],
        fromAgentId: { not: agentId }, // Don't include own messages
        status: "pending",
      },
      data: {
        status: "delivered",
      },
    });

    // Return all delivered (unacked) messages
    // Include both direct and broadcast messages, exclude own messages
    return tx.message.findMany({
      where: {
        projectId,
        OR: [
          { toAgentId: agentId },
          { toAgentId: null }, // Broadcast messages
        ],
        fromAgentId: { not: agentId }, // Don't include own messages
        status: "delivered",
      },
      orderBy: {
        createdAt: "asc",
      },
    });
  });
}

export async function ackMessage(projectId: string, messageId: string) {
  const message = await prisma.message.findFirst({
    where: { id: messageId, projectId },
  });

  if (!message) {
    throw new NotFoundError("Message");
  }

  if (message.status === "ack") {
    return message;
  }

  if (message.status !== "delivered") {
    throw new ConflictError("Message", "Message must be delivered before ack");
  }

  return prisma.message.update({
    where: { id: messageId },
    data: { status: "ack" },
  });
}

const MAX_RETRIES = 3;
const DELIVERY_TIMEOUT_MS = 60_000; // 1 minute

export async function retryTimedOutMessages(projectId: string) {
  const timeoutThreshold = new Date(Date.now() - DELIVERY_TIMEOUT_MS);

  const timedOutMessages = await prisma.message.findMany({
    where: {
      projectId,
      status: "delivered",
      createdAt: { lt: timeoutThreshold },
    },
  });

  const results = {
    retried: 0,
    movedToDlq: 0,
  };

  for (const message of timedOutMessages) {
    const newRetries = message.retries + 1;

    if (newRetries >= MAX_RETRIES) {
      await prisma.message.update({
        where: { id: message.id },
        data: { status: "dlq", retries: newRetries },
      });
      results.movedToDlq++;
    } else {
      await prisma.message.update({
        where: { id: message.id },
        data: { status: "pending", retries: newRetries },
      });
      results.retried++;
    }
  }

  return results;
}

export async function getDlqMessages(projectId: string) {
  return prisma.message.findMany({
    where: { projectId, status: "dlq" },
    orderBy: { createdAt: "desc" },
  });
}

export async function cleanupOldMessages(projectId: string, retentionDays: number = 30) {
  const threshold = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  const result = await prisma.message.deleteMany({
    where: {
      projectId,
      status: { in: ["ack", "dlq"] },
      createdAt: { lt: threshold },
    },
  });

  return { deleted: result.count };
}

export async function retryDlqMessage(projectId: string, messageId: string) {
  const message = await prisma.message.findFirst({
    where: { id: messageId, projectId },
  });

  if (!message) {
    throw new NotFoundError("Message");
  }

  if (message.status !== "dlq") {
    throw new ConflictError("Message", "Message must be in DLQ to retry");
  }

  return prisma.message.update({
    where: { id: messageId },
    data: { 
      status: "pending",
      retries: 0,
    },
  });
}

export async function retryAllDlqMessages(projectId: string) {
  const result = await prisma.message.updateMany({
    where: { projectId, status: "dlq" },
    data: { 
      status: "pending",
      retries: 0,
    },
  });

  return { retried: result.count };
}
