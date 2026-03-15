import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/lib/services/errors";

const DEFAULT_PROJECT_ID = "00000000-0000-0000-0000-000000000001";
const DEFAULT_PROJECT_NAME = "Default Project";
const DEFAULT_PROJECT_SLUG = "default";

export type CreateProjectInput = {
  name: string;
};

export async function ensureDefaultProject() {
  return prisma.project.upsert({
    where: { slug: DEFAULT_PROJECT_SLUG },
    update: {},
    create: {
      id: DEFAULT_PROJECT_ID,
      name: DEFAULT_PROJECT_NAME,
      slug: DEFAULT_PROJECT_SLUG,
    },
  });
}

export async function listProjects() {
  return prisma.project.findMany({
    orderBy: { createdAt: "desc" },
  });
}

function toSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

async function generateUniqueSlug(baseName: string): Promise<string> {
  const base = toSlug(baseName) || "project";
  let candidate = base;
  let counter = 1;

  while (true) {
    const existing = await prisma.project.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }

    counter += 1;
    candidate = `${base}-${counter}`;
  }
}

export async function createProject(input: CreateProjectInput) {
  const slug = await generateUniqueSlug(input.name);

  return prisma.project.create({
    data: {
      name: input.name.trim(),
      slug,
    },
  });
}

export async function getProjectById(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    throw new NotFoundError("Project");
  }

  return project;
}
