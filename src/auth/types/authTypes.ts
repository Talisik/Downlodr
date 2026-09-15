/**
 * Shared types for the auth module.
 *
 * Kept out of the store so components can type props without importing it
 * (same split as `share-list/types/shareListTypes.ts`).
 */

/**
 * The signed-in identity. Deliberately holds no credential and no token —
 * see the note on `fakeAuthBackend.ts` about what this stub does and does
 * not keep.
 *
 * `username` is the @handle, and doubles as the prefix in generated share
 * ids. `displayName` is the human name shown above it in the account card;
 * the two are separate because the card renders both.
 */
export interface AuthSession {
  username: string;
  displayName: string;
  email: string;
}

/** Everything the sign-up form collects. */
export interface SignUpInput {
  displayName: string;
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

/**
 * Which input a failure belongs to, so a modal can highlight the offending
 * field rather than showing a bare message. `identifier` is the login form's
 * combined email-or-username field.
 */
export type AuthField =
  | 'identifier'
  | 'displayName'
  | 'username'
  | 'email'
  | 'password'
  | 'confirmPassword';

/**
 * Discriminated on a STRING, not an `ok: boolean`. This project compiles with
 * `strictNullChecks` off (see tsconfig.json), and under that setting
 * TypeScript narrows the `true` branch of a boolean discriminant but NOT the
 * `false` branch — so `if (!result.ok) result.field` fails to compile while
 * `if (result.ok) result.session` succeeds. A string discriminant narrows in
 * both directions. Don't "simplify" this back to a boolean.
 */
export type AuthResult =
  | { status: 'ok'; session: AuthSession }
  | { status: 'error'; field: AuthField; message: string };

/** The failure half of `AuthResult`, as the forms hold it while rendering. */
export type AuthFailure = Extract<AuthResult, { status: 'error' }>;

/** Which auth modal is showing, if any. */
export type AuthModalMode = 'login' | 'signup' | null;
