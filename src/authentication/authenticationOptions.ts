export interface IAuthenticationOptions{
    clientId: string;
    redirectUri: string;
    scope?: string | undefined;
    loginUrl?: string | undefined;
}
