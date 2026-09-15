/**
 * Account creation form.
 *
 * Display name and username are separate fields because the account card
 * renders both — the name on top, the @handle under it. The username is also
 * what prefixes generated share ids.
 */
import AuthFormField from '@/auth/components/AuthFormField';
import AuthFormShell from '@/auth/components/AuthFormShell';
import { useAuthStore } from '@/auth/store/authStore';
import type { AuthFailure } from '@/auth/types/authTypes';
import { useState } from 'react';

interface SignUpModalProps {
  isOpen: boolean;
}

export function SignUpModal({ isOpen }: SignUpModalProps) {
  const signUp = useAuthStore((s) => s.signUp);
  const closeAuthModal = useAuthStore((s) => s.closeAuthModal);
  const openAuthModal = useAuthStore((s) => s.openAuthModal);

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<AuthFailure | undefined>();

  const handleSubmit = async () => {
    setPending(true);
    setFailure(undefined);
    try {
      const result = await signUp({
        displayName,
        username,
        email,
        password,
        confirmPassword,
      });
      if (result.status === 'error') setFailure(result);
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthFormShell
      isOpen={isOpen}
      onClose={closeAuthModal}
      title="Create an account"
      formId="auth-signup-form"
      onSubmit={handleSubmit}
      submitLabel="Sign up"
      pendingLabel="Creating account…"
      pending={pending}
      error={failure?.message}
      switchPrompt="Already have an account?"
      switchLabel="Log in"
      onSwitch={() => openAuthModal('login')}
    >
      <AuthFormField
        id="auth-display-name"
        label="Display name"
        value={displayName}
        onChange={setDisplayName}
        placeholder="Alex"
        autoComplete="name"
        autoFocus
        disabled={pending}
        invalid={failure?.field === 'displayName'}
      />
      <AuthFormField
        id="auth-username"
        label="Username"
        value={username}
        onChange={setUsername}
        placeholder="alextest1"
        autoComplete="username"
        disabled={pending}
        invalid={failure?.field === 'username'}
      />
      <AuthFormField
        id="auth-email"
        label="Email"
        type="email"
        value={email}
        onChange={setEmail}
        placeholder="you@example.com"
        autoComplete="email"
        disabled={pending}
        invalid={failure?.field === 'email'}
      />
      <AuthFormField
        id="auth-new-password"
        label="Password"
        type="password"
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
        disabled={pending}
        invalid={failure?.field === 'password'}
      />
      <AuthFormField
        id="auth-confirm-password"
        label="Confirm password"
        type="password"
        value={confirmPassword}
        onChange={setConfirmPassword}
        autoComplete="new-password"
        disabled={pending}
        invalid={failure?.field === 'confirmPassword'}
      />
    </AuthFormShell>
  );
}

export default SignUpModal;
