import type { PrismaClient } from '@prisma/client';

type PrismaLike = Pick<PrismaClient, 'project'>;

/** Bumps Project.updatedAt to mark content activity (sync / REST writers). */
export async function touchProjectActivity(
  prisma: PrismaLike,
  projectId: string | null | undefined,
): Promise<void> {
  const id = typeof projectId === 'string' ? projectId.trim() : '';
  if (!id) return;

  await prisma.project.updateMany({
    where: { id, deletedAt: null },
    data: { updatedAt: new Date() },
  });
}

export async function touchProjectsActivity(
  prisma: PrismaLike,
  projectIds: Iterable<string>,
): Promise<void> {
  const uniqueIds = [
    ...new Set(
      [...projectIds]
        .map((id) => (typeof id === 'string' ? id.trim() : ''))
        .filter(Boolean),
    ),
  ];
  if (!uniqueIds.length) return;

  await Promise.all(
    uniqueIds.map((projectId) => touchProjectActivity(prisma, projectId)),
  );
}
