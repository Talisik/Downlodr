/**
 * Shared presentation pieces for the Settings and Advanced Settings modals.
 *
 * Styling only — nothing here holds state or talks to a store. The values are
 * taken from the house style already set by AboutModal and HelpModal: 13px
 * bold section labels over a `border-divider` rule, 13px option labels, 12px
 * (`text-xs`) helper copy in `text-gray-500`, and `rounded-md` controls. Both
 * settings modals import from here so they can't drift apart again.
 */
import React from 'react';

// ---- buttons ----

/** Secondary / neutral button, as used for Close in AboutModal. */
export const BTN =
  'h-8 px-2 py-1 text-sm border rounded-md hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-darkModeHover dark:text-gray-200';

/** Primary action, following HelpModal's "Take a Tour" button. */
export const BTN_PRIMARY =
  'h-8 px-3 py-1 text-sm font-medium rounded-md bg-primary text-white hover:bg-primary/90 transition-colors';

/** Compact button for inline row actions. */
export const BTN_SMALL =
  'px-2 py-0.5 text-xs border rounded-md hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-darkModeHover dark:text-gray-200 disabled:opacity-50';

// ---- form controls ----

export const INPUT =
  'w-full border rounded-md px-3 py-2 text-[13px] dark:bg-darkMode dark:text-gray-200 dark:border-inputDarkModeBorder outline-none';

/** Shorter variant for a field sitting inline next to a button. */
export const INPUT_SM =
  'h-8 w-full border rounded-md px-2 text-xs dark:bg-darkMode dark:text-gray-200 dark:border-inputDarkModeBorder outline-none';

export const SELECT = `${INPUT} [&>option]:dark:bg-darkMode`;

export const CHECKBOX = 'w-4 h-4 accent-primary rounded focus:ring-primary';

export const RADIO = 'w-4 h-4 accent-primary';

// ---- type scale ----

/** Field label above an input, and the left half of a settings row. */
export const FIELD_LABEL = 'text-[13px] dark:text-gray-200';

/** Title of a checkbox row — body size, like HelpModal's accordion titles. */
export const OPTION_LABEL = 'dark:text-gray-200 cursor-pointer';

/** Explanatory line under an option. */
export const OPTION_HELP = 'text-xs text-gray-500 dark:text-gray-400';

/** Title of an authentication choice. */
export const AUTH_LABEL = 'font-medium dark:text-gray-200';

/** Body copy under an authentication choice, indented past its radio. */
export const AUTH_DESC = 'ml-6 mt-1 text-xs text-gray-500 dark:text-gray-400';

// ---- structure ----

export const SECTION_HEADING =
  'block dark:text-gray-200 text-nowrap font-bold cursor-pointer';

export const RULE_LINE =
  'flex-grow border-t-1 border-divider dark:border-gray-700 ml-2';

/** Section heading: bold label followed by a rule, as in AboutModal. */
export const SectionRule: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex items-center gap-2 mt-4 mb-2">
    <label className="block dark:text-gray-200 text-nowrap font-bold">
      {label}
    </label>
    <hr className={RULE_LINE} />
  </div>
);

/** Browser choice chip in the authentication section. */
export const chipClass = (selected: boolean) =>
  `flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs dark:text-gray-200 ${
    selected
      ? 'border-primary bg-primary/10'
      : 'border-gray-300 dark:border-gray-700'
  }`;
