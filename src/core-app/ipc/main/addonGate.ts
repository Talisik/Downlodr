/**
 * Add-on gate — which bridge routes need an optional pack installed.
 *
 * Split from mcpBridgeServer for the same reason actionGate is: everything
 * here is a pure lookup, so the route table can be unit-tested without
 * standing up an HTTP server. Readiness itself stays in the bridge, which
 * already tracks it — this module only answers *which* pack a route needs.
 *
 * The check runs in handleRequest ahead of routing, and that placement is
 * load-bearing rather than cosmetic. chatHandler's find_subscription,
 * find_website and find_section all parse the bridge's response and fall
 * through to a "nothing matched" branch when it isn't an array — so a 200
 * carrying {"error": "Skedulosa not ready"} is laundered into "No
 * subscription found matching X", and README's tier-3 rule then routes the
 * agent to the *create* path. Gating before routing means those helpers see
 * a 403 instead, and the fallthrough never runs.
 */
import type { PackName } from './addonManager';
import type { GatedAction } from './actionGate';

export interface RequiredAddon {
  pack: PackName;
  /** How the add-on is named to the user, matching the Add-ons manager. */
  label: string;
  /** What the user was trying to do, for the card's first row. */
  feature: string;
}

// Verified by enumerating every route literal in mcpBridgeServer: all AFDA
// routes live under /afda/, all Skedulosa routes under /subscriptions/.
//
// (\/|$) rather than a bare prefix, so /afdax can never match /afda.
//
// Smart Organize is deliberately absent: it is renderer-IPC only
// (smartOrganizeHandler) and reaches no bridge route, so there is nothing to
// gate. It still reports readiness on /status.
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

/** Which add-on does this path need? Null for routes that need none. */
export function resolveRequiredAddon(pathname: string): RequiredAddon | null {
  const hit = REQUIRED_ADDON_ROUTES.find(([pattern]) => pattern.test(pathname));
  return hit ? hit[1] : null;
}

/**
 * The card shown when a pack isn't available.
 *
 * Deliberately does not distinguish "never downloaded" from "downloaded but
 * the app hasn't restarted". Telling the two apart would mean reading
 * detectAddon() from the bridge, which needs Electron's `app` and so is
 * unavailable to a module that also runs headless — and the user's next step
 * is the same either way, so the copy just covers both.
 */
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
