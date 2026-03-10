import 'jest';
import { AuthorizationServiceConfiguration } from '@openid/appauth/built/authorization_service_configuration';
import { AuthenticationContext } from '..';

const fakeConfig = new AuthorizationServiceConfiguration({
    authorization_endpoint: 'https://test/auth',
    token_endpoint: 'https://test/token',
    revocation_endpoint: 'https://test/revoke',
    end_session_endpoint: 'https://test/logout',
    userinfo_endpoint: 'https://test/userinfo',
});

describe('AuthenticationContext', function() {

    let authenticationContext: AuthenticationContext;

    beforeEach(() => {
        localStorage.clear();
        authenticationContext = new AuthenticationContext({
            clientId: 'CLIENT_ID',
            redirectUri: 'REDIRECT_URI',
            fetchServiceConfiguration: async () => fakeConfig,
        });

        (authenticationContext as any).accessTokenResponse = {
            isValid: () => true
        };
        (authenticationContext as any).configuration = fakeConfig;

        // Skip the async initialization chain for tests that don't exercise it.
        (authenticationContext as any)._initPromise = Promise.resolve();
    });

    afterEach(() => {
        localStorage.clear();
    });

    describe('constructor validation', function() {

        const expectedError = 'storeRefreshToken, refreshAccessToken, and revokeRefreshToken must all be provided together or not at all.';

        it('throws when only storeRefreshToken is provided', () => {
            expect(() => new AuthenticationContext({
                clientId: 'CLIENT_ID',
                redirectUri: 'REDIRECT_URI',
                storeRefreshToken: jest.fn(),
            })).toThrow(expectedError);
        });

        it('throws when only refreshAccessToken is provided', () => {
            expect(() => new AuthenticationContext({
                clientId: 'CLIENT_ID',
                redirectUri: 'REDIRECT_URI',
                refreshAccessToken: jest.fn(),
            })).toThrow(expectedError);
        });

        it('throws when only revokeRefreshToken is provided', () => {
            expect(() => new AuthenticationContext({
                clientId: 'CLIENT_ID',
                redirectUri: 'REDIRECT_URI',
                revokeRefreshToken: jest.fn(),
            })).toThrow(expectedError);
        });

        it('throws when only two of the three proxy options are provided', () => {
            expect(() => new AuthenticationContext({
                clientId: 'CLIENT_ID',
                redirectUri: 'REDIRECT_URI',
                storeRefreshToken: jest.fn(),
                refreshAccessToken: jest.fn(),
            })).toThrow(expectedError);
        });

        it('does not throw when all three proxy options are provided', () => {
            expect(() => new AuthenticationContext({
                clientId: 'CLIENT_ID',
                redirectUri: 'REDIRECT_URI',
                storeRefreshToken: jest.fn(),
                refreshAccessToken: jest.fn(),
                revokeRefreshToken: jest.fn(),
            })).not.toThrow();
        });

        it('does not throw when none of the proxy options are provided', () => {
            expect(() => new AuthenticationContext({
                clientId: 'CLIENT_ID',
                redirectUri: 'REDIRECT_URI',
            })).not.toThrow();
        });

    });

    describe('signOut', function() {

        it('should not be logged in', async () => {
            expect(await authenticationContext.isSignedIn()).toBe(true);
            await authenticationContext.signOut();
            expect(await authenticationContext.isSignedIn()).toBe(false);
        });

        it('calls revokeRefreshToken option instead of built-in localStorage revocation when provided', async () => {
            const revokeRefreshTokenMock = jest.fn().mockResolvedValue(undefined);
            (authenticationContext as any).options.revokeRefreshToken = revokeRefreshTokenMock;
            (authenticationContext as any).configuration = fakeConfig;
            (authenticationContext as any).tokenHandler = { performRevokeTokenRequest: jest.fn().mockResolvedValue(true) };

            await authenticationContext.signOut();

            expect(revokeRefreshTokenMock).toHaveBeenCalled();
        });

        it('does not call built-in revocation when revokeRefreshToken option is provided', async () => {
            const revokeRefreshTokenMock = jest.fn().mockResolvedValue(undefined);
            localStorage.setItem('elfsquad_refresh_token', 'STORED_TOKEN');
            (authenticationContext as any).options.revokeRefreshToken = revokeRefreshTokenMock;
            const performRevokeTokenRequestMock = jest.fn().mockResolvedValue(true);
            (authenticationContext as any).tokenHandler = { performRevokeTokenRequest: performRevokeTokenRequestMock };

            await authenticationContext.signOut();

            const revokeCallsForRefreshToken = performRevokeTokenRequestMock.mock.calls
                .filter(([, req]) => req?.tokenTypeHint === 'refresh_token');
            expect(revokeCallsForRefreshToken).toHaveLength(0);
        });

    });

    describe('getAccessToken', function() {

        it('returns a accessToken if the accessToken is valid', async () => {
            const fakeAccessToken = 'FAKE_ACCESS_TOKEN';
            (authenticationContext as any).accessTokenResponse = {
                isValid: () => true,
                accessToken: fakeAccessToken
            };

            const accessToken = await authenticationContext.getAccessToken();
            expect(accessToken).toBe(fakeAccessToken);
        });

        it('refreshes the accessToken if it is no longer valid', async () => {
            (authenticationContext as any).accessTokenResponse = { isValid: () => false };
            localStorage.setItem('elfsquad_refresh_token', 'STORED_TOKEN');
            const refreshAccessTokenMock = jest.fn().mockResolvedValue('NEW_TOKEN');
            (authenticationContext as any).refreshAccessToken = refreshAccessTokenMock;

            await authenticationContext.getAccessToken();
            expect(refreshAccessTokenMock).toHaveBeenCalled();
        });

        it('exposes idToken returned by custom refreshAccessToken', async () => {
            const refreshMock = jest.fn().mockResolvedValue({ accessToken: 'CUSTOM_TOKEN', expiresIn: 3600, idToken: 'CUSTOM_ID_TOKEN' });
            authenticationContext = new AuthenticationContext({
                clientId: 'CLIENT_ID',
                redirectUri: 'REDIRECT_URI',
                fetchServiceConfiguration: async () => fakeConfig,
                refreshAccessToken: refreshMock,
                storeRefreshToken: jest.fn(),
                revokeRefreshToken: jest.fn(),
            });
            (authenticationContext as any).accessTokenResponse = { isValid: () => false };
            (authenticationContext as any)._initPromise = Promise.resolve();

            await authenticationContext.getAccessToken();
            expect(await authenticationContext.getIdToken()).toBe('CUSTOM_ID_TOKEN');
        });

        it('preserves previous idToken when custom refreshAccessToken does not return one', async () => {
            const refreshMock = jest.fn().mockResolvedValue({ accessToken: 'NEW_TOKEN', expiresIn: 3600 });
            authenticationContext = new AuthenticationContext({
                clientId: 'CLIENT_ID',
                redirectUri: 'REDIRECT_URI',
                fetchServiceConfiguration: async () => fakeConfig,
                refreshAccessToken: refreshMock,
                storeRefreshToken: jest.fn(),
                revokeRefreshToken: jest.fn(),
            });
            (authenticationContext as any).accessTokenResponse = { isValid: () => false, idToken: 'ORIGINAL_ID_TOKEN' };
            (authenticationContext as any)._initPromise = Promise.resolve();

            await authenticationContext.getAccessToken();
            expect(await authenticationContext.getIdToken()).toBe('ORIGINAL_ID_TOKEN');
        });

        it('calls custom refreshAccessToken option when provided and token is expired', async () => {
            const refreshMock = jest.fn().mockResolvedValue({ accessToken: 'CUSTOM_TOKEN', expiresIn: 3600 });
            authenticationContext = new AuthenticationContext({
                clientId: 'CLIENT_ID',
                redirectUri: 'REDIRECT_URI',
                fetchServiceConfiguration: async () => fakeConfig,
                refreshAccessToken: refreshMock,
                storeRefreshToken: jest.fn(),
                revokeRefreshToken: jest.fn(),
            });
            (authenticationContext as any).accessTokenResponse = { isValid: () => false };
            (authenticationContext as any)._initPromise = Promise.resolve();

            const token = await authenticationContext.getAccessToken();
            expect(refreshMock).toHaveBeenCalled();
            expect(token).toBe('CUSTOM_TOKEN');
        });

    });

    describe('onAuthorization', function() {

        let fakeRequest: any;
        let fakeResponse: any;
        let fakeTokenResponse: any;

        beforeEach(() => {
            fakeTokenResponse = {
                accessToken: 'ACCESS_TOKEN',
                refreshToken: 'REFRESH_TOKEN',
                toJson: () => ({}),
                isValid: () => true,
            };
            (authenticationContext as any).tokenHandler = {
                performTokenRequest: jest.fn().mockResolvedValue(fakeTokenResponse),
            };
            fakeRequest = { internal: {} };
            fakeResponse = { code: 'AUTH_CODE' };

            // onAuthorization reads state from window.location.href; provide a valid one.
            delete (window as any).location;
            (window as any).location = { href: 'https://test/callback?state=TEST_STATE', hash: '' };
        });

        it('calls storeRefreshToken instead of saving to localStorage when provided', async () => {
            const storeRefreshTokenMock = jest.fn().mockResolvedValue(undefined);
            (authenticationContext as any).options.storeRefreshToken = storeRefreshTokenMock;

            await (authenticationContext as any).onAuthorization(fakeRequest, fakeResponse, null);

            expect(storeRefreshTokenMock).toHaveBeenCalledWith('REFRESH_TOKEN');
            expect(localStorage.getItem('elfsquad_refresh_token')).toBeNull();
        });

        it('does not store refresh_token in elfsquad_token_response when storeRefreshToken is provided', async () => {
            const storeRefreshTokenMock = jest.fn().mockResolvedValue(undefined);
            (authenticationContext as any).options.storeRefreshToken = storeRefreshTokenMock;
            fakeTokenResponse.toJson = function() {
                return { access_token: 'ACCESS_TOKEN', refresh_token: this.refreshToken };
            };

            await (authenticationContext as any).onAuthorization(fakeRequest, fakeResponse, null);

            const stored = JSON.parse(localStorage.getItem('elfsquad_token_response') || '{}');
            expect(stored.refresh_token).toBeUndefined();
        });

        it('does not save refresh token to localStorage when only refreshAccessToken is provided', async () => {
            (authenticationContext as any).options.refreshAccessToken = jest.fn();

            await (authenticationContext as any).onAuthorization(fakeRequest, fakeResponse, null);

            expect(localStorage.getItem('elfsquad_refresh_token')).toBeNull();
        });

        it('saves refresh token to localStorage when neither callback is provided', async () => {
            await (authenticationContext as any).onAuthorization(fakeRequest, fakeResponse, null);

            expect(localStorage.getItem('elfsquad_refresh_token')).toBe('REFRESH_TOKEN');
        });

    });

    describe('initialize migration', function() {

        it('calls storeRefreshToken with existing token and removes it from localStorage', async () => {
            const storeRefreshTokenMock = jest.fn().mockResolvedValue(undefined);
            authenticationContext = new AuthenticationContext({
                clientId: 'CLIENT_ID',
                redirectUri: 'REDIRECT_URI',
                fetchServiceConfiguration: async () => fakeConfig,
                storeRefreshToken: storeRefreshTokenMock,
                refreshAccessToken: jest.fn().mockResolvedValue({ accessToken: 'TOKEN', expiresIn: 3600 }),
                revokeRefreshToken: jest.fn(),
            });
            (authenticationContext as any).accessTokenResponse = { isValid: () => true };
            localStorage.setItem('elfsquad_refresh_token', 'EXISTING_TOKEN');

            await authenticationContext.isSignedIn();

            expect(storeRefreshTokenMock).toHaveBeenCalledWith('EXISTING_TOKEN');
            expect(localStorage.getItem('elfsquad_refresh_token')).toBeNull();
        });

        it('keeps token in localStorage if storeRefreshToken throws', async () => {
            const storeRefreshTokenMock = jest.fn().mockRejectedValue(new Error('Network error'));
            authenticationContext = new AuthenticationContext({
                clientId: 'CLIENT_ID',
                redirectUri: 'REDIRECT_URI',
                fetchServiceConfiguration: async () => fakeConfig,
                storeRefreshToken: storeRefreshTokenMock,
                refreshAccessToken: jest.fn().mockResolvedValue({ accessToken: 'TOKEN', expiresIn: 3600 }),
                revokeRefreshToken: jest.fn(),
            });
            (authenticationContext as any).accessTokenResponse = { isValid: () => true };
            localStorage.setItem('elfsquad_refresh_token', 'EXISTING_TOKEN');

            const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            await authenticationContext.isSignedIn();
            errorSpy.mockRestore();

            expect(localStorage.getItem('elfsquad_refresh_token')).toBe('EXISTING_TOKEN');
            expect(storeRefreshTokenMock).toHaveBeenCalledWith('EXISTING_TOKEN');
        });

        it('does not call storeRefreshToken when no token is in localStorage', async () => {
            const storeRefreshTokenMock = jest.fn().mockResolvedValue(undefined);
            authenticationContext = new AuthenticationContext({
                clientId: 'CLIENT_ID',
                redirectUri: 'REDIRECT_URI',
                fetchServiceConfiguration: async () => fakeConfig,
                storeRefreshToken: storeRefreshTokenMock,
                refreshAccessToken: jest.fn().mockResolvedValue({ accessToken: 'TOKEN', expiresIn: 3600 }),
                revokeRefreshToken: jest.fn(),
            });
            (authenticationContext as any).accessTokenResponse = { isValid: () => true };

            await authenticationContext.isSignedIn();

            expect(storeRefreshTokenMock).not.toHaveBeenCalled();
        });

    });

    describe('getIdToken', function() {

        it('calls refreshAccessToken when provided and access token is expired', async () => {
            (authenticationContext as any).options.refreshAccessToken = jest.fn();
            (authenticationContext as any).accessTokenResponse = { isValid: () => false };

            const refreshAccessTokenMock = jest.fn().mockImplementation(async () => {
                (authenticationContext as any).accessTokenResponse = {
                    isValid: () => true,
                    idToken: 'NEW_ID_TOKEN',
                };
            });
            (authenticationContext as any).refreshAccessToken = refreshAccessTokenMock;

            const idToken = await authenticationContext.getIdToken();

            expect(refreshAccessTokenMock).toHaveBeenCalled();
            expect(idToken).toBe('NEW_ID_TOKEN');
        });

    });

    describe('initialize', function() {

        it('falls through to completeAuthorizationRequest when refreshAccessToken fails', async () => {
            const completeAuthMock = jest.fn().mockResolvedValue(null);
            authenticationContext = new AuthenticationContext({
                clientId: 'CLIENT_ID',
                redirectUri: 'REDIRECT_URI',
                fetchServiceConfiguration: async () => fakeConfig,
                refreshAccessToken: jest.fn().mockRejectedValue(new Error('401 Unauthorized')),
                storeRefreshToken: jest.fn(),
                revokeRefreshToken: jest.fn(),
            });
            (authenticationContext as any).authorizationHandler = { completeAuthorizationRequest: completeAuthMock };

            const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            await authenticationContext.isSignedIn();
            errorSpy.mockRestore();

            expect(completeAuthMock).toHaveBeenCalled();
        });

        it('does not call completeAuthorizationRequest when refreshAccessToken succeeds', async () => {
            const completeAuthMock = jest.fn().mockResolvedValue(null);
            authenticationContext = new AuthenticationContext({
                clientId: 'CLIENT_ID',
                redirectUri: 'REDIRECT_URI',
                fetchServiceConfiguration: async () => fakeConfig,
                refreshAccessToken: jest.fn().mockResolvedValue({ accessToken: 'TOKEN', expiresIn: 3600 }),
                storeRefreshToken: jest.fn(),
                revokeRefreshToken: jest.fn(),
            });
            (authenticationContext as any).authorizationHandler = { completeAuthorizationRequest: completeAuthMock };

            await authenticationContext.isSignedIn();

            expect(completeAuthMock).not.toHaveBeenCalled();
        });

    });

    describe('onSignIn', function() {

        it('resolves immediately when already signed in after initialization completes', async () => {
            let initResolve: () => void;
            const initPromise = new Promise<void>(r => { initResolve = r; });
            (authenticationContext as any)._initPromise = null;
            (authenticationContext as any).ensureInitialized = () => {
                (authenticationContext as any)._initPromise = initPromise;
                return initPromise;
            };
            (authenticationContext as any).accessTokenResponse = { isValid: () => false };

            const signInPromise = authenticationContext.onSignIn();

            // Not resolved yet — init hasn't finished
            let resolved = false;
            signInPromise.then(() => { resolved = true; });
            await Promise.resolve();
            expect(resolved).toBe(false);

            // Simulate init completing with a valid token
            (authenticationContext as any).accessTokenResponse = { isValid: () => true };
            (authenticationContext as any).callSignInResolvers();
            initResolve!();
            await signInPromise;
            expect(resolved).toBe(true);
        });

    });

    describe('setState', function() {

        it('generates a unique state key on each call', () => {
            authenticationContext.setState({ redirect: '/dashboard' });
            const state1 = (authenticationContext as any).state;

            authenticationContext.setState({ redirect: '/other' });
            const state2 = (authenticationContext as any).state;

            expect(typeof state1).toBe('string');
            expect(state1.length).toBeGreaterThan(0);
            expect(state1).not.toBe(state2);
        });

    });

});
