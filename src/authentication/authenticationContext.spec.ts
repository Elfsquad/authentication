import 'jest';
import * as fetchMock from 'fetch-mock'
import { AuthenticationContext } from '..';


describe('AuthenticationContext', function() {

    let authenticationContext;

    beforeEach(() => {
        authenticationContext = new AuthenticationContext({
            clientId: 'CLIENT_ID',
            redirectUri: 'REDIRECT_URI'
        });

        (authenticationContext as any).accessTokenResponse = {
            isValid: () => true
        };

        (authenticationContext as any).configuration = {'something': 'here'};
        (authenticationContext as any).refreshToken = {};
    });

    describe('signOut', function() {

        it('should not be logged in', async() =>{
            expect(await authenticationContext.isSignedIn()).toBe(true);
            authenticationContext.signOut();
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

        it('refreshes the accessToken if it is not longer valid', () => {

            const refreshAccessTokenMock = jest.fn();
            (authenticationContext as any).refreshAccessToken = refreshAccessTokenMock;

            authenticationContext.getAccessToken().then(() => {
                expect(refreshAccessTokenMock).toHaveBeenCalled();
            });            
        });

    });

});
