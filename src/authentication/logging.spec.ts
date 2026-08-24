import 'jest';
import * as appAuthFlags from '@openid/appauth/built/flags';
import { log } from '@openid/appauth/built/logger';
import { isVerboseLogging, setVerboseLogging } from '..';

const flags = appAuthFlags as unknown as { IS_LOG: boolean };

describe('OAuth library console policy', function() {

    afterEach(() => {
        setVerboseLogging(false);
        jest.restoreAllMocks();
    });

    it('is quiet by default, so importing the package does not enable library logging', () => {
        // The default is applied when the module is first imported, which has already
        // happened by the time this file runs.
        expect(isVerboseLogging()).toBe(false);
        expect(flags.IS_LOG).toBe(false);
    });

    it('reports whether verbose logging is enabled', () => {
        setVerboseLogging(true);
        expect(isVerboseLogging()).toBe(true);

        setVerboseLogging(false);
        expect(isVerboseLogging()).toBe(false);
    });

    it('silences the library logger while quiet', () => {
        const spy = jest.spyOn(console, 'log').mockImplementation(() => {});

        log('a message the library would normally print', { detail: true });

        expect(spy).not.toHaveBeenCalled();
    });

    it('lets the library log again once verbose logging is enabled', () => {
        const spy = jest.spyOn(console, 'log').mockImplementation(() => {});

        setVerboseLogging(true);
        log('a message the library would normally print', { detail: true });

        expect(spy).toHaveBeenCalled();
    });

    it('stops the library logging again when verbose logging is turned back off', () => {
        setVerboseLogging(true);
        const spy = jest.spyOn(console, 'log').mockImplementation(() => {});

        setVerboseLogging(false);
        log('a message the library would normally print');

        expect(spy).not.toHaveBeenCalled();
    });
});
