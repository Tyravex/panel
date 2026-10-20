import { Injectable } from '@nestjs/common';

import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class LanguagesService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Returns languages enabled on this Tyravex instance.
   *
   * Used by the public GET /languages endpoint.
   */
  async findEnabled() {
    return this.prisma.language.findMany({
      where: {
        isEnabled: true,
      },
      select: {
        code: true,
        name: true,
      },
      orderBy: {
        code: 'asc',
      },
    });
  }

  /**
   * Finds an enabled language provided by a plugin.
   *
   * Built-in languages are excluded because their
   * translation resources are bundled with the frontend.
   *
   * This method does not load plugin files.
   */
  async findEnabledPluginLanguage(code: string) {
    return this.prisma.language.findFirst({
      where: {
        code,
        isEnabled: true,
        isBuiltIn: false,
        pluginId: {
          not: null,
        },
      },
      select: {
        code: true,
        name: true,
        pluginId: true,
      },
    });
  }
}
