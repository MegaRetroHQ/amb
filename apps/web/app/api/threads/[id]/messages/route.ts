import { NextResponse } from "next/server";
import { z } from "zod";

import { jsonError, handleApiError } from "@/lib/api/errors";
import { resolveProjectId } from "@/lib/api/project-context";
import { listThreadMessages } from "@/lib/services/threads";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const project = await resolveProjectId(request);
    if (project.error) {
      return project.error;
    }

    const params = await context.params;
    const parsed = paramsSchema.safeParse(params);
    if (!parsed.success) {
      return jsonError(400, "invalid_params", "Invalid thread id", parsed.error.flatten());
    }

    const messages = await listThreadMessages(project.projectId, parsed.data.id);
    return NextResponse.json({ data: messages });
  } catch (error) {
    return handleApiError(error);
  }
}
