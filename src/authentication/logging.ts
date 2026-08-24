import * as appAuthFlags from '@openid/appauth/built/flags';

/**
 * Console policy for the underlying OAuth library.
 *
 * `@openid/appauth` logs unconditionally: it ships `IS_LOG` hardcoded to `true`, so every
 * sign-in redirect prints the request object and target URL into the console of whatever
 * application embeds it. There is no option to turn that off from outside the bundle.
 *
 * Its logger reads the flag on each call rather than capturing it, so flipping the flag is
 * enough to silence the library — and to turn it back on when someone is actually
 * debugging a sign-in.
 */

const flags = appAuthFlags as unknown as { IS_LOG: boolean };

/** Quiet by default: a production console should carry no routine OAuth chatter. */
let verbose = false;
flags.IS_LOG = verbose;

/**
 * Enable or disable the OAuth library's console logging.
 *
 * Disabled by default. Enable it while diagnosing a sign-in problem to see the request
 * details the library reports.
 */
export function setVerboseLogging(value: boolean): void {
    verbose = value;
    flags.IS_LOG = value;
}

/** Whether the OAuth library's console logging is currently enabled. */
export function isVerboseLogging(): boolean {
    return verbose;
}
