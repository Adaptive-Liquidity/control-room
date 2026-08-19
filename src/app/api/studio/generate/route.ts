import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { ForbiddenError, requirePermission } from "@/lib/rbac";
import { callN8nGenerate, generateRequestSchema } from "@/lib/n8n/generate-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    requirePermission(session, "content.edit");

    const body = await req.json();
    const validated = generateRequestSchema.parse(body);
    const result = await callN8nGenerate(validated);

    if (!result.ok) {
      const status = result.status === 503 || !process.env.N8N_GENERATE_WEBHOOK_URL ? 503 : 502;
      return NextResponse.json({ error: result.error }, { status: result.status ?? status });
    }

    return NextResponse.json(result.data);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    console.error("POST /api/studio/generate error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
