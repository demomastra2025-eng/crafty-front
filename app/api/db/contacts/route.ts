import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireCompanyAuth } from "../_lib/auth";

export async function GET(request: Request) {
  const auth = await requireCompanyAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const instanceId = searchParams.get("instanceId") || "";

  const params: unknown[] = [];
  const where: string[] = [];

  params.push(auth.companyId);
  where.push(`"instanceId" IN (SELECT id FROM "Instance" WHERE "companyId" = $${params.length})`);

  if (instanceId) {
    params.push(instanceId);
    where.push(`"instanceId" = $${params.length}`);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const contacts = await query(
    `
      SELECT id, "remoteJid", "pushName", "profilePicUrl", "createdAt", "instanceId"
      FROM "Contact"
      ${whereSql}
    `,
    params
  );

  return NextResponse.json({ contacts });
}
