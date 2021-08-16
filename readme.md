# Elfsquad Authentication Library

The authentication library allows you to easily authenticate with the Elfsquad API.

## Options

- `clientId` identifier of your OpenIdClient that can be obtained in the integrations page of your [Elfsquad Management System](https://ems.elfsquad.io/integration).
- `redirectUri` callback entry point of your app.
- `scope` (optional) Requested authentication scope. Defaults to `Elfskot.Api offline_access`.
- `loginUrl` (optional) URL of the authentication service. Defaults to `https://login.elfsquad.io`.

## Methods

- `signIn` starts the authentication flow.
- `onSignIn` returns a promise that is called after the authentication flow has run successfully.
- `loggedIn` returns true if the user is authenticated.

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
    console.log("onSignIn #1");

    authenticationContext.getAccessToken().then((accessToken) => {
      console.log("accessToken", accessToken);
    });
  })
  .catch((error) => {
    console.error(error);
  });

authenticationContext.signIn();
```
