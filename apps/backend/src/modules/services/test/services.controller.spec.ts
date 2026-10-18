import { GUARDS_METADATA, PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ServicesController } from '../services.controller';
import { ServicesService } from '../services.service';

describe('ServicesController security', () => {
    const getUserServices = jest.fn();
    let controller: ServicesController;

    beforeEach(() => {
        jest.resetAllMocks();
        controller = new ServicesController({ getUserServices } as unknown as ServicesService);
    });

    it('requires JWT authentication at controller level', () => {
        expect(Reflect.getMetadata(GUARDS_METADATA, ServicesController)).toEqual([JwtAuthGuard]);
    });

    it('exposes the services route', () => {
        expect(Reflect.getMetadata(PATH_METADATA, ServicesController)).toBe('services');
    });

    it('exposes a GET endpoint for listing services', () => {
        expect(Reflect.getMetadata(PATH_METADATA, controller.getUserServices)).toBe('/');
        expect(Reflect.getMetadata(METHOD_METADATA, controller.getUserServices)).toBe(RequestMethod.GET);
    });

    it('uses the authenticated user ID rather than request query parameters', async () => {
        const services = [{ id: 10, userId: 7 }];
        getUserServices.mockResolvedValue(services);
        const request = { user: { id: 7 }, query: { userId: '999' } } as any;

        await expect(controller.getUserServices(request)).resolves.toBe(services);
        expect(getUserServices).toHaveBeenCalledTimes(1);
        expect(getUserServices).toHaveBeenCalledWith(7);
    });

    it('does not substitute another identity when the service rejects', async () => {
        getUserServices.mockRejectedValue(new Error('Database unavailable'));
        await expect(controller.getUserServices({ user: { id: 11 } } as any))
            .rejects.toThrow('Database unavailable');
        expect(getUserServices).toHaveBeenCalledWith(11);
    });
});
