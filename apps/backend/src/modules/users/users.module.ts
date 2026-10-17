import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { AdminUsersService } from './admin-users.service';
import { AdminUsersController } from './admin-users.controller';
import { PrismaService } from '@/prisma/prisma.service';
import { UserController } from '@/modules/users/users.controller';
import { AuthModule } from '@/modules/auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [UsersService, AdminUsersService, PrismaService],
  controllers: [UserController, AdminUsersController],
  exports: [UsersService],
})
export class UsersModule {}
