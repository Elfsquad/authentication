import * as appAuthFlags from '@openid/appauth/built/flags';
import * as appAuthLogger from '@openid/appauth/built/logger';

/**
 * Console policy for the underlying OAuth library.
 *
 * `@openid/appauth` logs unconditionally: it ships `IS_LOG` hardcoded to `true`, so every
 * sign-in redirect prints the request object and target URL into the console of whatever
 * application embeds it. There is no option to turn that off from outside the bundle.
 *
 * That one flag is also the library's only volume control. Everything goes through a
 * single `log()` with no severity: the routine "Making a request to" on each redirect, and
 * equally the messages that report a sign-in actually failing. Flipping the flag off
 * silences both, which trades console noise for a silent failure.
 *
 * So this is a policy rather than a kill switch. Routine progress reporting is dropped;
 * the few messages that mean something went wrong are promoted to `console.warn` under
 * our own prefix, where they stand out instead of scrolling past. Verbose mode hands
 * logging back to the library verbatim, for anyone debugging a sign-in in detail.
 */

const flags = appAuthFlags as unknown as { IS_LOG: boolean };
const logger = appAuthLogger as unknown as {
    log: (message: string, ...args: unknown[]) => void;
};

/**
 * Messages that report a failure rather than progress, matched by prefix against
 * `@openid/appauth` 1.3.1 — pinned exactly in `package.json`, so the wording cannot drift
 * out from under this list on an incidental install:
 *
 * - `Mismatched request` — the response does not belong to the request that started it, so
 *   the handler discards it: the sign-in never completes and nothing else reports why.
 * - `Unable to generate PKCE challenge` — the authorization code exchange silently falls
 *   back to a weaker flow.
 * - `Notifier is not present` — no listener was registered on the request handler, so no
 *   authorization result can ever be delivered.
 *
 * Everything else the library logs is a step of a redirect that is going fine.
 */
const DIAGNOSTIC_PREFIXES = [
    'Mismatched request',
    'Unable to generate PKCE challenge',
    'Notifier is not present',
];

/** The library's own logger, kept so verbose mode can hand output straight back to it. */
const libraryLog = logger.log;

function isDiagnostic(message: string): boolean {
    return DIAGNOSTIC_PREFIXES.some(prefix => message.startsWith(prefix));
}

function applyConsolePolicy(message: string, ...args: unknown[]): void {
    // Verbose: the library's own behaviour, including its own `IS_LOG` check.
    if (flags.IS_LOG) {
        libraryLog(message, ...args);
        return;
    }

    if (isDiagnostic(message)) {
        console.warn(`[@elfsquad/authentication] ${message}`, ...args);
    }
}

/**
 * Quiet by default: a production console should carry no routine OAuth chatter.
 *
 * The library reads `IS_LOG` on every call rather than capturing it, and reaches its
 * logger through the module object, so both of these take effect at runtime. Assignment is
 * guarded because a future bundler could hand us a read-only namespace instead of the
 * module's own exports; the flag alone still keeps the console quiet in that case, so the
 * failure mode is the noise being gone and the diagnostics with it.
 */
flags.IS_LOG = false;
try {
    logger.log = applyConsolePolicy;
} catch {
    // Left as-is: `IS_LOG` above already silences the library.
}

/**
 * Enable or disable the OAuth library's own console logging.
 *
 * Disabled by default, which leaves only the failure diagnostics this package promotes to
 * `console.warn`. Enable it while debugging a sign-in to see every step the library
 * reports, at the level it reports them.
 */
export function setVerboseLogging(value: boolean): void {
    flags.IS_LOG = value;
}

/** Whether the OAuth library's own console logging is currently enabled. */
export function isVerboseLogging(): boolean {
    return flags.IS_LOG;
}
