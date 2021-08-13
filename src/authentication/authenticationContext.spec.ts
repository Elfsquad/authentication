import 'jest';
import * as fetchMock from 'fetch-mock'
import { AuthenticationContext } from '..';


describe('AuthenticationContext', function() {

    describe('signOut', function() {

        it('should not be logged in', function(){

            const authenticationContext = new AuthenticationContext({
                clientId: 'CLIENT_ID',
                redirectUri: 'REDIRECT_URI'
            });

            (authenticationContext as any).accessTokenResponse = {
                isValid: () => true
            };
            
            expect(authenticationContext.loggedIn()).toBe(true);
            authenticationContext.signOut();
            expect(authenticationContext.loggedIn()).toBe(false);
        });

    });

    describe('getAccessToken', function() {

        it('returns a accessToken if the accessToken is valid', async () => {

            const authenticationContext = new AuthenticationContext({
                clientId: 'CLIENT_ID',
                redirectUri: 'REDIRECT_URI'
            });
            (authenticationContext as any).configuration = {};
            (authenticationContext as any).refreshToken = {};

            const fakeAccessToken = 'FAKE_ACCESS_TOKEN';
            (authenticationContext as any).accessTokenResponse = {
                isValid: () => true,
                accessToken: fakeAccessToken
            };

            const accessToken = await authenticationContext.getAccessToken();
            expect(accessToken).toBe(fakeAccessToken);
        });

        it('refreshes the accessToken if it is not longer valid', async() => {
            const authenticationContext = new AuthenticationContext({
                clientId: 'CLIENT_ID',
                redirectUri: 'REDIRECT_URI'
            });
            (authenticationContext as any).configuration = {};
            (authenticationContext as any).refreshToken = {};

            const refreshAccessTokenMock = jest.fn();
            (authenticationContext as any).refreshAccessToken = refreshAccessTokenMock;

            await authenticationContext.getAccessToken();

            expect(refreshAccessTokenMock).toHaveBeenCalled();
        });

    });

});