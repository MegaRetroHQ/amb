import { ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { createHmac, randomUUID } from "node:crypto";
import { verifyPassword } from "./password";
import type { AuthContext } from "../common/auth-context";
import { NotFoundError } from "@amb-app/shared";

const USER_TOKEN_TTL_SECONDS = 60 * 60;
const PROJECT_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;

function toBase64Url(input: Buffer): string {
  return input
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function signHs256(payload: Record<string, unknown>, secret: string): string {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = toBase64Url(Buffer.from(JSON.stringify(header), "utf8"));
  const encodedPayload = toBase64Url(Buffer.from(JSON.stringify(payload), "utf8"));
  const signature = toBase64Url(
    createHmac("sha256", secret).update(`${encodedHeader}.${encodedPayload}`).digest()
  );
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function hashToken(token: string): string {
  return createHmac("sha256", "project-token-hash-v1").update(token).digest("hex");
}

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async login(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (!user || !user.isActive || !verifyPassword(password, user.passwordHash)) {
      throw new UnauthorizedException("Invalid email or password");
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new UnauthorizedException("JWT_SECRET is not configured");
    }

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      sub: "user",
      userId: user.id,
      tenantId: user.tenantId,
      roles: user.roles,
      type: "user",
      iat: now,
      exp: now + USER_TOKEN_TTL_SECONDS,
    };
    const accessToken = signHs256(payload, secret);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      accessToken,
      tokenType: "Bearer",
      expiresIn: USER_TOKEN_TTL_SECONDS,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        tenantId: user.tenantId,
        roles: user.roles,
      },
    };
  }

  async issueProjectToken(
    auth: AuthContext | undefined,
    projectId: string,
    name: string,
    expiresIn?: number
  ) {
    const authUser = await this.resolveAdminContext(auth, projectId);

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new UnauthorizedException("JWT_SECRET is not configured");
    }

    const ttl = expiresIn ?? PROJECT_TOKEN_TTL_SECONDS;
    const now = Math.floor(Date.now() / 1000);
    const jti = randomUUID();
    const payload = {
      sub: "project",
      tenantId: authUser.tenantId,
      projectId: authUser.projectId,
      type: "project",
      jti,
      iat: now,
      exp: now + ttl,
    };
    const accessToken = signHs256(payload, secret);
    const tokenHash = hashToken(accessToken);

    await this.prisma.withProjectContext(authUser.projectId, async (tx, context) => {
      await (tx as any).projectToken.create({
        data: {
          id: jti,
          tenantId: context.tenantId,
          projectId: context.projectId,
          name: name.trim(),
          tokenHash,
          issuedBy: authUser.userId,
          expiresAt: new Date((now + ttl) * 1000),
        },
      });
    });

    return {
      accessToken,
      tokenType: "Bearer",
      expiresIn: ttl,
      claims: {
        sub: payload.sub,
        tenantId: payload.tenantId,
        projectId: payload.projectId,
        type: payload.type,
        jti: payload.jti,
      },
    };
  }

  async listProjectTokens(auth: AuthContext | undefined, projectId: string) {
    const authUser = await this.resolveAdminContext(auth, projectId);
    return this.prisma.withProjectContext(authUser.projectId, async (tx, context) => {
      return (tx as any).projectToken.findMany({
        where: { projectId: context.projectId },
        select: {
          id: true,
          name: true,
          issuedBy: true,
          createdAt: true,
          updatedAt: true,
          lastUsedAt: true,
          expiresAt: true,
          revokedAt: true,
        },
        orderBy: [{ createdAt: "desc" }],
      });
    });
  }

  async revokeProjectToken(
    auth: AuthContext | undefined,
    projectId: string,
    tokenId: string
  ) {
    const authUser = await this.resolveAdminContext(auth, projectId);
    return this.prisma.withProjectContext(authUser.projectId, async (tx, context) => {
      const token = await (tx as any).projectToken.findFirst({
        where: { id: tokenId, projectId: context.projectId },
      });
      if (!token) throw new NotFoundError("ProjectToken");

      return (tx as any).projectToken.update({
        where: { id: token.id },
        data: { revokedAt: new Date() },
        select: {
          id: true,
          name: true,
          issuedBy: true,
          createdAt: true,
          updatedAt: true,
          lastUsedAt: true,
          expiresAt: true,
          revokedAt: true,
        },
      });
    });
  }

  async deleteProjectToken(
    auth: AuthContext | undefined,
    projectId: string,
    tokenId: string
  ) {
    const authUser = await this.resolveAdminContext(auth, projectId);
    return this.prisma.withProjectContext(authUser.projectId, async (tx, context) => {
      const token = await (tx as any).projectToken.findFirst({
        where: { id: tokenId, projectId: context.projectId },
        select: { id: true },
      });
      if (!token) throw new NotFoundError("ProjectToken");
      await (tx as any).projectToken.delete({ where: { id: token.id } });
      return { success: true };
    });
  }

  private async resolveAdminContext(auth: AuthContext | undefined, projectId: string) {
    if (!auth || auth.subject !== "user") {
      throw new UnauthorizedException("User token is required");
    }

    const roles = auth.roles ?? [];
    const isTenantAdmin = roles.includes("tenant-admin");
    const isProjectAdmin = roles.includes("project-admin");
    if (!isTenantAdmin && !isProjectAdmin) {
      throw new ForbiddenException("Admin role is required");
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, tenantId: true },
    });
    if (!project || !project.tenantId || project.tenantId !== auth.tenantId) {
      throw new ForbiddenException("Project is not available in tenant scope");
    }

    if (isProjectAdmin && !isTenantAdmin && auth.projectId !== projectId) {
      throw new ForbiddenException("Project admin can manage tokens only for own project");
    }

    return {
      userId: auth.userId ?? "unknown-user",
      tenantId: project.tenantId,
      projectId: project.id,
    };
  }
}
