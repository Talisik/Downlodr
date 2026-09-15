/**
 * Sign-in form. One field takes either an email or a username — the backend
 * will have to tell them apart anyway, so asking the user to pick a mode
 * buys nothing.
 */
import AuthFormField from '@/auth/components/AuthFormField';
import AuthFormShell from '@/auth/components/AuthFormShell';
import { useAuthStore } from '@/auth/store/authStore';
import type { AuthFailure } from '@/auth/types/authTypes';
import { useState } from 'react';

interface LoginModalProps {
  isOpen: boolean;
}

export function LoginModal({ isOpen }: LoginModalProps) {
  const login = useAuthStore((s) => s.login);
  const closeAuthModal = useAuthStore((s) => s.closeAuthModal);
  const openAuthModal = useAuthStore((s) => s.openAuthModal);

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<AuthFailure | undefined>();

  const handleSubmit = async () => {
    setPending(true);
    setFailure(undefined);
    try {
      const result = await login(identifier, password);
      // On success the store closes the modal itself; the local password is
      // dropped with this component either way.
      if (result.status === 'error') setFailure(result);
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthFormShell
      isOpen={isOpen}
      onClose={closeAuthModal}
      title="Log in"
      formId="auth-login-form"
      onSubmit={handleSubmit}
      submitLabel="Log in"
      pendingLabel="Logging in…"
      pending={pending}
      error={failure?.message}
      switchPrompt="Don't have an account?"
      switchLabel="Sign up"
      onSwitch={() => openAuthModal('signup')}
    >
      <AuthFormField
        id="auth-identifier"
        label="Email or username"
        value={identifier}
        onChange={setIdentifier}
        placeholder="you@example.com"
        autoComplete="username"
        autoFocus
        disabled={pending}
        invalid={failure?.field === 'identifier'}
      />
      <AuthFormField
        id="auth-password"
        label="Password"
        type="password"
        value={password}
        onChange={setPassword}
        autoComplete="current-password"
        disabled={pending}
        invalid={failure?.field === 'password'}
      />
    </AuthFormShell>
  );
}

export default LoginModal;
