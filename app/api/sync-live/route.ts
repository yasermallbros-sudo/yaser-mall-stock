import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { syncYaserMallLiveProducts } from "@/lib/yaser-mall-live";

export async function POST() {
  await requireUser();
  const result = await syncYaserMallLiveProducts({ maxProducts: 120 });
  return NextResponse.json(result, { status: result.warning ? 400 : 200 });
}
