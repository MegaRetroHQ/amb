import { NextResponse } from "next/server";

import { handleApiError } from "@/lib/api/errors";
import { resolveProjectId } from "@/lib/api/project-context";
import { getDlqMessages } from "@/lib/services/messages";

export async function GET(request: Request) {
  try {
    const project = await resolveProjectId(request);
    if (project.error) {
      return project.error;
    }

    const messages = await getDlqMessages(project.projectId);
    return NextResponse.json({ data: messages });
  } catch (error) {
    return handleApiError(error);
  }
}
