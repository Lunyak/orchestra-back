import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StudioService } from './studio.service';

describe('dashboard studio invite acceptance', () => {
  it('requires an active addressed invite matching the JWT email', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const prisma = {
      studioInvite: { findFirst },
    } as unknown as PrismaService;
    const service = new StudioService(prisma);

    await expect(
      service.acceptAddressedInvite(
        'user-1',
        ' Person@Example.com ',
        'invite-1',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: 'invite-1',
        email: 'person@example.com',
        acceptedAt: null,
        declinedAt: null,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: expect.any(Date) } }],
      }),
    });
  });

  it('accepts exactly once and preserves an existing owner role', async () => {
    const invite = {
      id: 'invite-1',
      studioId: 'studio-1',
      email: 'person@example.com',
      role: 'student',
    };
    const tx = {
      studioInvite: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      studioMember: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'member-1',
          role: 'owner',
        }),
        update: jest.fn().mockResolvedValue({}),
        create: jest.fn(),
      },
    };
    const prisma = {
      studioInvite: { findFirst: jest.fn().mockResolvedValue(invite) },
      $transaction: jest.fn(
        (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
      ),
    } as unknown as PrismaService;
    const service = new StudioService(prisma);
    jest
      .spyOn(service, 'getStudio')
      .mockResolvedValue({ id: 'studio-1' } as never);

    await service.acceptAddressedInvite(
      'user-1',
      'person@example.com',
      'invite-1',
    );

    expect(tx.studioInvite.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.studioMember.update).toHaveBeenCalledWith({
      where: { id: 'member-1' },
      data: { userId: 'user-1', role: 'owner' },
    });
    expect(tx.studioMember.create).not.toHaveBeenCalled();
  });

  it('declines an addressed invite by email', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      studioInvite: { updateMany },
    } as unknown as PrismaService;
    const service = new StudioService(prisma);

    await expect(
      service.declineAddressedInvite(
        'user-1',
        'person@example.com',
        'invite-1',
      ),
    ).resolves.toEqual({ ok: true });
    expect(updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: 'invite-1',
        email: 'person@example.com',
        acceptedAt: null,
        declinedAt: null,
        revokedAt: null,
      }),
      data: { declinedAt: expect.any(Date) },
    });
  });
});
