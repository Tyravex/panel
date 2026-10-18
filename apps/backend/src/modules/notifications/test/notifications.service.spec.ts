import { NotificationsService } from '../notifications.service';
import { PrismaService } from '@/prisma/prisma.service';

describe('NotificationsService', () => {
  const updateMany = jest.fn();

  const service = new NotificationsService({
    notification: { updateMany },
  } as unknown as PrismaService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('marks a notification as read only for its owner', async () => {
    updateMany.mockResolvedValue({ count: 1 });

    await expect(service.markAsRead(10, 2)).resolves.toBe(true);

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 10, userId: 2 },
      data: { read: true },
    });
  });

  it('does not report success when no owned notification matches', async () => {
    updateMany.mockResolvedValue({ count: 0 });

    await expect(service.markAsRead(10, 2)).resolves.toBe(false);

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 10, userId: 2 },
      data: { read: true },
    });
  });

  it('rejects invalid IDs without querying the database', async () => {
    await expect(service.markAsRead(0, 2)).resolves.toBeNull();
    await expect(service.markAsRead(10, 0)).resolves.toBeNull();

    expect(updateMany).not.toHaveBeenCalled();
  });
});
