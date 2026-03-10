import 'jest';
import * as fetchMock from 'fetch-mock'
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

    describe('signOut', function() {

        it('should not be logged in', async () => {
            expect(await authenticationContext.isSignedIn()).toBe(true);
            await authenticationContext.signOut();
            expect(await authenticationContext.isSignedIn()).toBe(false);
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

        it('calls custom refreshAccessToken option when provided and token is expired', async () => {
            const refreshMock = jest.fn().mockResolvedValue({ accessToken: 'CUSTOM_TOKEN', expiresIn: 3600 });
            authenticationContext = new AuthenticationContext({
                clientId: 'CLIENT_ID',
                redirectUri: 'REDIRECT_URI',
                fetchServiceConfiguration: async () => fakeConfig,
                refreshAccessToken: refreshMock,
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
        });

        it('calls storeRefreshToken instead of saving to localStorage when provided', async () => {
            const storeRefreshTokenMock = jest.fn().mockResolvedValue(undefined);
            (authenticationContext as any).options.storeRefreshToken = storeRefreshTokenMock;

            await (authenticationContext as any).onAuthorization(fakeRequest, fakeResponse, null);

            expect(storeRefreshTokenMock).toHaveBeenCalledWith('REFRESH_TOKEN');
            expect(localStorage.getItem('elfsquad_refresh_token')).toBeNull();
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
