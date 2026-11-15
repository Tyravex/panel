import { describe, expect, it } from 'vitest';
import { getServiceKind } from './serviceKind';
import { countServiceCategories } from './countServiceCategories';
import type { UserService } from '../api/services.api';

describe('Hosted service classification', () => {
    it.each([
        ['server', 'game'], ['game_server', 'game'], ['game', 'game'],
        ['discord_bot', 'bot'], ['telegram_bot', 'bot'], ['bot', 'bot'],
        ['teamspeak3', 'voice'], ['voice_server', 'voice'], ['ts3', 'voice'],
        ['unknown', 'other'], [null, 'other'], [' GAME_SERVER ', 'game'],
    ])('classifies %s as %s', (category, kind) => {
        expect(getServiceKind(category)).toBe(kind);
    });

    it('counts every workload once, including aliases and unknown categories', () => {
        const services = ['server', 'game_server', 'discord_bot', 'telegram_bot', 'teamspeak', 'custom', null]
            .map((key) => ({ category: key ? { key } : null })) as UserService[];
        const counts = countServiceCategories(services);
        expect(counts).toEqual({ game: 2, bot: 2, voice: 1, other: 2 });
        expect(Object.values(counts).reduce((sum, count) => sum + count, 0)).toBe(services.length);
    });
});
