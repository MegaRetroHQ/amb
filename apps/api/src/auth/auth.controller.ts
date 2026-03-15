import { Body, Controller, HttpCode, Post } from "@nestjs/common";
import { loginSchema } from "@amb-app/shared";
import { AuthService } from "./auth.service";
import { Public } from "../common/public.decorator";

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
}
