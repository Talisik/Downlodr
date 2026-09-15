/**
 * Signed-in identity for the app.
 *
 * FRONTEND ONLY. There is no auth backend yet: `fakeAuthBackend.ts` stands in
 * for it, and this store is the source of truth in the meantime. When the real
 * endpoints land the server owns the session and this store becomes a cache of
 * it — the actions are already async and already return a result object so
 * that swap touches this file and nothing else.
 *
 * What is persisted: the session (so you stay signed in across restarts) and
 * the remembered profiles. NEVER a password — see `fakeAuthBackend.ts`.
 *
 * Non-React callers use the plain `getSession()` / `isShareAllowed()` getters
 * below rather than the hook — `shareLink.ts` builds ids outside React and
 * needs the username. Same pattern as `getTelemetryId()` in telemetryStore.
 */
import type {
  AuthModalMode,
  AuthResult,
  AuthSession,
  SignUpInput,
} from '@/auth/types/authTypes';
import { loginRequest, signUpRequest } from '@/auth/store/fakeAuthBackend';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

const AUTH_STORE_VERSION = 1;

interface AuthStore {
  session: AuthSession | null;
  /**
   * Profiles seen before, keyed by lowercased username, so signing back in
   * restores the real display name instead of one synthesized from whatever
   * was typed. Holds no credential — it is a display cache, not a user table.
   */
  profiles: Record<string, AuthSession>;
  /**
   * TEMPORARY. Whether sharing requires being signed in, wired to the toggle
   * in the account card so the gate can be flipped while there is no backend
   * to enforce it. Remove this — and the toggle — once accounts are real and
   * mandatory.
   *
   * Defaults to off so sharing keeps working exactly as it did before accounts
   * existed.
   */
  requireLoginToShare: boolean;
  /** Which auth modal is open. Lives here because the share gate opens the
   *  login modal from a different tree than the sidebar does. */
  authModal: AuthModalMode;

  login: (identifier: string, password: string) => Promise<AuthResult>;
  signUp: (input: SignUpInput) => Promise<AuthResult>;
  logout: () => void;
  setRequireLoginToShare: (required: boolean) => void;
  openAuthModal: (mode: Exclude<AuthModalMode, null>) => void;
  closeAuthModal: () => void;
}

const profileKey = (username: string): string => username.trim().toLowerCase();

/**
 * Finds a remembered profile by username or email, since the login form takes
 * either in one field.
 */
const findProfile = (
  profiles: Record<string, AuthSession>,
  identifier: string,
): AuthSession | undefined => {
  const needle = identifier.trim().toLowerCase();
  return (
    profiles[needle] ??
    Object.values(profiles).find((p) => p.email.toLowerCase() === needle)
  );
};

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      session: null,
      profiles: {},
      requireLoginToShare: false,
      authModal: null,

      login: async (identifier, password) => {
        const result = await loginRequest(identifier, password, {
          knownProfile: findProfile(get().profiles, identifier),
        });
        if (result.status === 'error') return result;

        set((state) => ({
          session: result.session,
          authModal: null,
          profiles: {
            ...state.profiles,
            [profileKey(result.session.username)]: result.session,
          },
        }));
        return result;
      },

      signUp: async (input) => {
        const result = await signUpRequest(input);
        if (result.status === 'error') return result;

        set((state) => ({
          session: result.session,
          authModal: null,
          profiles: {
            ...state.profiles,
            [profileKey(result.session.username)]: result.session,
          },
        }));
        return result;
      },

      // Profiles survive on purpose: they hold no credential, and keeping them
      // is what lets the next sign-in restore a real display name.
      logout: () => set({ session: null }),

      setRequireLoginToShare: (required) =>
        set({ requireLoginToShare: required }),

      openAuthModal: (mode) => set({ authModal: mode }),
      closeAuthModal: () => set({ authModal: null }),
    }),
    {
      name: 'downlodr-auth',
      version: AUTH_STORE_VERSION,
      storage: createJSONStorage(() => localStorage),
      // Modal state is deliberately excluded — reopening the app into a login
      // modal you never asked for would be its own bug.
      partialize: (state) => ({
        session: state.session,
        profiles: state.profiles,
        requireLoginToShare: state.requireLoginToShare,
      }),
    },
  ),
);

// ── Non-React accessors ──────────────────────────────────────────────────────

/** The signed-in identity, or null. Safe to call outside React. */
export const getSession = (): AuthSession | null =>
  useAuthStore.getState().session;

export const isLoggedIn = (): boolean => getSession() !== null;

/**
 * Whether a share may be generated right now: always, unless the temporary
 * login gate is on and nobody is signed in.
 */
export const isShareAllowed = (): boolean => {
  const { requireLoginToShare, session } = useAuthStore.getState();
  return !requireLoginToShare || session !== null;
};

/** Opens the login modal from anywhere — used when the share gate blocks. */
export const promptLogin = (): void =>
  useAuthStore.getState().openAuthModal('login');
