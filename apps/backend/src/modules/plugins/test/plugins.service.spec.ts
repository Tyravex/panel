import { NotFoundException } from "@nestjs/common";

import { PluginsService } from "../plugins.service";

describe("PluginsService admin registry", () => {
    const plugin = {
        id: "example.plugin",
        type: "LANGUAGE",
        version: "1.0.0",
        status: "INSTALLED",
        sourceRepository: null,
        installedAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    };

    const findMany = jest.fn();
    const findUnique = jest.fn();

    const prisma = {
        plugin: {
            findMany,
            findUnique,
        },
    };

    const service = new PluginsService(prisma as never);

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("lists plugins without selecting filesystem paths", async () => {
        findMany.mockResolvedValue([plugin]);

        await expect(service.listForAdmin()).resolves.toEqual([
            plugin,
        ]);

        expect(findMany).toHaveBeenCalledWith({
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
                installedAt: "desc",
            },
        });
    });

    it("returns safe metadata for an existing plugin", async () => {
        findUnique.mockResolvedValue(plugin);

        await expect(
            service.getForAdmin("example.plugin"),
        ).resolves.toEqual(plugin);

        expect(findUnique).toHaveBeenCalledWith({
            where: {
                id: "example.plugin",
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
    });

    it("throws 404 when the plugin does not exist", async () => {
        findUnique.mockResolvedValue(null);

        await expect(
            service.getForAdmin("missing.plugin"),
        ).rejects.toBeInstanceOf(NotFoundException);
    });
});
