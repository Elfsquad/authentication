/**
 * Enable or disable the OAuth library's own console logging.
 *
 * Disabled by default, which leaves only the failure diagnostics this package promotes to
 * `console.warn`. Enable it while debugging a sign-in to see every step the library
 * reports, at the level it reports them.
 */
export declare function setVerboseLogging(value: boolean): void;
/** Whether the OAuth library's own console logging is currently enabled. */
export declare function isVerboseLogging(): boolean;
