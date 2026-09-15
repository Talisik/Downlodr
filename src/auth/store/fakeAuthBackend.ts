/**
 * Stand-in for the auth API. THROWAWAY — delete this file wholesale when the
 * real endpoints land; `authStore` is the only thing that imports it, and it
 * calls these the way it would call a real client.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO: keep passwords. Not in memory, not on
 * disk, not even long enough to compare two of them beyond the confirmation
 * check. A frontend-only stub that persists `{username, password}` is a
 * plaintext credential store, and those have a habit of surviving into
 * production. So `loginRequest` accepts any well-formed input — there is
 * nothing to check it against, and that is the point. It means wrong-password
 * failures can't be demonstrated until there's a server; everything else about
 * the flow is real.
 *
 * The latency is simulated so the modals' loading and disabled states are
 * exercised the way they will be against a real network. Tests pass
 * `delayMs: 0`.
 */
import type {
  AuthField,
  AuthResult,
  AuthSession,
  SignUpInput,
} from '@/auth/types/authTypes';

/** Simulated round-trip time, roughly a fast real request. */
export const FAKE_LATENCY_MS = 400;

export const MIN_PASSWORD_LENGTH = 8;
export const MIN_USERNAME_LENGTH = 3;
export const MAX_USERNAME_LENGTH = 24;

/** Handles: letters, digits, underscore, hyphen. No spaces, no punctuation. */
const USERNAME_PATTERN = new RegExp(
  `^[a-zA-Z0-9_-]{${MIN_USERNAME_LENGTH},${MAX_USERNAME_LENGTH}}$`,
);

/**
 * Deliberately loose. Real address validation is the server's job (and
 * ultimately a confirmation email's); this only catches obvious typos
 * without rejecting addresses that are legal but unusual.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface RequestOptions {
  delayMs?: number;
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const fail = (field: AuthField, message: string): AuthResult => ({
  status: 'error',
  field,
  message,
});

/** Everything before the `@`, for turning an email into a usable handle. */
const emailLocalPart = (email: string): string => email.split('@')[0] ?? '';

const looksLikeEmail = (value: string): boolean => value.includes('@');

/**
 * Creates an account. Returns the session it would have been issued.
 *
 * Fields are checked in form order so the reported `field` is the first one
 * the user would reach, rather than whichever rule happens to be cheapest.
 */
export const signUpRequest = async (
  input: SignUpInput,
  { delayMs = FAKE_LATENCY_MS }: RequestOptions = {},
): Promise<AuthResult> => {
  await sleep(delayMs);

  const displayName = input.displayName.trim();
  const username = input.username.trim();
  const email = input.email.trim();

  if (!displayName) {
    return fail('displayName', 'Enter a display name.');
  }
  if (!USERNAME_PATTERN.test(username)) {
    return fail(
      'username',
      `Usernames are ${MIN_USERNAME_LENGTH}-${MAX_USERNAME_LENGTH} characters, using letters, numbers, - and _ only.`,
    );
  }
  if (!EMAIL_PATTERN.test(email)) {
    return fail('email', 'Enter a valid email address.');
  }
  if (input.password.length < MIN_PASSWORD_LENGTH) {
    return fail(
      'password',
      `Passwords need at least ${MIN_PASSWORD_LENGTH} characters.`,
    );
  }
  if (input.password !== input.confirmPassword) {
    return fail('confirmPassword', "Those passwords don't match.");
  }

  return { status: 'ok', session: { username, displayName, email } };
};

interface LoginOptions extends RequestOptions {
  /**
   * A profile the store already knows for this identifier. Supplied so a user
   * who signed up earlier gets their real display name and email back instead
   * of a synthesized one — the closest this stub gets to a user record.
   */
  knownProfile?: AuthSession;
}

/**
 * Signs in. `identifier` is an email or a username; the form doesn't ask
 * which, so this decides by looking for an `@`.
 *
 * With no known profile there is nothing to look up, so a plausible session
 * is synthesized from the identifier — enough for the account card to render
 * something truthful about what was typed.
 */
export const loginRequest = async (
  identifier: string,
  password: string,
  { knownProfile, delayMs = FAKE_LATENCY_MS }: LoginOptions = {},
): Promise<AuthResult> => {
  await sleep(delayMs);

  const trimmed = identifier.trim();

  if (!trimmed) {
    return fail('identifier', 'Enter your email or username.');
  }
  // Length isn't enforced here the way it is on sign-up: an existing account
  // may predate whatever the current rule is, and only the server can say.
  if (!password) {
    return fail('password', 'Enter your password.');
  }

  if (knownProfile) {
    return { status: 'ok', session: knownProfile };
  }

  const handle = looksLikeEmail(trimmed) ? emailLocalPart(trimmed) : trimmed;

  return {
    status: 'ok',
    session: {
      username: handle,
      displayName: handle,
      email: looksLikeEmail(trimmed) ? trimmed : '',
    },
  };
};
