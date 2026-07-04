"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { syncYaserMallLiveProducts } from "@/lib/yaser-mall-live";

export async function syncLiveCheckItems() {
  await requireUser();
  const result = await syncYaserMallLiveProducts({ maxProducts: 120 });
  revalidatePath("/employee");
  if (result.warning) redirect("/employee?syncError=" + encodeURIComponent(result.warning));
  redirect("/employee?synced=" + result.saved);
}
