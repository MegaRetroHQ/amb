import { NextResponse } from "next/server";

import { handleApiError } from "@/lib/api/errors";
import { resolveProjectId } from "@/lib/api/project-context";
import { retryAllDlqMessages } from "@/lib/services/messages";

export async function POST(request: Request) {
  try {
    const project = await resolveProjectId(request);
    if (project.error) {
      return project.error;
    }

    const result = await retryAllDlqMessages(project.projectId);
    return NextResponse.json({ data: result });
  } catch (error) {
    return handleApiError(error);
  }
}
