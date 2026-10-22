import { ForbiddenException } from '@nestjs/common';
import { ServicesController } from '../services.controller';
import { ServicesService } from '../services.service';

const request = (roles: string[], permissions: string[]) => ({
    user: { id: 1, roles, permissions },
}) as any;

describe('Services administration authorization', () => {
    const createService = jest.fn();
    const setOwner = jest.fn();
    const getAllServices = jest.fn();
    let controller: ServicesController;

    beforeEach(() => {
        jest.resetAllMocks();
        controller = new ServicesController({
            createService, setOwner, getAllServices,
        } as unknown as ServicesService);
    });

    it('rejects regular users even with legacy server:create', () => {
        expect(() => controller.createService(request(['User'], ['server:create']), {
            name: 'Example', categoryKey: 'server',
        })).toThrow(ForbiddenException);
        expect(createService).not.toHaveBeenCalled();
    });

    it('rejects non-Owner roles even with service:create', () => {
        expect(() => controller.createService(request(['User'], ['service:create']), {
            name: 'Example', categoryKey: 'server',
        })).toThrow(ForbiddenException);
    });

    it('allows Owner with service:create to create an unassigned draft', () => {
        const dto = { name: 'Example', categoryKey: 'server', userId: null };
        controller.createService(request(['Owner'], ['service:create']), dto);
        expect(createService).toHaveBeenCalledWith(1, dto);
    });

    it('rejects owner changes without administrative management permission', () => {
        expect(() => controller.setOwner(request(['Owner'], ['service:create']), 'svc', {
            userId: 2,
        })).toThrow(ForbiddenException);
        expect(setOwner).not.toHaveBeenCalled();
    });

    it('allows Owner with service:manage:any to unassign an owner', () => {
        controller.setOwner(request(['Owner'], ['service:manage:any']), 'svc', {
            userId: null,
        });
        expect(setOwner).toHaveBeenCalledWith('svc', 1, { userId: null });
    });

    it('protects the all-services listing', () => {
        expect(() => controller.getAllServices(request(['User'], ['service:manage:any'])))
            .toThrow(ForbiddenException);
        controller.getAllServices(request(['Owner'], ['service:manage:any']));
        expect(getAllServices).toHaveBeenCalledTimes(1);
    });
});
