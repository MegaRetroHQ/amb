import { NextResponse } from "next/server";
import { z } from "zod";

import { jsonError, handleApiError } from "@/lib/api/errors";
import { createThread, listThreads } from "@/lib/services/threads";

const createThreadSchema = z.object({
  title: z.string().min(1),
  status: z.enum(["open", "closed"]).optional().default("open"),
});

export async function GET() {
  try {
    const threads = await listThreads();
    return NextResponse.json({ data: threads });
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

    const result = createThreadSchema.safeParse(body);
    if (!result.success) {
      return jsonError(400, "invalid_request", "Invalid request body", result.error.flatten());
    }

    const thread = await createThread({
      title: result.data.title,
      status: result.data.status,
    });

    return NextResponse.json({ data: thread }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
