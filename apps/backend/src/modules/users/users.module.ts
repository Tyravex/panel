import { Module } from '@nestjs/common';
// Service
import { UsersService } from './users.service';
import { PrismaService } from '@/prisma/prisma.service';
// Controller
import { UserController } from "@/modules/users/users.controller";
// Module
import { AuthModule } from "@/modules/auth/auth.module";
@Module({
  imports: [AuthModule],
  providers: [UsersService, PrismaService],
  controllers: [UserController],
  exports: [UsersService],
})

export class UsersModule {}