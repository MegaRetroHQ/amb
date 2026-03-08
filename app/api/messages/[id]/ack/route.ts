import { NextResponse } from "next/server";
import { z } from "zod";

import { jsonError, handleApiError } from "@/lib/api/errors";
import { resolveProjectId } from "@/lib/api/project-context";
import { ackMessage } from "@/lib/services/messages";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const project = await resolveProjectId(request);
    if (project.error) {
      return project.error;
    }

    const params = await context.params;
    const parsed = paramsSchema.safeParse(params);
    if (!parsed.success) {
      return jsonError(400, "invalid_params", "Invalid message id", parsed.error.flatten());
    }

    const message = await ackMessage(project.projectId, parsed.data.id);
    return NextResponse.json({ data: message });
  } catch (error) {
    return handleApiError(error);
  }
}
