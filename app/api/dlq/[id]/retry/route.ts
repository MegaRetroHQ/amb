import { NextResponse } from "next/server";

import { handleApiError } from "@/lib/api/errors";
import { resolveProjectId } from "@/lib/api/project-context";
import { retryDlqMessage } from "@/lib/services/messages";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const project = await resolveProjectId(request);
    if (project.error) {
      return project.error;
    }

    const { id } = await params;
    const message = await retryDlqMessage(project.projectId, id);
    return NextResponse.json({ data: message });
  } catch (error) {
    return handleApiError(error);
  }
}
