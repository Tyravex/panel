import {
    HttpException,
    InternalServerErrorException,
} from '@nestjs/common';

/**
 * Converts unexpected installation failures into safe
 * HTTP responses without exposing internal error details.
 *
 * Validation and conflict exceptions retain their status.
 */
export function mapPluginInstallError(
    error: unknown,
): HttpException {
    if (error instanceof HttpException) {
        return error;
    }

    return new InternalServerErrorException(
        'Plugin installation failed.',
    );
}