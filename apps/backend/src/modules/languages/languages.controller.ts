import {
  Controller,
  Get,
  InternalServerErrorException,
  NotFoundException,
  Param,
} from '@nestjs/common';

import { PluginsService } from '@/modules/plugins/plugins.service';

import { LanguagesService } from './languages.service';

@Controller('languages')
export class LanguagesController {
  constructor(
    private readonly languagesService: LanguagesService,
    private readonly pluginsService: PluginsService,
  ) {}

  /**
   * Returns enabled languages available on this instance.
   */
  @Get()
  async findEnabled() {
    return this.languagesService.findEnabled();
  }

  /**
   * Returns translations for an enabled language plugin.
   *
   * Built-in languages are bundled with the frontend.
   */
  @Get(':code/translations')
  async getPluginTranslations(
    @Param('code') code: string,
  ) {
    try {
      const plugin = await this.pluginsService.loadEnabledLanguagePlugin(
        code,
      );

      if (!plugin) {
        throw new NotFoundException(
          'Language translations are not available.',
        );
      }

      return plugin.translations;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Unable to load language translations.',
      );
    }
  }
}
