import { Logger } from '@nestjs/common';

type Level = 'log' | 'warn' | 'error';

/** Intercept only explicitly expected NestJS messages in one test suite. */
export function expectTestLogs(patterns: Partial<Record<Level, readonly string[]>>) {
    const spies: Array<jest.SpyInstance> = [];
    const seen: string[] = [];

    for (const level of ['log', 'warn', 'error'] as const) {
        const expected = patterns[level];
        if (!expected?.length) continue;

        const original = Logger.prototype[level];
        const spy = jest.spyOn(Logger.prototype, level).mockImplementation(
            function (this: Logger, ...args: Parameters<typeof original>) {
                const rendered = args.map((value) =>
                    value instanceof Error ? value.message : String(value),
                ).join(' ');
                if (expected.some((fragment) => rendered.includes(fragment))) {
                    seen.push(`${level.toUpperCase()}: ${rendered.split('\n')[0]}`);
                    return;
                }
                return original.apply(this, args);
            },
        );
        spies.push(spy);
    }

    return {
        restore() {
            for (const spy of spies.reverse()) spy.mockRestore();
            if (process.env.TEST_VERBOSE_ERRORS === '1' && seen.length) {
                for (const message of [...new Set(seen)]) {
                    console.info(`[EXPECTED] ${message} — OK`);
                }
            }
        },
    };
}

/** Backward compatibility for the heartbeat test introduced in an earlier patch. */
export function captureExpectedLog(level: 'error' | 'warn' | 'log', fragment: string, test: string) {
    const original = Logger.prototype[level];
    let count = 0;
    const spy = jest.spyOn(Logger.prototype, level).mockImplementation(
        function (this: Logger, ...args: Parameters<typeof original>) {
            if (args.map(String).join(' ').includes(fragment)) { count++; return; }
            return original.apply(this, args);
        },
    );
    return {
        verify() { expect(count).toBeGreaterThan(0); },
        report() {
            if (process.env.TEST_VERBOSE_ERRORS === '1')
                console.info(`[EXPECTED ERROR] TEST: ${test} — OK`);
        },
        restore() { spy.mockRestore(); },
    };
}
