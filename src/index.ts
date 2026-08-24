export { AuthenticationContext } from './authentication/authenticationContext';
export { IAuthenticationOptions } from './authentication/authenticationOptions';

// Console policy for the underlying OAuth library, which otherwise logs every sign-in
// redirect. Importing this also applies the quiet default.
export { setVerboseLogging, isVerboseLogging } from './authentication/logging';
