import { Body, Controller, HttpCode, Post, Req } from "@nestjs/common";
import { changePasswordSchema, issueProjectTokenSchema, loginSchema, signupSchema } from "@amb-app/shared";
import { AuthService } from "./auth.service";
import { Public } from "../common/public.decorator";
import type { RequestWithAuth } from "../common/auth-context";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("login")
  @HttpCode(200)
  async login(
    @Body() body: unknown
  ): Promise<{
    data: {
      accessToken: string;
      tokenType: string;
      expiresIn: number;
      user: {
        id: string;
        email: string;
        displayName: string | null;
        tenantId: string;
        roles: string[];
      };
    };
  }> {
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      throw parsed.error;
    }

    const data = await this.authService.login(parsed.data.email, parsed.data.password);
    return { data };
  }

  @Public()
  @Post("signup")
  @HttpCode(201)
  async signup(
    @Body() body: unknown
  ): Promise<{
    data: {
      accessToken: string;
      tokenType: string;
      expiresIn: number;
      user: {
        id: string;
        email: string;
        displayName: string | null;
        tenantId: string;
        roles: string[];
      };
    };
  }> {
    const parsed = signupSchema.safeParse(body);
    if (!parsed.success) {
      throw parsed.error;
    }

    const data = await this.authService.signup(
      parsed.data.email,
      parsed.data.password,
      parsed.data.displayName
    );
    return { data };
  }

  @Post("change-password")
  @HttpCode(200)
  async changePassword(
    @Req() req: RequestWithAuth,
    @Body() body: unknown
  ): Promise<{ data: { success: true } }> {
    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success) {
      throw parsed.error;
    }

    const data = await this.authService.changePassword(
      req.auth,
      parsed.data.currentPassword,
      parsed.data.newPassword
    );
    return { data };
  }

  @Post("project-tokens")
  @HttpCode(201)
  async issueProjectToken(
    @Req() req: RequestWithAuth,
    @Body() body: unknown
  ): Promise<{
    data: {
      accessToken: string;
      tokenType: string;
      expiresIn: number;
      claims: {
        sub: string;
        tenantId: string;
        projectId: string;
        type: string;
        jti: string;
      };
    };
  }> {
    const parsed = issueProjectTokenSchema.safeParse(body);
    if (!parsed.success) {
      throw parsed.error;
    }

    const data = await this.authService.issueProjectToken(
      req.auth,
      parsed.data.projectId,
      parsed.data.name,
      parsed.data.expiresIn
    );
    return { data };
  }
}
