import { IAuthenticationOptions } from "./authenticationOptions";
import { IOauthOptions } from "./oauthOptions";
export declare class AuthenticationContext {
    private options;
    private accessTokenResponse;
    private configuration;
    private authorizationHandler;
    private tokenHandler;
    private loginUrl;
    private fetchRequestor;
    private onSignInResolvers;
    private onSignInRejectors;
    private _initPromise;
    private state;
    /**
     * Creates an instance of AuthenticationContext & initializes with the provided authentication options.
     *
     * @example
     * ```typescript
     * const authenticationContext = new AuthenticationContext({
     *   clientId: 'your-client-id',
     *   redirectUri: 'https://example.com',
     *   scope: 'Elfskot.Api offline_access',
     *   responseMode: 'fragment',
     *   loginUrl: 'https://login.elfsquad.io'
     * });
     * ```
     */
    constructor(options: IAuthenticationOptions);
    /**
     * This method can be used for executing logic after the user has
     * signed in. For example, you can use this method to fetch & set
     * the access token, change the UI, etc.
     *
     * @example
     * ```typescript
     * const authenticationContext = new AuthenticationContext();
     * async function onSignIn() {
     *   console.log('User has signed in');
     * };
     * authenticationContext.onSignIn().then(onSignIn);
     * ```
     *
     * @returns promise that resolves when the user has signed in. If
     * the user is already signed in, the promise resolves immediately.
     */
    onSignIn(): Promise<void>;
    /**
     * This method starts the login flow & redirects the user to the login page.
     *
     * @example
     * ```typescript
     * const authenticationContext = new AuthenticationContext();
     * authenticationContext.signIn();
     * ```
     *
     * @param options - oauth options that will be passed on to the
     * authorization request. This can be used, for example, to perform
     * a silent login.
     */
    signIn(options?: IOauthOptions): Promise<void>;
    /**
     * This method signs the user out & revokes the tokens. After signing out, the user will be redirected to the postLogoutRedirectUri.
     * If no postLogoutRedirectUri is provided, the user will be redirected to the login page.
     *
     * @example
     * ```typescript
     * const authenticationContext = new AuthenticationContext();
     * const postLogoutRedirectUri = 'https://example.com';
     * authenticationContext.signOut(postLogoutRedirectUri);
     * ```
     *
     * @param postLogoutRedirectUri - the uri string where the user will be redirected to after signing out.
     */
    signOut(postLogoutRedirectUri?: string | null): Promise<void>;
    private deleteTokens;
    private revokeTokens;
    private revokeRefreshToken;
    private revokeAccessToken;
    private revokeToken;
    private endSession;
    /**
     * This method can be used to check if the user is signed in, for example to show a login/logout button.
     *
     * @example
     * ```typescript
     * const authenticationContext = new AuthenticationContext();
     * async function isSignedIn(value: boolean) {
     *   console.log('User is signed in:', value);
     * }
     * authenticationContext.isSignedIn().then(isSignedIn);
     * ```
     *
     * @returns promise that resolves with a boolean indicating if the user is signed in.
     */
    isSignedIn(): Promise<boolean>;
    private _refreshTokenPromise;
    /**
     * This method can be used to get the access token. This method will
     * automatically refresh the access token if it has expired and a
     * valid refresh token is available.
     *
     * @example
     * ```typescript
     * const authenticationContext = new AuthenticationContext();
     * authenticationContext.getAccessToken().then(accessToken => {
     *   console.log('Access token:', accessToken);
     * });
     * ```
     *
     * @returns promise that resolves with the access token.
     */
    getAccessToken(): Promise<string>;
    /**
     * This method can be used to get the id token. Similar to the
     * getAccessToken method, this method will automatically refresh
     * the id (and access) token if it has expired and a valid refresh
     * token is available.
     *
     * @example
     * ```typescript
     * const authenticationContext = new AuthenticationContext();
     * authenticationContext.getIdToken().then(idToken => {
     *   console.log('Id token:', idToken);
     * });
     * ```
     * @returns promise that resolves with the id token.
     */
    getIdToken(): Promise<string>;
    /**
     * This method can be used to persist data in local storage, which
     * can be used to save data between sign in attempts. This can
     * be useful, for example, to save the current url before
     * the user is redirected to the login page.
     *
     * This method user the oauth2 state parameter, which means the data
     * is only persisted for one sign in attempt.
     *
     * @example
     * ```typescript
     * const authenticationContext = new AuthenticationContext();
     *
     * authenticationContext.setState({ url: window.location.href });
     * authenticationContext.onSignIn().then(() => {
     *   const { url } = authenticationContext.getState();
     *   window.location.href = url;
     * });
     *
     * authenticationContext.signIn();
     * ```
     *
     * @param data - the data that will be persisted in local storage.
     */
    setState(data: any): void;
    /**
     * This method can be used to retrieve data that was persisted in
     * local storage using the setState method.
     *
     * @example
     * ```typescript
     * const authenticationContext = new AuthenticationContext();
     *
     * authenticationContext.setState({ url: window.location.href });
     * authenticationContext.onSignIn().then(() => {
     *   const { url } = authenticationContext.getState();
     *   window.location.href = url;
     * });
     *
     * authenticationContext.signIn();
     * ```
     *
     * @returns the data that was persisted in local storage.
     */
    getState(): any | null;
    private validateAccessTokenResponse;
    private refreshAccessToken;
    private fetchConfiguration;
    private ensureInitialized;
    private makeAuthorizationRequest;
    private onAuthorization;
    private initialize;
    private sanitizeRedirectUrl;
    private callSignInResolvers;
    private callSignInRejectors;
}
