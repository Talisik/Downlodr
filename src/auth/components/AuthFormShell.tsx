/**
 * Shared chrome for the login and sign-up modals: the BaseModal wrapper, the
 * error banner, the submit button, and the "switch to the other form" line.
 *
 * The two forms differ only in their fields, so everything else lives here
 * rather than being kept in sync by hand across both.
 *
 * The submit button sits in BaseModal's footer but drives the form in the
 * body via `form={formId}`, so Enter submits and the button still renders
 * where the other modals put their primary action.
 */
import BaseModal from '@/downlodr/components/modal/BaseModal';

interface AuthFormShellProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  formId: string;
  onSubmit: () => void;
  submitLabel: string;
  pendingLabel: string;
  pending: boolean;
  error?: string;
  switchPrompt: string;
  switchLabel: string;
  onSwitch: () => void;
  children: React.ReactNode;
}

export function AuthFormShell({
  isOpen,
  onClose,
  title,
  formId,
  onSubmit,
  submitLabel,
  pendingLabel,
  pending,
  error,
  switchPrompt,
  switchLabel,
  onSwitch,
  children,
}: AuthFormShellProps) {
  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      width="max-w-sm"
      footer={
        <div className="flex flex-col gap-2">
          <button
            type="submit"
            form={formId}
            disabled={pending}
            className="w-full bg-primary hover:opacity-90 text-white py-2 rounded-md text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {pending ? pendingLabel : submitLabel}
          </button>
          <p className="text-center text-[11px] text-gray-500 dark:text-gray-400">
            {switchPrompt}{' '}
            <button
              type="button"
              onClick={onSwitch}
              disabled={pending}
              className="text-primary font-medium hover:underline disabled:opacity-60"
            >
              {switchLabel}
            </button>
          </p>
        </div>
      }
    >
      <form
        id={formId}
        onSubmit={(e) => {
          e.preventDefault();
          if (!pending) onSubmit();
        }}
        className="flex flex-col gap-3 pb-2"
      >
        {error && (
          <div className="text-xs text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-md px-3 py-2">
            {error}
          </div>
        )}
        {children}
      </form>
    </BaseModal>
  );
}

export default AuthFormShell;
