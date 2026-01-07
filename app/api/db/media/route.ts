import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireCompanyAuth } from "../_lib/auth";

export async function GET(request: Request) {
  const auth = await requireCompanyAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const messageId = searchParams.get("messageId") || "";
  const messageIdsRaw = searchParams.get("messageIds") || "";

  const params: unknown[] = [];
  const where: string[] = [];

  if (messageId) {
    params.push(messageId);
    where.push(`"messageId" = $${params.length}`);
  } else if (messageIdsRaw) {
    const list = messageIdsRaw.split(",").map((v) => v.trim()).filter(Boolean);
    if (list.length) {
      params.push(list);
      where.push(`"messageId" = ANY($${params.length})`);
    }
  }

  params.push(auth.companyId);
  where.push(
    `"messageId" IN (SELECT id FROM "Message" WHERE "instanceId" IN (SELECT id FROM "Instance" WHERE "companyId" = $${
      params.length
    }))`
  );

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const media = await query(
    `
      SELECT id, "fileName", type, mimetype, "messageId"
      FROM "Media"
      ${whereSql}
    `,
    params
  );

  return NextResponse.json({ media });
}
