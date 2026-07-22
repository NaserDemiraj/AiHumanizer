import "server-only";
import { prisma } from "./db";
import { deleteFile } from "./storage";

/**
 * Scheduled maintenance. Two leaks build up over time that no request path
 * ever cleans on its own:
 *   1. Documents sit in the trash (deletedAt set) forever unless the owner
 *      permanently deletes them — their stored files and storage quota with
 *      them. We purge trash older than the retention window.
 *   2. Verification tokens (email verify / password reset) are single-use and
 *      short-lived, but expired and already-used ones are never removed.
 *
 * Sessions are already cleaned opportunistically on login (see auth.ts), so
 * they're not handled here.
 *
 * Invoke via GET/POST /api/cron/cleanup with the CRON_SECRET bearer token.
 */

/** Trashed documents older than this many days are purged for good. */
export const TRASH_RETENTION_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/** The cutoff date before which trashed documents are eligible for purge. */
export function trashCutoff(now: Date = new Date(), days = TRASH_RETENTION_DAYS): Date {
  return new Date(now.getTime() - days * DAY_MS);
}

export type CleanupResult = {
  documentsPurged: number;
  filesDeleted: number;
  storageReclaimed: number;
  tokensDeleted: number;
};

export async function runCleanup(now: Date = new Date()): Promise<CleanupResult> {
  const cutoff = trashCutoff(now);

  // Purge documents trashed before the cutoff, mirroring the permanent-delete
  // path in /api/documents/[id]: remove the stored file, delete the row (which
  // cascades to versions), and reclaim the owner's storage quota.
  const staleDocs = await prisma.document.findMany({
    where: { deletedAt: { not: null, lt: cutoff } },
    select: { id: true, userId: true, sourcePath: true, sourceBytes: true },
  });

  let filesDeleted = 0;
  let storageReclaimed = 0;

  for (const doc of staleDocs) {
    if (doc.sourcePath) {
      await deleteFile(doc.sourcePath).catch((err) =>
        console.error(`Cleanup: failed to delete file ${doc.sourcePath}:`, err),
      );
      filesDeleted++;
    }
    await prisma.$transaction([
      prisma.document.delete({ where: { id: doc.id } }),
      ...(doc.sourceBytes
        ? [
            prisma.user.update({
              where: { id: doc.userId },
              data: { storageBytes: { decrement: doc.sourceBytes } },
            }),
          ]
        : []),
    ]);
    if (doc.sourceBytes) storageReclaimed += doc.sourceBytes;
  }

  // Delete verification tokens that are expired or already used.
  const { count: tokensDeleted } = await prisma.verificationToken.deleteMany({
    where: { OR: [{ expiresAt: { lt: now } }, { usedAt: { not: null } }] },
  });

  return {
    documentsPurged: staleDocs.length,
    filesDeleted,
    storageReclaimed,
    tokensDeleted,
  };
}
