import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/lib/services/errors";

export type CreateThreadInput = {
  projectId: string;
  title: string;
  status: "open" | "closed";
};

export async function listThreads(projectId: string) {
  return prisma.thread.findMany({
    where: { projectId },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createThread(input: CreateThreadInput) {
  return prisma.thread.create({
    data: {
      projectId: input.projectId,
      title: input.title,
      status: input.status,
    },
  });
}

export async function getThreadById(projectId: string, threadId: string) {
  const thread = await prisma.thread.findFirst({
    where: { id: threadId, projectId },
  });

  if (!thread) {
    throw new NotFoundError("Thread");
  }

  return thread;
}

export async function listThreadMessages(projectId: string, threadId: string) {
  await getThreadById(projectId, threadId);

  return prisma.message.findMany({
    where: { threadId, projectId },
    orderBy: { createdAt: "asc" },
  });
}

export async function updateThreadStatus(
  projectId: string,
  threadId: string,
  status: "open" | "closed" | "archived"
) {
  await getThreadById(projectId, threadId);

  return prisma.thread.update({
    where: { id: threadId },
    data: { status },
  });
}

export async function deleteThread(projectId: string, threadId: string) {
  await getThreadById(projectId, threadId);

  // Delete all messages in the thread first
  await prisma.message.deleteMany({
    where: { threadId, projectId },
  });

  return prisma.thread.delete({
    where: { id: threadId },
  });
}
