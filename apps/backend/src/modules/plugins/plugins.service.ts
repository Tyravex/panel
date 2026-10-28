import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '@/prisma/prisma.service';

import {
  loadLanguagePlugin,
  type LoadedLanguagePlugin,
} from './language-plugin-loader';

@Injectable()
export class PluginsService {
  constructor(
    private readonly prisma: PrismaService,
  ) { }

  /**
   * Returns installed plugins for the administration panel.
   * Internal filesystem paths are never exposed.
   */
  listForAdmin() {
    return this.prisma.plugin.findMany({
      select: {
        id: true,
        type: true,
        version: true,
        status: true,
        sourceRepository: true,
        installedAt: true,
        updatedAt: true,
      },
      orderBy: {
        installedAt: 'desc',
      },
    });
  }

  /**
   * Returns safe metadata for a single plugin.
   */
  async getForAdmin(id: string) {
    const plugin = await this.prisma.plugin.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        type: true,
        version: true,
        status: true,
        sourceRepository: true,
        installedAt: true,
        updatedAt: true,
      },
    });

    if (!plugin) {
      throw new NotFoundException(
        'Plugin not found',
      );
    }

    return plugin;
  }

  /**
   * Finds a locally registered plugin.
   *
   * A database record alone does not prove
   * that the plugin files are valid or trusted.
   */
  async findById(id: string) {
    return this.prisma.plugin.findUnique({
      where: {
        id,
      },
    });
  }

  /**
   * Finds a language plugin marked as installed.
   */
  async findInstalledLanguagePlugin(id: string) {
    return this.prisma.plugin.findFirst({
      where: {
        id,
        type: 'LANGUAGE',
        status: 'INSTALLED',
      },
    });
  }

  /**
   * Loads a language plugin and verifies that its
   * manifest matches the database registry.
   *
   * Only enabled languages may be loaded.
   */
  async loadEnabledLanguagePlugin(
    languageCode: string,
  ): Promise<LoadedLanguagePlugin | null> {
    const language = await this.prisma.language.findFirst({
      where: {
        code: languageCode,
        isEnabled: true,
        isBuiltIn: false,
        pluginId: {
          not: null,
        },
      },
      select: {
        code: true,
        pluginId: true,
      },
    });

    if (!language?.pluginId) {
      return null;
    }

    const plugin = await this.findInstalledLanguagePlugin(
      language.pluginId,
    );

    if (!plugin) {
      return null;
    }

    const loaded = await loadLanguagePlugin(
      plugin.storagePath,
    );

    if (
      loaded.manifest.id !== plugin.id ||
      loaded.manifest.version !== plugin.version ||
      loaded.manifest.language.code !== language.code
    ) {
      throw new Error(
        'Language plugin manifest does not match the registry.',
      );
    }

    return loaded;
  }
}
