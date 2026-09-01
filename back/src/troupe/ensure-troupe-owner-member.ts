import { Prisma, TroupeMemberKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type TroupeOwnerMemberDb = Prisma.TransactionClient | PrismaService;

export async function ensureTroupeOwnerMember(
  db: TroupeOwnerMemberDb,
  troupeId: string,
  ownerUserId: string,
) {
  const user = await db.user.findUnique({
    where: { id: ownerUserId },
    select: { email: true },
  });
  const email = String(user?.email ?? '')
    .trim()
    .toLowerCase();
  if (!email) return;

  await db.troupeMember.upsert({
    where: { troupeId_email: { troupeId, email } },
    create: {
      troupeId,
      email,
      userId: ownerUserId,
      kind: TroupeMemberKind.regular,
    },
    update: { userId: ownerUserId },
  });
}
