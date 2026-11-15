export type ServiceKind = 'game' | 'bot' | 'voice' | 'other';

/** Classify backend category keys without changing persisted category identifiers. */
export function getServiceKind(categoryKey?: string | null): ServiceKind {
    switch (categoryKey?.trim().toLowerCase()) {
        case 'server':
        case 'game':
        case 'game_server':
            return 'game';
        case 'discord_bot':
        case 'telegram_bot':
        case 'bot':
            return 'bot';
        case 'voice':
        case 'voice_server':
        case 'teamspeak':
        case 'teamspeak3':
        case 'ts3':
            return 'voice';
        default:
            return 'other';
    }
}
