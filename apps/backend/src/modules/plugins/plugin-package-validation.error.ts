
export class PluginPackageValidationError extends Error {
    constructor(message = 'Invalid plugin package.') {
        super(message);

        this.name = 'PluginPackageValidationError';

        Object.setPrototypeOf(
            this,
            PluginPackageValidationError.prototype,
        );
    }
}
