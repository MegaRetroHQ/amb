import { z } from "zod";

import { jsonError } from "@/lib/api/errors";
import { ensureDefaultProject, getProjectById } from "@/lib/services/projects";

const projectIdSchema = z.string().uuid();

function getProjectIdFromRequest(request: Request): string | null {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("projectId");
  const fromHeader = request.headers.get("x-project-id");
  return fromQuery ?? fromHeader;
}

type ProjectContextResult =
  | { projectId: string; error: null }
  | { projectId: null; error: Response };

export async function resolveProjectId(request: Request): Promise<ProjectContextResult> {
  const rawProjectId = getProjectIdFromRequest(request);

  if (!rawProjectId) {
    const defaultProject = await ensureDefaultProject();
    return { projectId: defaultProject.id, error: null };
  }

  const parsed = projectIdSchema.safeParse(rawProjectId);
  if (!parsed.success) {
    return {
      projectId: null,
      error: jsonError(400, "invalid_project_id", "projectId must be a valid UUID"),
    };
  }

  try {
    const project = await getProjectById(parsed.data);
    return { projectId: project.id, error: null };
  } catch {
    return {
      projectId: null,
      error: jsonError(404, "project_not_found", "Project not found"),
    };
  }
}
