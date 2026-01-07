import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireCompanyAuth } from "../_lib/auth";

export async function GET(request: Request) {
  const auth = await requireCompanyAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const instanceId = searchParams.get("instanceId") || "";
  const search = searchParams.get("search") || "";
  const page = Number(searchParams.get("page") || 0);
  const pageSize = Number(searchParams.get("pageSize") || 25);
  const offset = Math.max(0, page) * Math.max(1, pageSize);

  const params: unknown[] = [];
  const where: string[] = [];

  params.push(auth.companyId);
  where.push(`"instanceId" IN (SELECT id FROM "Instance" WHERE "companyId" = $${params.length})`);

  if (instanceId) {
    params.push(instanceId);
    where.push(`"instanceId" = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    const p = `$${params.length}`;
    where.push(`("name" ILIKE ${p} OR "remoteJid" ILIKE ${p})`);
  }

  params.push(offset);
  params.push(pageSize);

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const sql = `
    SELECT id, "remoteJid", name, "unreadMessages", "updatedAt", "createdAt", "instanceId", labels
    FROM "Chat"
    ${whereSql}
    ORDER BY "updatedAt" DESC
    OFFSET $${params.length - 1}
    LIMIT $${params.length}
  `;

  const chats = await query(sql, params);
  return NextResponse.json({ chats });
}
