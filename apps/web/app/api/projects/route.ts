import { NextResponse } from "next/server";

import { jsonError, handleApiError } from "@/lib/api/errors";
import { createProject, ensureDefaultProject, listProjects } from "@/lib/services/projects";
import { createProjectSchema } from "@amb-app/shared";

export async function GET() {
  try {
    await ensureDefaultProject();
    const projects = await listProjects();
    return NextResponse.json({ data: projects });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return jsonError(400, "invalid_json", "Request body must be valid JSON");
    }

    const result = createProjectSchema.safeParse(body);
    if (!result.success) {
      return jsonError(400, "invalid_request", "Invalid request body", result.error.flatten());
    }

    const project = await createProject({ name: result.data.name });
    return NextResponse.json({ data: project }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
