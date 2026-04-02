import { NextResponse } from "next/server";
import { signupSchema } from "@amb-app/shared";

import { API_BASE_URL } from "@/lib/api/client";
import { jsonError } from "@/lib/api/errors";
import { setAccessTokenCookie } from "@/lib/api/auth";

type SignupApiSuccess = {
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
};

type ApiErrorShape = {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return jsonError(400, "invalid_json", "Request body must be valid JSON");
  }

  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "invalid_request", "Invalid request body", parsed.error.flatten());
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
  } catch {
    return jsonError(503, "service_unavailable", "API service is unavailable");
  }

  const payload = (await response.json().catch(() => null)) as SignupApiSuccess | ApiErrorShape | null;
  if (!response.ok) {
    const code =
      payload && "error" in payload && payload.error?.code ? payload.error.code : "auth_failed";
    const message =
      payload && "error" in payload && payload.error?.message
        ? payload.error.message
        : "Authentication failed";
    const details =
      payload && "error" in payload && payload.error?.details
        ? payload.error.details
        : undefined;
    return jsonError(response.status, code, message, details);
  }

  if (!payload || !("data" in payload) || !payload.data?.accessToken) {
    return jsonError(502, "invalid_auth_response", "Invalid signup response from API");
  }

  const res = NextResponse.json(
    {
      data: {
        tokenType: payload.data.tokenType,
        expiresIn: payload.data.expiresIn,
        user: payload.data.user,
      },
    },
    { status: 201 }
  );
  setAccessTokenCookie(res, payload.data.accessToken, payload.data.expiresIn);
  return res;
}
