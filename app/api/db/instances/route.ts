import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireCompanyAuth } from "../_lib/auth";

export async function GET(request: Request) {
  const auth = await requireCompanyAuth(request);
  if (auth instanceof NextResponse) return auth;

  const instances = await query(
    `SELECT id, name, "connectionStatus" FROM "Instance" WHERE "companyId" = $1`,
    [auth.companyId]
  );
  return NextResponse.json({ instances });
}
