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
}
