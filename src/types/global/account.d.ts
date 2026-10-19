/* eslint-disable prettier/prettier */
/** Accounts and share links. */
declare global {
  interface Window {
    /**
     * Accounts (authBridge) — see src/core-app/ipc/main/authHandler.ts.
     *
     * Deliberately has no accessor for the access or refresh token: both stay
     * in the main process so neither can reach this store's persisted state.
     */
    authBridge: {
      login: (payload: {
        email: string;
        password: string;
      }) => Promise<import('@/auth/types/authTypes').AuthResult>;
      register: (
        payload: import('@/auth/types/authTypes').SignUpInput,
      ) => Promise<import('@/auth/types/authTypes').AuthResult>;
      logout: () => Promise<void>;
      /**
       * Opens the sign-in page in the user's browser. The user returns via a
       * downlodr://auth link, which the main process handles — so this
       * resolves as soon as the browser opens, not when sign-in finishes.
       */
      openLoginPage: () => Promise<boolean>;
    };

    /** Share-link metadata recording (shareHandler.ts) — runs in main to avoid renderer-side CORS */
    shareBridge: {
      record: (payload: {
        senderUserId: string;
        longUrl: string;
        title?: string;
        listId?: string;
        description?: string;
        visibility?: 'public' | 'unlisted' | 'private';
        videos?: {
          url: string;
          author?: string;
          title?: string | null;
          description?: string | null;
          thumbnail?: string | null;
        }[];
      }) => Promise<{ success: boolean }>;
      /** TEMP: debug read-back of recorded shares. */
      list: (senderUserId: string) => Promise<{
        success: boolean;
        status?: number;
        data?: unknown;
        error?: string;
      }>;
    };
  }
}

export {};
