import { NextResponse } from "next/server";

import { jsonError, handleApiError } from "@/lib/api/errors";
import { resolveProjectId } from "@/lib/api/project-context";
import { getThreadById, updateThreadStatus, deleteThread } from "@/lib/services/threads";
import { updateThreadSchema } from "@amb-app/shared";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const project = await resolveProjectId(request);
    if (project.error) {
      return project.error;
    }

    const { id } = await params;
    const thread = await getThreadById(project.projectId, id);
    return NextResponse.json({ data: thread });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const project = await resolveProjectId(request);
    if (project.error) {
      return project.error;
    }

    const { id } = await params;
    const body = await request.json().catch(() => null);
    
    if (!body) {
      return jsonError(400, "invalid_json", "Request body must be valid JSON");
    }

    const result = updateThreadSchema.safeParse(body);
    if (!result.success) {
      return jsonError(400, "invalid_request", "Invalid request body", result.error.flatten());
    }

    const thread = await updateThreadStatus(project.projectId, id, result.data.status);
    return NextResponse.json({ data: thread });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const project = await resolveProjectId(request);
    if (project.error) {
      return project.error;
    }

    const { id } = await params;
    await deleteThread(project.projectId, id);
    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    return handleApiError(error);
  }
}
