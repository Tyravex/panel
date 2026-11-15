import { ForbiddenException } from '@nestjs/common';
import { ServicesController } from '../services.controller';
import { ServicesService } from '../services.service';

const request = (roles: string[], permissions: string[]) => ({
    user: { id: 1, roles, permissions },
}) as any;

describe('Services administration authorization RBAC v2', () => {
    const createService = jest.fn();
    const setOwner = jest.fn();
    const getAllServices = jest.fn();

    let controller: ServicesController;

    beforeEach(() => {
        jest.resetAllMocks();

        controller = new ServicesController({
            createService,
            setOwner,
            getAllServices,
        } as unknown as ServicesService);
    });

    describe('POST /services', () => {
        const dto = {
            name: 'Example',
            categoryKey: 'server',
            userId: null,
        };

        it('rejects legacy server:create alone', () => {
            expect(() =>
                controller.createService(
                    request(['Owner'], ['server:create']),
                    dto,
                ),
            ).toThrow(ForbiddenException);

            expect(createService).not.toHaveBeenCalled();
        });

        it('rejects Owner without service:create', () => {
            expect(() =>
                controller.createService(request(['Owner'], []), dto),
            ).toThrow(ForbiddenException);

            expect(createService).not.toHaveBeenCalled();
        });

        it('rejects service:manage:any without service:create', () => {
            expect(() =>
                controller.createService(
                    request(['Administrator'], ['service:manage:any']),
                    dto,
                ),
            ).toThrow(ForbiddenException);

            expect(createService).not.toHaveBeenCalled();
        });

        it.each(['Owner', 'Administrator', 'CustomRole'])(
            'allows %s with service:create',
            (role) => {
                controller.createService(
                    request([role], ['service:create']),
                    dto,
                );

                expect(createService).toHaveBeenCalledWith(1, dto);
            },
        );
    });

    describe('GET /services/admin/all', () => {
        it('rejects Owner without service:read:any', () => {
            expect(() =>
                controller.getAllServices(request(['Owner'], [])),
            ).toThrow(ForbiddenException);

            expect(getAllServices).not.toHaveBeenCalled();
        });

        it('does not substitute service:manage:any for read', () => {
            expect(() =>
                controller.getAllServices(
                    request(['Administrator'], ['service:manage:any']),
                ),
            ).toThrow(ForbiddenException);

            expect(getAllServices).not.toHaveBeenCalled();
        });

        it.each(['Owner', 'Moderator', 'CustomRole'])(
            'allows %s with service:read:any',
            (role) => {
                controller.getAllServices(
                    request([role], ['service:read:any']),
                );

                expect(getAllServices).toHaveBeenCalledTimes(1);
            },
        );
    });

    describe('PATCH /services/:id/owner', () => {
        const dto = { userId: null };

        it('rejects Owner without service:transfer:any', () => {
            expect(() =>
                controller.setOwner(
                    request(['Owner'], ['service:manage:any']),
                    'svc',
                    dto,
                ),
            ).toThrow(ForbiddenException);

            expect(setOwner).not.toHaveBeenCalled();
        });

        it('rejects service:create without transfer permission', () => {
            expect(() =>
                controller.setOwner(
                    request(['Administrator'], ['service:create']),
                    'svc',
                    dto,
                ),
            ).toThrow(ForbiddenException);

            expect(setOwner).not.toHaveBeenCalled();
        });

        it.each(['Owner', 'Administrator', 'CustomRole'])(
            'allows %s with service:transfer:any',
            (role) => {
                controller.setOwner(
                    request([role], ['service:transfer:any']),
                    'svc',
                    dto,
                );

                expect(setOwner).toHaveBeenCalledWith(
                    'svc',
                    1,
                    dto,
                );
            },
        );
    });
});