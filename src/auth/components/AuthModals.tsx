/**
 * Host for the auth modals. Mount once, high in the tree — the share gate
 * opens the login modal from a different subtree than the sidebar does, which
 * is why `authModal` lives in the store rather than in either caller.
 *
 * Each form is keyed on its mode so switching between them remounts rather
 * than carrying one form's half-typed state into the other.
 */
import LoginModal from '@/auth/components/LoginModal';
import SignUpModal from '@/auth/components/SignUpModal';
import { useAuthStore } from '@/auth/store/authStore';

export function AuthModals() {
  const authModal = useAuthStore((s) => s.authModal);

  if (!authModal) return null;

  return authModal === 'login' ? (
    <LoginModal key="login" isOpen />
  ) : (
    <SignUpModal key="signup" isOpen />
  );
}

export default AuthModals;
