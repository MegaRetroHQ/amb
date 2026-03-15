import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { projectIdSchema } from "@amb-app/shared";
import {
  DEFAULT_PROJECT_ID,
  DEFAULT_PROJECT_SLUG,
  DEFAULT_TENANT_ID,
  DEFAULT_TENANT_SLUG,
} from "./tenant-project.constants";

@Injectable()
export class ProjectGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string>;
      query: Record<string, string>;
      projectId?: string;
    }>();
    const fromQuery = request.query?.projectId;
    const fromHeader = request.headers["x-project-id"];

    if (fromQuery && fromHeader && fromQuery !== fromHeader) {
      throw new BadRequestException("projectId mismatch between query and x-project-id header");
    }

    const raw = fromQuery ?? fromHeader;

    if (!raw) {
      await this.prisma.tenant.upsert({
        where: { slug: DEFAULT_TENANT_SLUG },
        update: {},
        create: {
          id: DEFAULT_TENANT_ID,
          name: "Default Tenant",
          slug: DEFAULT_TENANT_SLUG,
        },
      });

      const project = await this.prisma.project.upsert({
        where: { slug: DEFAULT_PROJECT_SLUG },
        update: {},
        create: {
          id: DEFAULT_PROJECT_ID,
          tenantId: DEFAULT_TENANT_ID,
          name: "Default Project",
          slug: DEFAULT_PROJECT_SLUG,
        },
      });
      request.projectId = project.id;
      return true;
    }

    const parsed = projectIdSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BadRequestException("projectId must be a valid UUID");
    }

    const project = await this.prisma.project.findUnique({
      where: { id: parsed.data },
    });
    if (!project) {
      throw new NotFoundException("Project not found");
    }
    request.projectId = project.id;
    return true;
  }
}
