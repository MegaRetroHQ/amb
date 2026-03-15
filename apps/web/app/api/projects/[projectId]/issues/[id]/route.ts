import { NextResponse } from "next/server";

import { jsonError, handleApiError } from "@/lib/api/errors";
import { resolveProjectIdParam } from "@/lib/api/project-params";
import { deleteIssue, getIssueById, updateIssue } from "@/lib/services/issues";
import { updateIssueSchema } from "@amb-app/shared";

type RouteParams = {
  params: Promise<{ projectId: string; id: string }>;
};

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { projectId: rawProjectId, id } = await params;
    const project = await resolveProjectIdParam(rawProjectId);
    if (project.error) {
      return project.error;
    }

    const issue = await getIssueById(project.projectId, id);
    return NextResponse.json({ data: issue });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { projectId: rawProjectId, id } = await params;
    const project = await resolveProjectIdParam(rawProjectId);
    if (project.error) {
      return project.error;
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return jsonError(400, "invalid_json", "Request body must be valid JSON");
    }

    const result = updateIssueSchema.safeParse(body);
    if (!result.success) {
      return jsonError(400, "invalid_request", "Invalid request body", result.error.flatten());
    }

    const issue = await updateIssue(project.projectId, id, {
      title: result.data.title,
      description: Object.prototype.hasOwnProperty.call(result.data, "description")
        ? result.data.description ?? null
        : undefined,
      state: result.data.state,
      priority: result.data.priority,
      assigneeId: Object.prototype.hasOwnProperty.call(result.data, "assigneeId")
        ? result.data.assigneeId ?? null
        : undefined,
      dueDate: Object.prototype.hasOwnProperty.call(result.data, "dueDate")
        ? result.data.dueDate ?? null
        : undefined,
    });

    return NextResponse.json({ data: issue });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { projectId: rawProjectId, id } = await params;
    const project = await resolveProjectIdParam(rawProjectId);
    if (project.error) {
      return project.error;
    }

    await deleteIssue(project.projectId, id);
    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    return handleApiError(error);
  }
}
