import type { AuthorizationServiceConfiguration } from '@openid/appauth/built/authorization_service_configuration';

export interface IAuthenticationOptions{
    /**
     * The client ID of your OpenID Connect application.
    */
    clientId: string;
    /**
     * The url to redirect to after a login.
    */
    redirectUri: string;
    /**
     * The oauth scopes to request, defaults to 'Elfskot.Api offline_access'.
    */
    scope?: string | undefined;
    /**
     * The login url to use, defaults to 'login.elfsquad.io'.
    */
    loginUrl?: string | undefined;
    /**
     * The response mode to use, defaults to 'fragment'.
    */
    responseMode?: 'query' | 'fragment' | undefined;
    /**
     * Optional custom implementation for refreshing the access token.
     * When provided, the library calls this instead of using the built-in
     * refresh token flow (which reads from localStorage). Use this to
     * implement secure refresh flows, e.g. via an HttpOnly-cookie-backed
     * backend endpoint.
     *
     * Must be provided together with storeRefreshToken and revokeRefreshToken.
     * All three callbacks are required together or must all be omitted.
     *
     * @returns a promise that resolves with the new access token, its lifetime
     * in seconds, and optionally the ID token.
    */
    refreshAccessToken?: () => Promise<{ accessToken: string; expiresIn: number; idToken?: string }>;
    /**
     * Optional callback to securely store the refresh token server-side.
     * When provided, the library calls this instead of saving the refresh
     * token to localStorage — both on initial login and when migrating an
     * existing localStorage token on the next page load. After the callback
     * resolves, the token is removed from localStorage.
     *
     * Must be provided together with refreshAccessToken and revokeRefreshToken.
     * All three callbacks are required together or must all be omitted.
    */
    storeRefreshToken?: (refreshToken: string) => Promise<void>;
    /**
     * Optional callback to revoke the server-side refresh token during sign-out.
     * When provided, the library calls this instead of the built-in revocation
     * flow (which reads from localStorage). Use this to revoke the server-side
     * session and clear the HttpOnly cookie set by storeRefreshToken.
     *
     * Must be provided together with refreshAccessToken and storeRefreshToken.
     * All three callbacks are required together or must all be omitted.
    */
    revokeRefreshToken?: () => Promise<void>;
    /**
     * Optional factory that returns the OpenID Connect service configuration.
     * When provided, the library calls this instead of fetching the OIDC
     * discovery document from the issuer URL. Useful for testing and for
     * environments where the discovery endpoint is unavailable.
    */
    fetchServiceConfiguration?: () => Promise<AuthorizationServiceConfiguration>;
}
