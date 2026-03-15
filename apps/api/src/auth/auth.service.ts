import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { createHmac } from "node:crypto";
import { verifyPassword } from "./password";

const USER_TOKEN_TTL_SECONDS = 60 * 60;

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
}
