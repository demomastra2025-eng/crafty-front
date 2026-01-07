import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireCompanyAuth } from "../_lib/auth";

export async function PATCH(request: Request) {
  const auth = await requireCompanyAuth(request);
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json()) as { ids?: string[]; status?: string };
  const ids = body?.ids || [];
  const status = body?.status || "";
  if (!ids.length || !status) {
    return new NextResponse("Invalid payload", { status: 400 });
  }

  await query(
    `UPDATE "Message"
     SET status = $1
     WHERE id = ANY($2)
       AND "instanceId" IN (SELECT id FROM "Instance" WHERE "companyId" = $3)`,
    [status, ids, auth.companyId]
  );
  return NextResponse.json({ ok: true });
}
