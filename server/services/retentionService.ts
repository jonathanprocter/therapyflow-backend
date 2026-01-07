import { db } from "../db";
import { auditLogs, jobRuns, documentTextVersions } from "@shared/schema";
import { sql } from "drizzle-orm";

export interface RetentionReport {
  cutoffDate: Date;
  auditLogs: number;
  jobRuns: number;
  documentTextVersions: number;
}

export async function buildRetentionReport(retentionDays: number): Promise<RetentionReport> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  const [{ count: auditCount }] = await db
    .select({ count: sql`count(*)::int` })
    .from(auditLogs)
    .where(sql`${auditLogs.timestamp} < ${cutoffDate}`);

  const [{ count: jobCount }] = await db
    .select({ count: sql`count(*)::int` })
    .from(jobRuns)
    .where(sql`${jobRuns.createdAt} < ${cutoffDate}`);

  const [{ count: versionCount }] = await db
    .select({ count: sql`count(*)::int` })
    .from(documentTextVersions)
    .where(sql`${documentTextVersions.createdAt} < ${cutoffDate}`);

  return {
    cutoffDate,
    auditLogs: auditCount as any,
    jobRuns: jobCount as any,
    documentTextVersions: versionCount as any,
  };
}

export async function applyRetention(retentionDays: number) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  const auditResult = await db
    .delete(auditLogs)
    .where(sql`${auditLogs.timestamp} < ${cutoffDate}`);

  const jobResult = await db
    .delete(jobRuns)
    .where(sql`${jobRuns.createdAt} < ${cutoffDate}`);

  const versionResult = await db
    .delete(documentTextVersions)
    .where(sql`${documentTextVersions.createdAt} < ${cutoffDate}`);

  return {
    cutoffDate,
    auditDeleted: auditResult.rowCount || 0,
    jobsDeleted: jobResult.rowCount || 0,
    versionsDeleted: versionResult.rowCount || 0,
  };
}
