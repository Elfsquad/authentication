import 'jest';
import * as fetchMock from 'fetch-mock'
import { AuthenticationContext } from '..';


describe('AuthenticationContext', function() {

    describe('fetch', function() {

        afterEach(() => {
            fetchMock.restore();
        });

        it('sets x-elfsquad-id header if anonymous authentication', async () => {
            const authenticationContext = new AuthenticationContext({
                tenantId: 'fake-tenant-id'
            });
            fetchMock.get('/', 200)

            await authenticationContext.fetch('/');

            const headers = fetchMock.lastOptions().headers;
            expect(headers).not.toBeNull();
            expect(headers).toHaveProperty( 'x-elfsquad-id', 'fake-tenant-id');
        });

    });

});