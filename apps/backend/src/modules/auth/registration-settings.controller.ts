import { BadRequestException, Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Permissions } from '@/rbac/decorators/permissions.decorator';
import { PermissionsGuard } from '@/rbac/guards/permissions.guard';
import { RegistrationSettingsService } from './registration-settings.service';

@Controller('admin/registration-settings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RegistrationSettingsController {
    constructor(private readonly settings: RegistrationSettingsService) { }

    @Get()
    @Permissions('user:manage')
    async get() {
        return { registrationEnabled: await this.settings.isRegistrationEnabled() };
    }

    @Patch()
    @Permissions('user:manage')
    async update(@Body() body: unknown, @Req() req: { user: { id: number } }) {
        // Reject unknown fields and non-boolean values independently of global pipes.
        if (
            !body || typeof body !== 'object' || Array.isArray(body) ||
            Object.keys(body).length !== 1 ||
            !Object.prototype.hasOwnProperty.call(body, 'registrationEnabled') ||
            typeof (body as { registrationEnabled?: unknown }).registrationEnabled !== 'boolean'
        ) {
            throw new BadRequestException('Expected registrationEnabled boolean only');
        }
        return this.settings.setRegistrationEnabled(
            (body as { registrationEnabled: boolean }).registrationEnabled,
            req.user.id,
        );
    }
}
