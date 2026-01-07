import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireCompanyAuth } from "../_lib/auth";

export async function PATCH(request: Request) {
  const auth = await requireCompanyAuth(request);
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json()) as {
    instanceId?: string;
    remoteJid?: string;
    unreadMessages?: number;
  };

  if (!body?.instanceId || !body.remoteJid || typeof body.unreadMessages !== "number") {
    return new NextResponse("Invalid payload", { status: 400 });
  }

  await query(
    `
      UPDATE "Chat"
      SET "unreadMessages" = $1, "updatedAt" = NOW()
      WHERE "instanceId" = $2 AND "remoteJid" = $3
        AND "instanceId" IN (SELECT id FROM "Instance" WHERE "companyId" = $4)
    `,
    [body.unreadMessages, body.instanceId, body.remoteJid, auth.companyId]
  );

  return NextResponse.json({ ok: true });
}
