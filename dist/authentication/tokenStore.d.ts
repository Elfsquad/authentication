import { TokenResponse } from "@openid/appauth";
export declare class TokenStore {
    private static REFRESH_TOKEN_KEY;
    static hasRefreshToken(): boolean;
    static getRefreshToken(): string;
    static saveRefreshToken(refreshToken: string): void;
    static deleteRefreshToken(): void;
    static hasTokenResponse(): boolean;
    static getTokenResponse(): TokenResponse;
    static deleteTokenResponse(): void;
    static saveTokenResponse(tokenResponse: TokenResponse): void;
}
