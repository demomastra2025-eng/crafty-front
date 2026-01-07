import crypto from "crypto";
import { NextResponse } from "next/server";

import { query } from "@/lib/db";

type AuthResult = { companyId: string } | NextResponse;

const hashApiKey = (raw: string) =>
  crypto.createHash("sha256").update(raw).digest("hex");

export async function requireCompanyAuth(request: Request): Promise<AuthResult> {
  const apiKey = request.headers.get("apikey") || request.headers.get("x-evo-apikey");
  if (!apiKey) {
    return new NextResponse("Missing API key", { status: 401 });
  }

  const keyHash = hashApiKey(apiKey);
  const rows = await query<{ companyId: string; revokedAt: Date | null }>(
    `SELECT "companyId", "revokedAt" FROM "ApiKey" WHERE "keyHash" = $1 LIMIT 1`,
    [keyHash]
  );
  const key = rows[0];
  if (!key || key.revokedAt) {
    return new NextResponse("Invalid API key", { status: 401 });
  }

  return { companyId: key.companyId };
}
