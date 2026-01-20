import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireCompanyAuth } from "../_lib/auth";

export async function GET(request: Request) {
  const auth = await requireCompanyAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const instanceId = searchParams.get("instanceId") || "";
  const remoteJid = searchParams.get("remoteJid") || "";
  const remoteJidsRaw = searchParams.get("remoteJids") || "";
  const recent = searchParams.get("recent") === "true";
  const order = (searchParams.get("order") || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";
  const limit = Math.min(Number(searchParams.get("limit") || 50), 1000);
  const before = Number(searchParams.get("before") || 0);

  const where: string[] = [];
  const params: unknown[] = [];

  params.push(auth.companyId);
  where.push(`"instanceId" IN (SELECT id FROM "Instance" WHERE "companyId" = $${params.length})`);

  if (instanceId) {
    params.push(instanceId);
    where.push(`"instanceId" = $${params.length}`);
  }

  if (!recent && remoteJid) {
    params.push(remoteJid);
    const p = `$${params.length}`;
    where.push(`(key->>'remoteJid' = ${p} OR key->>'remoteJidAlt' = ${p})`);
  }

  if (!recent && remoteJidsRaw) {
    const list = remoteJidsRaw.split(",").map((v) => v.trim()).filter(Boolean);
    if (list.length) {
      params.push(list);
      const p = `$${params.length}`;
      where.push(`(key->>'remoteJid' = ANY(${p}) OR key->>'remoteJidAlt' = ANY(${p}))`);
    }
  }

  if (before > 0) {
    params.push(before);
    where.push(`"messageTimestamp" < $${params.length}`);
  }

  params.push(limit);
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const sql = `
    SELECT id, key, message, "messageTimestamp", "pushName", status, source, author, "messageType", "instanceId", "sessionId"
    FROM "Message"
    ${whereSql}
    ORDER BY "messageTimestamp" ${order}
    LIMIT $${params.length}
  `;

  const messages = await query(sql, params);
  return NextResponse.json({ messages });
}
