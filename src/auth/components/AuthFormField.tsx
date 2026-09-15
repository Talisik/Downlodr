/**
 * One labelled field in an auth form.
 *
 * Exists mostly so the input styling — which matches the other form modals
 * (see AfdaAddWebsiteModal) — isn't repeated seven times across two forms,
 * and so the error ring is applied consistently.
 */
import { useState } from 'react';
import { IoEyeOffOutline, IoEyeOutline } from 'react-icons/io5';

const INPUT_CLASS =
  'w-full text-xs px-3 py-2 rounded-md border bg-[#F3F3F3] dark:bg-darkModeCompliment text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-1';

interface AuthFormFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'email' | 'password';
  placeholder?: string;
  autoComplete?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  /** Marks this field as the one the failure belongs to. */
  invalid?: boolean;
}

export function AuthFormField({
  id,
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  autoComplete,
  autoFocus,
  disabled,
  invalid,
}: AuthFormFieldProps) {
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === 'password';
  // A revealed password field becomes a text field, so the browser doesn't
  // keep masking it.
  const inputType = isPassword && revealed ? 'text' : type;

  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={id}
        className="text-[11px] font-medium text-gray-600 dark:text-gray-300"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={inputType}
          value={value}
          placeholder={placeholder}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className={`${INPUT_CLASS} ${
            invalid
              ? 'border-red-400 dark:border-red-500 focus:ring-red-400'
              : 'border-gray-200 dark:border-gray-600 focus:ring-primary'
          } ${isPassword ? 'pr-9' : ''} disabled:opacity-60`}
        />
        {isPassword && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setRevealed((prev) => !prev)}
            aria-label={revealed ? 'Hide password' : 'Show password'}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            {revealed ? (
              <IoEyeOffOutline size={15} />
            ) : (
              <IoEyeOutline size={15} />
            )}
          </button>
        )}
      </div>
    </div>
  );
}

export default AuthFormField;
