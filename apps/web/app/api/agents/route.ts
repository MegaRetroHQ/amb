import { NextResponse } from "next/server";
import { z } from "zod";

import { jsonError, handleApiError } from "@/lib/api/errors";
import { resolveProjectId } from "@/lib/api/project-context";
import { createAgent, listAgents } from "@/lib/services/agents";
import { Prisma } from "../../../prisma/generated/client";

const createAgentSchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  capabilities: z.unknown().optional().nullable(),
});

export async function GET(request: Request) {
  try {
    const project = await resolveProjectId(request);
    if (project.error) {
      return project.error;
    }

    const agents = await listAgents(project.projectId);
    return NextResponse.json({ data: agents });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const project = await resolveProjectId(request);
    if (project.error) {
      return project.error;
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return jsonError(400, "invalid_json", "Request body must be valid JSON");
    }

    const result = createAgentSchema.safeParse(body);
    if (!result.success) {
      return jsonError(400, "invalid_request", "Invalid request body", result.error.flatten());
    }

    const agent = await createAgent({
      projectId: project.projectId,
      name: result.data.name,
      role: result.data.role,
      capabilities: result.data.capabilities as Prisma.InputJsonValue | null | undefined,
    });

    return NextResponse.json({ data: agent }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
