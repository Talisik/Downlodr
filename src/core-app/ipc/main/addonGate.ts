import type { PackName } from './addonManager';
import type { GatedAction } from './actionGate';

export interface RequiredAddon {
  pack: PackName;
  label: string;
  feature: string;
}

export const REQUIRED_ADDON_ROUTES: Array<[RegExp, RequiredAddon]> = [
  [
    /^\/afda(\/|$)/,
    {
      pack: 'afda-backend',
      label: 'Article Fetcher',
      feature: 'article scraping',
    },
  ],
  [
    /^\/subscriptions(\/|$)/,
    {
      pack: 'video-nemesis-toolkit',
      label: 'Subscriptions',
      feature: 'YouTube subscriptions',
    },
  ],
];

export function resolveRequiredAddon(pathname: string): RequiredAddon | null {
  const hit = REQUIRED_ADDON_ROUTES.find(([pattern]) => pattern.test(pathname));
  return hit ? hit[1] : null;
}

export function buildAddonRequiredAction(
  required: RequiredAddon,
): GatedAction {
  return {
    command: `install_${required.pack.replace(/-/g, '_')}`,
    kind: 'addon-required',
    pack: required.pack,
    review: {
      title: `${required.label} add-on needed`,
      chip: 'Separate download',
      approveLabel: 'Download add-on',
      fields: [
        { label: 'Feature', value: required.feature },
        { label: 'Add-on', value: required.label },
        {
          label: 'Status',
          value:
            "Not ready yet. Download it if you haven't installed it, or " +
            'restart Downlodr if you already have.',
        },
      ],
    },
  };
}
