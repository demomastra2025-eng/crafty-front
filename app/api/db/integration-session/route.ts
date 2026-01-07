import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireCompanyAuth } from "../_lib/auth";

export async function GET(request: Request) {
  const auth = await requireCompanyAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id") || "";

  if (!id) {
    return NextResponse.json({ session: null }, { status: 400 });
  }

  const rows = await query(
    `
      SELECT
        id,
        "sessionId",
        "remoteJid",
        "pushName",
        status,
        "awaitUser",
        "createdAt",
        "updatedAt",
        "instanceId",
        parameters,
        context,
        "botId",
        type,
        "funnelId",
        "funnelStage",
        "followUpStage",
        "funnelEnable",
        "followUpEnable"
      FROM "IntegrationSession"
      WHERE id = $1
        AND "instanceId" IN (SELECT id FROM "Instance" WHERE "companyId" = $2)
      LIMIT 1
    `,
    [id, auth.companyId]
  );

  return NextResponse.json({ session: rows[0] || null });
}
