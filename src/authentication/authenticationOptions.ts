export interface IAuthenticationOptions{
    clientId: string;
    redirectUri: string;
    scope?: string | undefined;
    loginUrl?: string | undefined;
    responseMode?: 'query' | 'fragment' | undefined;
}
