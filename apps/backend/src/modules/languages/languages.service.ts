import { Injectable } from '@nestjs/common';

import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class LanguagesService {
  constructor(
    private readonly prisma: PrismaService,
  ) { }

  /**
   * Returns languages currently available for selection.
   *
   * Built-in languages remain independent of plugin status.
   * Plugin languages require an installed, enabled plugin.
   */
  async findEnabled() {
    return this.prisma.language.findMany({
      where: {
        isEnabled: true,
        OR: [
          {
            isBuiltIn: true,
          },
          {
            isBuiltIn: false,
            plugin: {
              is: {
                type: 'LANGUAGE',
                status: 'INSTALLED',
              },
            },
          },
        ],
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
   * Returns language options for frontend selectors.
   *
   * Disabled plugin languages remain visible, but cannot
   * be selected. Uninstalled plugins are excluded.
   *
   * This method does not expose plugin storage paths
   * or other internal plugin metadata.
   */
  async findAvailableOptions() {
    const languages = await this.prisma.language.findMany({
      where: {
        OR: [
          {
            isBuiltIn: true,
          },
          {
            isBuiltIn: false,
            plugin: {
              is: {
                type: 'LANGUAGE',
                status: {
                  in: ['INSTALLED', 'DISABLED'],
                },
              },
            },
          },
        ],
      },
      select: {
        code: true,
        name: true,
        isBuiltIn: true,
        isEnabled: true,
        plugin: {
          select: {
            status: true,
          },
        },
      },
      orderBy: {
        code: 'asc',
      },
    });

    return languages.map((language) => ({
      code: language.code,
      name: language.name,
      enabled: language.isEnabled && (
        language.isBuiltIn ||
        language.plugin?.status === 'INSTALLED'
      ),
    }));
  }

  /**
   * Finds an enabled language provided by an installed
   * language plugin.
   *
   * Built-in languages are excluded because their
   * translations are bundled with the frontend.
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
        plugin: {
          is: {
            type: 'LANGUAGE',
            status: 'INSTALLED',
          },
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