import { db } from "../db";
import { appSettings } from "@shared/schema";
import { eq } from "drizzle-orm";

export async function getAppSetting<T = any>(key: string): Promise<T | null> {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, key));
  return (row?.value as T) ?? null;
}

export async function setAppSetting(key: string, value: any): Promise<void> {
  const existing = await db.select().from(appSettings).where(eq(appSettings.key, key));
  if (existing.length > 0) {
    await db
      .update(appSettings)
      .set({ value, updatedAt: new Date() })
      .where(eq(appSettings.key, key));
    return;
  }

  await db.insert(appSettings).values({ key, value, updatedAt: new Date() });
}
