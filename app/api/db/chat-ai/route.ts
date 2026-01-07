import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireCompanyAuth } from "../_lib/auth";

export async function PATCH(request: Request) {
  const auth = await requireCompanyAuth(request);
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json()) as { id?: string; enabled?: boolean };
  if (!body?.id || typeof body.enabled !== "boolean") {
    return new NextResponse("Invalid payload", { status: 400 });
  }

  await query(
    `
      UPDATE "Chat"
      SET is_ai = $1, "updatedAt" = NOW()
      WHERE id = $2
        AND "instanceId" IN (SELECT id FROM "Instance" WHERE "companyId" = $3)
    `,
    [body.enabled, body.id, auth.companyId]
  );

  return NextResponse.json({ ok: true });
}
