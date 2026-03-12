# Elfsquad Authentication Library

The authentication library allows you to easily authenticate with the Elfsquad API.

## Options

- `clientId` identifier of your OpenIdClient that can be obtained in the integrations page of your [Elfsquad Management System](https://ems.elfsquad.io/integration).
- `redirectUri` callback entry point of your app.
- `scope` (optional) Requested authentication scope. Defaults to `Elfskot.Api offline_access`.
- `loginUrl` (optional) URL of the authentication service. Defaults to `https://login.elfsquad.io`.
- `responseMode` (optional) OAuth response mode, either `'fragment'` or `'query'`. Defaults to `'fragment'`.
- `storeRefreshToken` (optional) Callback to store the refresh token server-side. When provided, the library will call this instead of saving the token to `localStorage`. Must be provided together with `refreshAccessToken` and `revokeRefreshToken`.
- `refreshAccessToken` (optional) Callback to refresh the access token via a server-side endpoint. When provided, the library will call this instead of using the built-in `localStorage`-based refresh flow. Must be provided together with `storeRefreshToken` and `revokeRefreshToken`.
- `revokeRefreshToken` (optional) Callback to revoke the server-side refresh token on sign-out. Must be provided together with `storeRefreshToken` and `refreshAccessToken`.

## Methods

- `signIn` starts the authentication flow.
- `onSignIn` returns a promise that is called after the authentication flow has run successfully.
- `isSignedIn` returns a promise with a boolean result that indicates if the user is signed in.
- `getAccessToken` returns a promise that resolves into access token.

## Examples

```js
import { AuthenticationContext } from "@elfsquad/authentication";

var authenticationContext = new AuthenticationContext({
  clientId: "c2a349a9-02ea-4e1e-a59d-65870529f713",
  redirectUri: "https://example.com",
});

authenticationContext
  .onSignIn()
  .then(() => {
    authenticationContext.getAccessToken().then((accessToken) => {
      console.log("accessToken", accessToken);
    });
  })
  .catch((error) => {
    console.error(error);
  });

authenticationContext.isSignedIn().then((isSignedIn) => {
  if (!isSignedIn) {
    authenticationContext.signIn();
  }
});
```

### BFF pattern (secure refresh token storage)

Use the `storeRefreshToken`, `refreshAccessToken`, and `revokeRefreshToken` callbacks to move refresh tokens out of `localStorage` into server-side HttpOnly cookies, eliminating XSS exposure of long-lived credentials.

```js
import { AuthenticationContext } from "@elfsquad/authentication";

const authenticationContext = new AuthenticationContext({
  clientId: "c2a349a9-02ea-4e1e-a59d-65870529f713",
  redirectUri: "https://example.com",
  storeRefreshToken: (token) =>
    fetch("/auth/store-token", {
      method: "POST",
      body: JSON.stringify({ token }),
    }).then(() => {}),
  refreshAccessToken: () =>
    fetch("/auth/refresh").then((r) => r.json()),
  revokeRefreshToken: () =>
    fetch("/auth/revoke", { method: "POST" }).then(() => {}),
});

authenticationContext.onSignIn().then(() => {
  authenticationContext.getAccessToken().then((accessToken) => {
    console.log("accessToken", accessToken);
  });
});
```
