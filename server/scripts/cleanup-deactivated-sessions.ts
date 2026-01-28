/**
 * Cleanup script to remove orphaned "Client deactivated" sessions
 *
 * This script finds sessions with "Client deactivated" notes and:
 * 1. Deletes sessions where the client no longer exists (deleted client)
 * 2. Reports sessions that might need manual review
 *
 * Run with: npx ts-node server/scripts/cleanup-deactivated-sessions.ts
 */

import { db } from "../db";
import { sessions, clients } from "../../shared/schema";
import { eq, like, isNull, and, sql } from "drizzle-orm";

async function cleanupDeactivatedSessions() {
  console.log("🔍 Searching for sessions with 'Client deactivated' notes...\n");

  // Find all sessions with "Client deactivated" notes
  const deactivatedSessions = await db
    .select({
      sessionId: sessions.id,
      clientId: sessions.clientId,
      scheduledAt: sessions.scheduledAt,
      status: sessions.status,
      notes: sessions.notes,
    })
    .from(sessions)
    .where(like(sessions.notes, '%Client deactivated%'));

  console.log(`Found ${deactivatedSessions.length} sessions with 'Client deactivated' notes\n`);

  if (deactivatedSessions.length === 0) {
    console.log("✅ No cleanup needed!");
    return;
  }

  // For each session, check if the client still exists and is active
  let deletedCount = 0;
  let orphanedCount = 0;
  const sessionsToReview: typeof deactivatedSessions = [];

  for (const session of deactivatedSessions) {
    const client = await db
      .select({
        id: clients.id,
        name: clients.name,
        status: clients.status,
      })
      .from(clients)
      .where(eq(clients.id, session.clientId))
      .limit(1);

    if (client.length === 0) {
      // Client doesn't exist - delete the orphaned session
      console.log(`🗑️  Deleting orphaned session ${session.sessionId} (client ${session.clientId.substring(0, 8)}... not found)`);
      await db.delete(sessions).where(eq(sessions.id, session.sessionId));
      orphanedCount++;
      deletedCount++;
    } else if (client[0].status === 'deleted') {
      // Client is marked as deleted - delete associated session
      console.log(`🗑️  Deleting session ${session.sessionId} for deleted client ${client[0].name}`);
      await db.delete(sessions).where(eq(sessions.id, session.sessionId));
      deletedCount++;
    } else {
      // Client exists and is active - this session needs review
      console.log(`⚠️  Session ${session.sessionId} for active client ${client[0].name} has 'Client deactivated' notes - needs review`);
      sessionsToReview.push(session);
    }
  }

  console.log("\n📊 Cleanup Summary:");
  console.log(`   Orphaned sessions deleted: ${orphanedCount}`);
  console.log(`   Deleted client sessions removed: ${deletedCount - orphanedCount}`);
  console.log(`   Sessions needing manual review: ${sessionsToReview.length}`);

  if (sessionsToReview.length > 0) {
    console.log("\n⚠️  Sessions needing manual review:");
    for (const session of sessionsToReview) {
      console.log(`   - Session ${session.sessionId} (${session.scheduledAt.toISOString().split('T')[0]})`);
    }
    console.log("\n   These sessions have 'Client deactivated' notes but the client is still active.");
    console.log("   You may want to manually update or delete these sessions.");
  }

  console.log("\n✅ Cleanup complete!");
}

// Run the cleanup
cleanupDeactivatedSessions()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Cleanup failed:", error);
    process.exit(1);
  });
