import 'jest';
import * as appAuthFlags from '@openid/appauth/built/flags';
import { log } from '@openid/appauth/built/logger';
import { isVerboseLogging, setVerboseLogging } from '..';

const flags = appAuthFlags as unknown as { IS_LOG: boolean };

const ROUTINE = 'Making a request to ';
const MISMATCH = 'Mismatched request (state and request_uri) dont match.';
const PKCE = 'Unable to generate PKCE challenge. Not using PKCE';
const NO_NOTIFIER = 'Notifier is not present on AuthorizationRequest handler.';

describe('OAuth library console policy', function() {

    afterEach(() => {
        setVerboseLogging(false);
        jest.restoreAllMocks();
    });

    it('is quiet by default, so importing the package does not enable library logging', () => {
        // Loaded fresh rather than read after the fact: the default has to come from the
        // module's own import-time assignment, not from another test's teardown.
        jest.resetModules();
        const { isVerboseLogging: freshIsVerboseLogging } = require('..');
        const freshFlags = require('@openid/appauth/built/flags') as { IS_LOG: boolean };

        expect(freshIsVerboseLogging()).toBe(false);
        expect(freshFlags.IS_LOG).toBe(false);
    });

    it('reports whether verbose logging is enabled', () => {
        setVerboseLogging(true);
        expect(isVerboseLogging()).toBe(true);

        setVerboseLogging(false);
        expect(isVerboseLogging()).toBe(false);
    });

    it('reads the library flag rather than a copy of it, so it cannot report a stale value', () => {
        flags.IS_LOG = true;
        expect(isVerboseLogging()).toBe(true);
    });

    it('drops the routine progress the library reports on every redirect', () => {
        const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        log(ROUTINE, { request: true }, 'https://example.test/authorize');

        expect(logSpy).not.toHaveBeenCalled();
        expect(warnSpy).not.toHaveBeenCalled();
    });

    it.each([
        ['a response that does not match its request', MISMATCH],
        ['PKCE being unavailable', PKCE],
        ['no notifier being registered', NO_NOTIFIER],
    ])('still reports %s while quiet', (_description, message) => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        log(message);

        expect(warnSpy).toHaveBeenCalledWith(`[@elfsquad/authentication] ${message}`);
    });

    it('passes the detail the library attaches to a diagnostic', () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const cause = new Error('no crypto available');

        log(PKCE, cause);

        expect(warnSpy).toHaveBeenCalledWith(`[@elfsquad/authentication] ${PKCE}`, cause);
    });

    it('hands logging back to the library once verbose logging is enabled', () => {
        const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        setVerboseLogging(true);
        log(ROUTINE, { request: true });
        log(MISMATCH);

        // The library's own single channel: everything at console.log, and the diagnostic
        // is not also promoted, so nothing is reported twice.
        expect(logSpy).toHaveBeenCalledTimes(2);
        expect(warnSpy).not.toHaveBeenCalled();
    });

    it('stops reporting routine progress again when verbose logging is turned back off', () => {
        setVerboseLogging(true);
        const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

        setVerboseLogging(false);
        log(ROUTINE);

        expect(logSpy).not.toHaveBeenCalled();
    });
});
