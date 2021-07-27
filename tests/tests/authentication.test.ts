import 'jasmine';
import * as fetchMock from 'fetch-mock'
import { AuthenticationContext } from '@elfsquad/core';


describe('AuthenticationContext', function() {

    describe('fetch', function() {

        afterEach(() => {
            fetchMock.restore();
        });

        it('sets x-elfsquad-id header if anonymous authentication', async () => {
            // Arrange
            const authenticationContext = new AuthenticationContext({
                tenantId: 'fake-tenant-id'
            });
            fetchMock.get('/', 200)

            // Act
            await authenticationContext.fetch('/');

            // Assert
            const headers = fetchMock.lastOptions().headers;
            expect(headers).not.toBeNull();
            expect(headers).toEqual(jasmine.objectContaining({
                'x-elfsquad-id': 'fake-tenant-id'
            }));
        });

    });

});