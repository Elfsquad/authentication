import {TokenResponse} from "@openid/appauth";



export class TokenStore {

    private static REFRESH_TOKEN_KEY = 'elfsquad_refresh_token';

    static hasRefreshToken(): boolean{
        return !!localStorage.getItem(this.REFRESH_TOKEN_KEY);
    }

    static getRefreshToken(): string{
        return localStorage.getItem(this.REFRESH_TOKEN_KEY);
    }

    static saveRefreshToken(refreshToken:string): void {
        localStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);
    }

    static deleteRefreshToken():void{
        localStorage.removeItem(this.REFRESH_TOKEN_KEY);
    } 

    static hasTokenResponse(): boolean{
        return !!localStorage.getItem('elfsquad_token_response');
    }

    static getTokenResponse(): TokenResponse {
        const asString = localStorage.getItem('elfsquad_token_response');
        const asObject = JSON.parse(asString);
        return new TokenResponse(asObject);
    }

    static deleteTokenResponse(): void {
        localStorage.removeItem('elfsquad_token_response');
    }

    static saveTokenResponse(tokenResponse: TokenResponse): void {
        const asString = JSON.stringify(tokenResponse.toJson());
        localStorage.setItem('elfsquad_token_response', asString);
    }
}

