/*
 * Two tabs of one application renew the access token at the same moment, and one of them loses its session.
 *
 * 1. The user is signed in and has the application open in two tabs. The refresh token is kept in localStorage,
 *    which the tabs share; each tab holds the access token in memory.
 * 2. The access token expires while both tabs sit in the background. Each tab then needs a new one: on the next
 *    request, on a background timer, or on page load when the browser restores both tabs.
 * 3. Both tabs read the same refresh token and send it to the token endpoint. The identity provider rotates the
 *    refresh token on every use, so it accepts the first request and refuses the second, and a refresh token that
 *    is presented again after its rotation revokes every token issued from that sign-in.
 * 4. The tab that was refused rejects `getAccessToken()`. On page load it also deletes the stored tokens, which
 *    are the ones the other tab was just issued.
 *
 * Expected: only one tab renews at a time. A tab that waited uses the token the other tab stored, so one request
 * reaches the identity provider and both tabs keep working.
 */
import 'jest';
import { AuthorizationServiceConfiguration } from '@openid/appauth/built/authorization_service_configuration';
import { TokenResponse } from '@openid/appauth/built/token_response';
import { AuthenticationContext } from '..';
import { IAuthenticationOptions } from './authenticationOptions';

const REFRESH_TOKEN_KEY = 'elfsquad_refresh_token';
const TOKEN_RESPONSE_KEY = 'elfsquad_token_response';

const fakeConfig = new AuthorizationServiceConfiguration({
    authorization_endpoint: 'https://test/auth',
    token_endpoint: 'https://test/token',
    revocation_endpoint: 'https://test/revoke',
    end_session_endpoint: 'https://test/logout',
    userinfo_endpoint: 'https://test/userinfo',
});

const nowInSeconds = () => Math.floor(Date.now() / 1000);

/** What AppAuth rejects with when the token endpoint answers a non-2xx status. */
const refused = () => ({ message: '400', extras: 'Bad Request' });

/** One turn of the event loop, standing in for the time a request spends on the network. */
const onTheNetwork = () => new Promise<void>((resolve) => setImmediate(resolve));

/**
 * A token endpoint that rotates the refresh token on every use. A token presented after its rotation is refused
 * and ends the whole chain, so the token issued in its place stops working too.
 */
class RotatingTokenEndpoint {
    requests: string[] = [];
    private current: string | null;
    private issued = 1;

    constructor(firstRefreshToken: string) {
        this.current = firstRefreshToken;
    }

    performTokenRequest = async (_configuration: unknown, request: { refreshToken?: string }): Promise<TokenResponse> => {
        const presented = request.refreshToken;
        this.requests.push(presented);
        if (presented !== this.current) {
            this.current = null;
            await onTheNetwork();
            throw refused();
        }
        this.issued++;
        this.current = `REFRESH_${this.issued}`;
        const response = new TokenResponse({
            access_token: `ACCESS_${this.issued}`,
            refresh_token: this.current,
            expires_in: '3600',
            issued_at: nowInSeconds(),
            token_type: 'bearer',
        });
        await onTheNetwork();
        return response;
    };
}

type LockCallback = () => Promise<unknown>;
interface LockOptions { signal?: AbortSignal }

/** The part of the browser's lock manager the library uses: one holder per name, the others wait in order. */
class FakeLockManager {
    private tails = new Map<string, Promise<unknown>>();

    request(name: string, optionsOrCallback: LockOptions | LockCallback, maybeCallback?: LockCallback): Promise<unknown> {
        const callback = typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback;
        const signal = typeof optionsOrCallback === 'function' ? undefined : optionsOrCallback.signal;
        const previous = this.tails.get(name) ?? Promise.resolve();

        let gaveUp = false;
        const granted = new Promise<void>((resolve, reject) => {
            previous.then(() => resolve());
            signal?.addEventListener('abort', () => {
                gaveUp = true;
                reject(Object.assign(new Error('The request was aborted.'), { name: 'AbortError' }));
            });
        });
        const result = granted.then(() => callback());
        // The next in line waits for this holder to finish, or passes straight through if it gave up waiting.
        this.tails.set(name, previous.then(() => (gaveUp ? undefined : result.catch(() => undefined))));
        return result;
    }
}

function installLockManager(locks: FakeLockManager | undefined): void {
    Object.defineProperty(globalThis, 'navigator', { value: { locks }, configurable: true, writable: true });
}

function storeExpiredSession(refreshToken: string | null): void {
    if (refreshToken) {
        localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    }
    const expired = new TokenResponse({
        access_token: 'ACCESS_1',
        expires_in: '3600',
        issued_at: nowInSeconds() - 7200,
        token_type: 'bearer',
    });
    localStorage.setItem(TOKEN_RESPONSE_KEY, JSON.stringify(expired.toJson()));
}

function storedAccessToken(): string | undefined {
    const stored = localStorage.getItem(TOKEN_RESPONSE_KEY);
    return stored ? JSON.parse(stored).access_token : undefined;
}

/** A tab that loaded while its access token was still valid and has outlived it. */
function openTab(endpoint: RotatingTokenEndpoint | null, options: Partial<IAuthenticationOptions> = {}): AuthenticationContext {
    const tab = new AuthenticationContext({
        clientId: 'CLIENT_ID',
        redirectUri: 'REDIRECT_URI',
        fetchServiceConfiguration: async () => fakeConfig,
        ...options,
    });
    (tab as any).tokenHandler = endpoint;
    (tab as any).accessTokenResponse = JSON.parse(localStorage.getItem(TOKEN_RESPONSE_KEY))
        ? new TokenResponse(JSON.parse(localStorage.getItem(TOKEN_RESPONSE_KEY)))
        : null;
    (tab as any)._initPromise = Promise.resolve();
    return tab;
}

/** A tab that is loading: it reads the session from storage, as on a reload or a restored browser window. */
function loadTab(endpoint: RotatingTokenEndpoint): AuthenticationContext {
    const tab = new AuthenticationContext({
        clientId: 'CLIENT_ID',
        redirectUri: 'REDIRECT_URI',
        fetchServiceConfiguration: async () => fakeConfig,
    });
    (tab as any).tokenHandler = endpoint;
    (tab as any).authorizationHandler = { completeAuthorizationRequest: async (): Promise<null> => null };
    return tab;
}

const outcome = <T>(promise: Promise<T>): Promise<{ value?: T; error?: unknown }> =>
    promise.then((value) => ({ value }), (error) => ({ error }));

describe('two tabs renewing the access token at the same moment', function() {
    const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    let locks: FakeLockManager;

    beforeEach(() => {
        localStorage.clear();
        locks = new FakeLockManager();
        installLockManager(locks);
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
        localStorage.clear();
        if (originalNavigator) {
            Object.defineProperty(globalThis, 'navigator', originalNavigator);
        } else {
            delete (globalThis as any).navigator;
        }
    });

    it('sends one renewal when both tabs ask for an access token, and both get one', async () => {
        storeExpiredSession('REFRESH_1');
        const endpoint = new RotatingTokenEndpoint('REFRESH_1');
        const first = openTab(endpoint);
        const second = openTab(endpoint);

        const [a, b] = await Promise.all([outcome(first.getAccessToken()), outcome(second.getAccessToken())]);

        expect(endpoint.requests).toEqual(['REFRESH_1']);
        expect(a).toEqual({ value: 'ACCESS_2' });
        expect(b).toEqual({ value: 'ACCESS_2' });
        expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBe('REFRESH_2');
    });

    it('sends one renewal when both tabs load with an expired access token, and keeps both signed in', async () => {
        storeExpiredSession('REFRESH_1');
        const endpoint = new RotatingTokenEndpoint('REFRESH_1');
        const first = loadTab(endpoint);
        const second = loadTab(endpoint);
        jest.spyOn(console, 'error').mockImplementation(() => {});

        const signedIn = await Promise.all([first.isSignedIn(), second.isSignedIn()]);

        expect(endpoint.requests).toEqual(['REFRESH_1']);
        expect(signedIn).toEqual([true, true]);
        expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBe('REFRESH_2');
        expect(storedAccessToken()).toBe('ACCESS_2');
    });

    it('calls the refresh callback once when the refresh token is kept server-side', async () => {
        storeExpiredSession(null);
        let calls = 0;
        const serverSide = {
            refreshAccessToken: async () => {
                calls++;
                await onTheNetwork();
                return { accessToken: `ACCESS_FROM_CALL_${calls}`, expiresIn: 3600 };
            },
            storeRefreshToken: async () => {},
            revokeRefreshToken: async () => {},
        };
        const first = openTab(null, serverSide);
        const second = openTab(null, serverSide);

        const tokens = await Promise.all([first.getAccessToken(), second.getAccessToken()]);

        expect(calls).toBe(1);
        expect(tokens).toEqual(['ACCESS_FROM_CALL_1', 'ACCESS_FROM_CALL_1']);
    });

    it('renews in turn when a tab needs a token after the stored one has expired again', async () => {
        storeExpiredSession('REFRESH_1');
        const endpoint = new RotatingTokenEndpoint('REFRESH_1');
        const first = openTab(endpoint);
        const second = openTab(endpoint);

        await first.getAccessToken();
        storeExpiredSession(null);
        const token = await second.getAccessToken();

        expect(endpoint.requests).toEqual(['REFRESH_1', 'REFRESH_2']);
        expect(token).toBe('ACCESS_3');
    });

    it('renews without the lock when another tab holds it for too long', async () => {
        jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick', 'queueMicrotask'] });
        storeExpiredSession('REFRESH_1');
        const endpoint = new RotatingTokenEndpoint('REFRESH_1');
        const tab = openTab(endpoint);
        void locks.request('elfsquad-token-refresh', () => new Promise(() => {}));

        const token = tab.getAccessToken();
        await onTheNetwork();
        expect(endpoint.requests).toEqual([]);
        jest.advanceTimersByTime(10000);

        expect(await token).toBe('ACCESS_2');
        expect(endpoint.requests).toEqual(['REFRESH_1']);
    });

    it('renews without the lock when the browser has no lock manager', async () => {
        installLockManager(undefined);
        storeExpiredSession('REFRESH_1');
        const endpoint = new RotatingTokenEndpoint('REFRESH_1');
        const tab = openTab(endpoint);

        expect(await tab.getAccessToken()).toBe('ACCESS_2');
    });

    it('renews without the lock when the lock manager refuses the request', async () => {
        installLockManager({ request: () => Promise.reject(new Error('SecurityError')) } as unknown as FakeLockManager);
        storeExpiredSession('REFRESH_1');
        const endpoint = new RotatingTokenEndpoint('REFRESH_1');
        const tab = openTab(endpoint);

        expect(await tab.getAccessToken()).toBe('ACCESS_2');
        expect(endpoint.requests).toEqual(['REFRESH_1']);
    });

    describe('a renewal the identity provider refuses', function() {

        it('is sent once more when another tab has stored a newer refresh token in the meantime', async () => {
            installLockManager(undefined);
            storeExpiredSession('REFRESH_1');
            const endpoint = new RotatingTokenEndpoint('REFRESH_1');
            // A tab that takes no lock wins the rotation and stores its token while this tab's request is on its way.
            const renewedElsewhere = {
                performTokenRequest: async (_configuration: unknown, request: { refreshToken?: string }) => {
                    if (request.refreshToken !== 'REFRESH_1') {
                        return endpoint.performTokenRequest(_configuration, request);
                    }
                    const won = await endpoint.performTokenRequest(_configuration, request);
                    localStorage.setItem(REFRESH_TOKEN_KEY, won.refreshToken);
                    endpoint.requests.push('REFRESH_1');
                    throw refused();
                },
            };
            const tab = openTab(endpoint);
            (tab as any).tokenHandler = renewedElsewhere;

            const token = await tab.getAccessToken();

            expect(endpoint.requests).toEqual(['REFRESH_1', 'REFRESH_1', 'REFRESH_2']);
            expect(token).toBe('ACCESS_3');
            expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBe('REFRESH_3');
        });

        it('rejects after one request when the stored refresh token is still the one that was sent', async () => {
            storeExpiredSession('REVOKED');
            const endpoint = new RotatingTokenEndpoint('REFRESH_1');
            const tab = openTab(endpoint);

            await expect(tab.getAccessToken()).rejects.toEqual(refused());

            expect(endpoint.requests).toEqual(['REVOKED']);
        });

    });

});
