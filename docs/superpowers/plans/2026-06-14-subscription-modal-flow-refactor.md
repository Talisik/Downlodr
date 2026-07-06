# Subscription Modal Flow Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lift all subscription modal orchestration into `SkedulosaHome` via a single `flowStep` state machine so modals no longer nest inside each other, context clears reliably on cancel, and a cancel-confirmation prevents accidental loss of progress.

**Architecture:** `SkedulosaHome` holds one discriminated-union `FlowStep` state that controls which modal is open. `SkedulosaSubscribeModal` fires `onWebsiteUrlReady(url)` instead of rendering `AfdaAddWebsiteModal` inline. `AfdaAddWebsiteModal` removes its inline `AfdaAddedSubscriptionModal` and always signals completion via `onSaved`. Both entry modals show an inline cancel-confirmation footer when the user has made progress.

**Tech Stack:** React 18, Zustand, TypeScript, Tailwind CSS, react-router-dom

---

## File map

| File | Change |
|------|--------|
| `src/skedulosa/pages/SkedulosaHome.tsx` | Replace per-modal state with `flowStep` union; render all 4 modals flat; pass `onOpenSubscribe` down |
| `src/skedulosa/components/SkedulosaSubscribeModal.tsx` | Remove `websiteModalUrl` + inline `AfdaAddWebsiteModal`; add `onWebsiteUrlReady`; add cancel confirmation |
| `src/afda/components/AfdaAddWebsiteModal.tsx` | Remove inline `AfdaAddedSubscriptionModal` + `savedWebsite` state; add cancel confirmation |
| `src/skedulosa/pages/NoSchedulePage.tsx` | Replace self-managed `SkedulosaSubscribeModal` with `onOpenSubscribe` callback |
| `src/skedulosa/components/table/SkedulosaTableTaskbar.tsx` | Remove self-managed `SkedulosaSubscribeModal` + dead `AfdaAddWebsiteModal`; use `onOpenSubscribe` |

---

## Task 1: Add `FlowStep` state machine to `SkedulosaHome`

**Files:**
- Modify: `src/skedulosa/pages/SkedulosaHome.tsx`

- [ ] **Step 1: Replace per-modal state with `flowStep`**

  Open `src/skedulosa/pages/SkedulosaHome.tsx`. Remove these state declarations (lines ~33–43):
  ```tsx
  const [isAddedSubscriptionModalOpen, setIsAddedSubscriptionModalOpen] = useState(false);
  const [addedSubscriptionChannelName, setAddedSubscriptionChannelName] = useState('');
  const [addedSubscriptionId, setAddedSubscriptionId] = useState<string | undefined>(undefined);
  const [isPendingModalOpen, setIsPendingModalOpen] = useState(false);
  const [pendingInitialUrl, setPendingInitialUrl] = useState<string | undefined>(undefined);
  const [afdaWebsiteSaved, setAfdaWebsiteSaved] = useState<{ name: string; id: string } | null>(null);
  ```

  Add this type and state at the top of the component (after existing imports/hook calls):
  ```tsx
  type FlowStep =
    | { step: 'idle' }
    | { step: 'subscribe'; initialUrl?: string }
    | { step: 'website'; url: string }
    | { step: 'youtube-success'; name: string; id: string }
    | { step: 'website-success'; name: string; id: string };

  const [flowStep, setFlowStep] = useState<FlowStep>({ step: 'idle' });
  ```

- [ ] **Step 2: Update `pendingSubscribeUrl` listener**

  Replace the existing `useEffect` that listens for `pendingSubscribeUrl` (currently opens `isPendingModalOpen`):
  ```tsx
  useEffect(() => {
    if (pendingSubscribeUrl) {
      setFlowStep({ step: 'subscribe', initialUrl: pendingSubscribeUrl });
      setPendingSubscribeUrl(null);
    }
  }, [pendingSubscribeUrl]);
  ```

- [ ] **Step 3: Replace all handler functions**

  Remove `handleSubscriptionCreated`, `handleAfdaWebsiteSaved`, `handleCloseAddedSubscriptionModal`, `handleViewYouTubeSubscription`, `handleCloseAfdaSuccessModal`, `handleClosePendingModal`.

  Add these replacements:
  ```tsx
  const openSubscribeFlow = (initialUrl?: string) => {
    setFlowStep({ step: 'subscribe', initialUrl });
  };

  const closeFlow = () => setFlowStep({ step: 'idle' });

  const handleSubscriptionCreated = (channelName: string, subscriptionId: string) => {
    setFlowStep({ step: 'youtube-success', name: channelName, id: subscriptionId });
  };

  const handleWebsiteUrlReady = (url: string) => {
    setFlowStep({ step: 'website', url });
  };

  const handleWebsiteSaved = (name: string, id: string) => {
    setFlowStep({ step: 'website-success', name, id });
  };

  const handleViewYouTubeSubscription = () => {
    const id = flowStep.step === 'youtube-success' ? flowStep.id : undefined;
    setFlowStep({ step: 'idle' });
    if (id) {
      navigate(`/skedulosa/selected-subscription/${id}`);
    } else {
      navigate('/skedulosa/subscription');
    }
  };

  const handleCloseYouTubeSuccess = () => {
    setFlowStep({ step: 'idle' });
    if (!location.pathname.includes('/skedulosa/selected-')) {
      navigate('/skedulosa/subscription');
    }
  };

  const handleCloseWebsiteSuccess = () => {
    setFlowStep({ step: 'idle' });
    if (!location.pathname.includes('/skedulosa/selected-')) {
      navigate('/skedulosa/subscription');
    }
  };
  ```

- [ ] **Step 4: Remove `pendingModal` variable and flatten modal rendering**

  Remove the `pendingModal` const. Replace all modal JSX in both the empty-state return and the main return with a single flat block appended to each return:

  ```tsx
  {/* All subscription flow modals — always rendered flat, visibility controlled by flowStep */}
  <SkedulosaSubscribeModal
    isOpen={flowStep.step === 'subscribe'}
    onClose={closeFlow}
    initialUrl={flowStep.step === 'subscribe' ? flowStep.initialUrl : undefined}
    onSubscriptionCreated={handleSubscriptionCreated}
    onWebsiteUrlReady={handleWebsiteUrlReady}
  />
  <AfdaAddWebsiteModal
    isOpen={flowStep.step === 'website'}
    onClose={closeFlow}
    initialUrl={flowStep.step === 'website' ? flowStep.url : undefined}
    onSaved={handleWebsiteSaved}
  />
  <AddedSubscriptionModal
    isOpen={flowStep.step === 'youtube-success'}
    onClose={handleCloseYouTubeSuccess}
    channelName={flowStep.step === 'youtube-success' ? flowStep.name : ''}
    channelId={flowStep.step === 'youtube-success' ? flowStep.id : undefined}
    onViewSubscription={handleViewYouTubeSubscription}
  />
  <AfdaAddedSubscriptionModal
    isOpen={flowStep.step === 'website-success'}
    onClose={handleCloseWebsiteSuccess}
    websiteName={flowStep.step === 'website-success' ? flowStep.name : undefined}
    websiteId={flowStep.step === 'website-success' ? flowStep.id : undefined}
  />
  ```

- [ ] **Step 5: Update `NoSchedulePage` and `SkedulosaTableTaskbar` call sites**

  In the empty-state branch, change:
  ```tsx
  <NoSchedulePage
    onSubscriptionCreated={handleSubscriptionCreated}
    onWebsiteSaved={handleAfdaWebsiteSaved}
  />
  ```
  to:
  ```tsx
  <NoSchedulePage onOpenSubscribe={openSubscribeFlow} />
  ```

  In the main branch, change:
  ```tsx
  <SkedulosaTableTaskbar
    onSubscriptionCreated={handleSubscriptionCreated}
  />
  ```
  to:
  ```tsx
  <SkedulosaTableTaskbar onOpenSubscribe={openSubscribeFlow} />
  ```

- [ ] **Step 6: Add `AfdaAddWebsiteModal` import**

  If not already imported, add to the import block at the top:
  ```tsx
  import AfdaAddWebsiteModal from '@/afda/components/AfdaAddWebsiteModal';
  ```

- [ ] **Step 7: Commit**

  ```bash
  git add src/skedulosa/pages/SkedulosaHome.tsx
  git commit -m "refactor: add flowStep state machine to SkedulosaHome"
  ```

---

## Task 2: Refactor `SkedulosaSubscribeModal` — remove inline child modal, add cancel confirmation

**Files:**
- Modify: `src/skedulosa/components/SkedulosaSubscribeModal.tsx`

- [ ] **Step 1: Update props interface**

  Find the props block (~line 488):
  ```tsx
  const SkedulosaSubscribeModal = ({
    isOpen,
    onClose,
    onSubscriptionCreated,
    initialUrl,
    onWebsiteSaved,
  }: {
    isOpen: boolean;
    onClose: () => void;
    onSubscriptionCreated?: (channelName: string, subscriptionId: string) => void;
    initialUrl?: string;
    onWebsiteSaved?: (name: string, id: string) => void;
  }) => {
  ```

  Replace with:
  ```tsx
  const SkedulosaSubscribeModal = ({
    isOpen,
    onClose,
    onSubscriptionCreated,
    initialUrl,
    onWebsiteUrlReady,
  }: {
    isOpen: boolean;
    onClose: () => void;
    onSubscriptionCreated?: (channelName: string, subscriptionId: string) => void;
    initialUrl?: string;
    onWebsiteUrlReady?: (url: string) => void;
  }) => {
  ```

- [ ] **Step 2: Remove `websiteModalUrl` state**

  Remove:
  ```tsx
  const [websiteModalUrl, setWebsiteModalUrl] = useState<string | null>(null);
  ```

- [ ] **Step 3: Add `confirmingCancel` state**

  After the existing state declarations, add:
  ```tsx
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  ```

- [ ] **Step 4: Reset `confirmingCancel` in `resetForm`**

  Inside `resetForm` (the `useCallback`), add:
  ```tsx
  setConfirmingCancel(false);
  ```

- [ ] **Step 5: Update `handleSubscribe` — website path**

  Find the website path inside `handleSubscribe`:
  ```tsx
  if (urlType === 'website') {
    if (!url) return;
    setWebsiteModalUrl(url);
    resetForm();
    onClose();
    return;
  }
  ```

  Replace with:
  ```tsx
  if (urlType === 'website') {
    if (!url) return;
    onWebsiteUrlReady?.(url);
    resetForm();
    onClose();
    return;
  }
  ```

- [ ] **Step 6: Add `handleCancelClick` helper**

  Add this function after `handleClose`:
  ```tsx
  const handleCancelClick = useCallback(() => {
    const hasProgress =
      sourceURL.trim().length > 0 &&
      (isValidUrl || !!urlError || analyzingStatus !== 'idle');
    if (hasProgress) {
      setConfirmingCancel(true);
    } else {
      handleClose();
    }
  }, [sourceURL, isValidUrl, urlError, analyzingStatus, handleClose]);
  ```

- [ ] **Step 7: Replace the footer JSX**

  Find the footer prop on `BaseModal`. Replace the entire footer content with:
  ```tsx
  footer={
    <div className="flex flex-col gap-2 py-2 mt-4 w-full">
      {confirmingCancel ? (
        <>
          <p className="text-sm text-center text-gray-600 dark:text-gray-300">
            Exit setup? Your progress will be lost.
          </p>
          <div className="flex items-center justify-center gap-2 w-full">
            <button
              type="button"
              onClick={() => setConfirmingCancel(false)}
              className="flex-1 max-w-[180px] bg-buttonBg dark:bg-darkModeCompliment border border-buttonBorder dark:border-darkModeCompliment text-black dark:text-gray-200 py-1.5 rounded-md"
            >
              Stay
            </button>
            <button
              type="button"
              onClick={() => { resetForm(); onClose(); }}
              className="flex-1 max-w-[296px] bg-red-500 hover:opacity-90 text-white py-1.5 rounded-md"
            >
              Exit
            </button>
          </div>
        </>
      ) : (
        <div className="flex items-center justify-center gap-2 w-full">
          <button
            type="button"
            onClick={handleCancelClick}
            className="flex-1 max-w-[180px] bg-buttonBg dark:bg-darkModeCompliment border border-buttonBorder dark:border-darkModeCompliment text-black dark:text-gray-200 py-1.5 rounded-md"
          >
            {t('subscribeModal.cancel')}
          </button>
          <button
            type="button"
            onClick={handleSubscribe}
            disabled={!isValidUrl}
            className={`flex-1 max-w-[296px] text-white py-1.5 rounded-md ${
              isValidUrl
                ? 'bg-primary hover:opacity-90 dark:hover:opacity-75'
                : 'bg-primary/50 cursor-not-allowed'
            }`}
          >
            {t('subscribeModal.subscribe')}
          </button>
        </div>
      )}
    </div>
  }
  ```

- [ ] **Step 8: Remove inline `AfdaAddWebsiteModal` from the return**

  The return currently wraps everything in `<>...</>` and renders `AfdaAddWebsiteModal` as the first child. Remove that entire `AfdaAddWebsiteModal` block, along with the outer fragment if it is now unnecessary:

  Remove:
  ```tsx
  return (
    <>
      <AfdaAddWebsiteModal
        isOpen={websiteModalUrl !== null}
        onClose={() => {
          setWebsiteModalUrl(null);
          handleClose();
        }}
        initialUrl={websiteModalUrl ?? ''}
        onSaved={onWebsiteSaved}
      />
      <BaseModal ...>
  ```

  Replace with:
  ```tsx
  return (
    <BaseModal ...>
  ```

  Ensure the closing `</>` fragment is also removed so the return is just `<BaseModal>`.

- [ ] **Step 9: Remove unused imports**

  Remove the `AfdaAddWebsiteModal` import at the top of the file:
  ```tsx
  import AfdaAddWebsiteModal from '@/afda/components/AfdaAddWebsiteModal';
  ```

- [ ] **Step 10: Commit**

  ```bash
  git add src/skedulosa/components/SkedulosaSubscribeModal.tsx
  git commit -m "refactor: remove inline AfdaAddWebsiteModal from SkedulosaSubscribeModal, add cancel confirmation"
  ```

---

## Task 3: Refactor `AfdaAddWebsiteModal` — remove inline success modal, add cancel confirmation

**Files:**
- Modify: `src/afda/components/AfdaAddWebsiteModal.tsx`

- [ ] **Step 1: Remove `savedWebsite` state**

  Remove:
  ```tsx
  const [savedWebsite, setSavedWebsite] = useState<{
    name: string;
    id: string;
  } | null>(null);
  ```

- [ ] **Step 2: Add `confirmingCancel` state**

  After the existing state declarations (after `retryKey`), add:
  ```tsx
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  ```

- [ ] **Step 3: Reset `confirmingCancel` in `resetForm`**

  Inside the `resetForm` `useCallback`, add:
  ```tsx
  setConfirmingCancel(false);
  ```

  Also remove `setSavedWebsite(null)` from `resetForm` since that state no longer exists.

- [ ] **Step 4: Update `handleSave` — remove `setSavedWebsite` fallback**

  At the end of `handleSave` (around line 562), replace:
  ```tsx
  const savedName = websiteName || mapperResult.website_name;
  const savedId = result.website.id;
  handleClose();
  if (onSaved) {
    onSaved(savedName, savedId);
  } else {
    setSavedWebsite({ name: savedName, id: savedId });
  }
  ```

  With:
  ```tsx
  const savedName = websiteName || mapperResult.website_name;
  const savedId = result.website.id;
  handleClose();
  onSaved?.(savedName, savedId);
  ```

- [ ] **Step 5: Add `handleCancelClick` helper**

  Add this below `handleClose`:
  ```tsx
  const handleCancelClick = useCallback(() => {
    if (phase === 'sections' || phase === 'saving') {
      setConfirmingCancel(true);
    } else {
      handleClose();
    }
  }, [phase, handleClose]);
  ```

- [ ] **Step 6: Replace the footer JSX**

  Find the `footer` const (around line 599). Replace it entirely with:
  ```tsx
  const footer = (
    <div className="flex items-center justify-between gap-2 pb-2 w-full">
      {confirmingCancel ? (
        <>
          <p className="text-sm text-gray-600 dark:text-gray-300 flex-1 text-center">
            Exit setup? Your progress will be lost.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirmingCancel(false)}
              className="bg-buttonBg dark:bg-darkModeCompliment border border-buttonBorder dark:border-darkModeCompliment text-black dark:text-gray-200 px-4 py-1.5 rounded-md text-sm"
            >
              Stay
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="bg-red-500 hover:opacity-90 text-white px-4 py-1.5 rounded-md text-sm"
            >
              Exit
            </button>
          </div>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={handleCancelClick}
            className="flex-1 max-w-[300px] bg-buttonBg dark:bg-darkModeCompliment border border-buttonBorder dark:border-darkModeCompliment text-black dark:text-gray-200 py-1.5 rounded-md text-sm"
          >
            Cancel
          </button>

          {phase === 'error' ? (
            <button
              type="button"
              onClick={() => setRetryKey((k) => k + 1)}
              className="flex-1 max-w-[300px] bg-primary hover:opacity-90 text-white py-1.5 rounded-md text-sm"
            >
              Retry
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSave}
              disabled={phase !== 'sections' || selectedSections.size === 0}
              className={`flex-1 max-w-[300px] text-white py-1.5 rounded-md text-sm ${
                phase === 'sections' && selectedSections.size > 0
                  ? 'bg-primary hover:opacity-90 dark:hover:opacity-75'
                  : 'bg-primary/50 cursor-not-allowed'
              }`}
            >
              {phase === 'saving' ? 'Subscribing…' : 'Subscribe'}
            </button>
          )}
        </>
      )}
    </div>
  );
  ```

- [ ] **Step 7: Remove inline `AfdaAddedSubscriptionModal` from the return**

  The return is currently a fragment:
  ```tsx
  return (
    <>
      <BaseModal ...>
        ...
      </BaseModal>

      <AfdaAddedSubscriptionModal
        isOpen={savedWebsite !== null}
        onClose={() => setSavedWebsite(null)}
        websiteName={savedWebsite?.name}
        websiteId={savedWebsite?.id}
      />
    </>
  );
  ```

  Replace with just the `BaseModal` (no fragment needed):
  ```tsx
  return (
    <BaseModal
      isOpen={isOpen && analyzingStatus === 'idle'}
      onClose={handleCancelClick}
      title={title}
      width="max-w-[600px]"
      maxHeight="max-h-[95vh]"
      contentClassName="overflow-y-auto"
      containerClassName="bg-white dark:bg-darkMode"
      footer={footer}
    >
      {/* ... existing content unchanged ... */}
    </BaseModal>
  );
  ```

  Note: `onClose` on `BaseModal` is changed from `handleClose` to `handleCancelClick` so the X button also triggers the confirmation when sections are showing.

- [ ] **Step 8: Remove unused import**

  Remove:
  ```tsx
  import AfdaAddedSubscriptionModal from '@/afda/components/AfdaAddedSubscriptionModal';
  ```

- [ ] **Step 9: Commit**

  ```bash
  git add src/afda/components/AfdaAddWebsiteModal.tsx
  git commit -m "refactor: remove inline AfdaAddedSubscriptionModal from AfdaAddWebsiteModal, add cancel confirmation"
  ```

---

## Task 4: Simplify `NoSchedulePage` — remove self-managed modal

**Files:**
- Modify: `src/skedulosa/pages/NoSchedulePage.tsx`

- [ ] **Step 1: Update props and remove local state**

  Replace the entire file contents with:
  ```tsx
  import empty from '@/assets/skedulosa/images/empty.svg';
  import { Button } from '@/core-app/components/shadcn/components/ui/button';
  import { HiPlus } from 'react-icons/hi';
  import { useTheme } from '@/core-app/components/ThemeProvider';
  import NoSubscriptionDark from '@/assets/skedulosa/images/NoSubscriptionDark.svg';

  type NoSchedulePageProps = {
    onOpenSubscribe: (url?: string) => void;
  };

  const NoSchedulePage = ({ onOpenSubscribe }: NoSchedulePageProps) => {
    const { theme } = useTheme();
    const isDark =
      theme === 'dark' ||
      (theme === 'system' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);

    return (
      <div className="flex flex-col items-center justify-center h-full">
        <img
          src={isDark ? NoSubscriptionDark : empty}
          alt="No Schedule"
          className="w-2/6"
        />
        <div className="text-center w-2/6 mt-4">
          <h1 className="text-sm font-bold">No Subscriptions Yet</h1>
          <p className="text-gray-500 dark:text-gray-400 text-[12.5px] mt-2">
            Subscribe to YouTube channels, playlists, or RSS feeds and
            Subscriptions will automatically download new content on your schedule
            — even when Downlodr is closed.
          </p>
          <Button
            className="mt-4 py-2 pb-7 bg-primary text-white text-[12.5px] gap-1 hover:opacity-90 dark:hover:opacity-75"
            onClick={() => onOpenSubscribe()}
          >
            <span className="flex items-center gap-2">
              <HiPlus size={16} className="text-white dark:text-black font-bold" />
              Add your first subscription
            </span>
          </Button>
        </div>
      </div>
    );
  };

  export default NoSchedulePage;
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add src/skedulosa/pages/NoSchedulePage.tsx
  git commit -m "refactor: NoSchedulePage delegates modal open to parent via onOpenSubscribe"
  ```

---

## Task 5: Simplify `SkedulosaTableTaskbar` — remove self-managed modals

**Files:**
- Modify: `src/skedulosa/components/table/SkedulosaTableTaskbar.tsx`

- [ ] **Step 1: Update props type**

  Replace:
  ```tsx
  type SkedulosaTableTaskbarProps = {
    onSubscriptionCreated?: (channelName: string, subscriptionId: string) => void;
  };
  ```

  With:
  ```tsx
  type SkedulosaTableTaskbarProps = {
    onOpenSubscribe: (url?: string) => void;
  };
  ```

- [ ] **Step 2: Update destructured props**

  Replace:
  ```tsx
  const SkedulosaTableTaskbar = ({
    onSubscriptionCreated,
  }: SkedulosaTableTaskbarProps) => {
  ```

  With:
  ```tsx
  const SkedulosaTableTaskbar = ({
    onOpenSubscribe,
  }: SkedulosaTableTaskbarProps) => {
  ```

- [ ] **Step 3: Remove self-managed modal state**

  Remove these two state declarations:
  ```tsx
  const [isSkedulosaSubscribeModalOpen, setIsSkedulosaSubscribeModalOpen] = useState(false);
  const [isAfdaAddWebsiteModalOpen, setIsAfdaAddWebsiteModalOpen] = useState(false);
  ```

  Also remove the handler:
  ```tsx
  const handleCloseSkedulosaSubscribeModal = () => {
    setIsSkedulosaSubscribeModalOpen(false);
  };
  ```

- [ ] **Step 4: Update the Subscribe button**

  Find the Subscribe button (around line 401):
  ```tsx
  <button
    className="flex items-center justify-center gap-1 bg-primary text-white px-4 py-1 rounded-md text-[12px] hover:opacity-90 dark:hover:opacity-75"
    onClick={() => setIsSkedulosaSubscribeModalOpen(true)}
  >
  ```

  Replace `onClick`:
  ```tsx
  <button
    className="flex items-center justify-center gap-1 bg-primary text-white px-4 py-1 rounded-md text-[12px] hover:opacity-90 dark:hover:opacity-75"
    onClick={() => onOpenSubscribe()}
  >
  ```

- [ ] **Step 5: Remove self-managed modal JSX**

  Remove these two modal blocks from the JSX return (near the bottom, before `ConfirmModal` blocks):
  ```tsx
  <SkedulosaSubscribeModal
    isOpen={isSkedulosaSubscribeModalOpen}
    onClose={handleCloseSkedulosaSubscribeModal}
    onSubscriptionCreated={onSubscriptionCreated}
  />

  <AfdaAddWebsiteModal
    isOpen={isAfdaAddWebsiteModalOpen}
    onClose={() => setIsAfdaAddWebsiteModalOpen(false)}
  />
  ```

- [ ] **Step 6: Remove unused imports**

  Remove these imports (they are no longer needed in this file):
  ```tsx
  import SkedulosaSubscribeModal from '../SkedulosaSubscribeModal';
  import AfdaAddWebsiteModal from '@/afda/components/AfdaAddWebsiteModal';
  ```

- [ ] **Step 7: Commit**

  ```bash
  git add src/skedulosa/components/table/SkedulosaTableTaskbar.tsx
  git commit -m "refactor: SkedulosaTableTaskbar delegates modal open to parent via onOpenSubscribe"
  ```

---

## Task 6: Verify the full flow

- [ ] **Step 1: TypeScript check**

  Run from the project root:
  ```bash
  npx tsc --noEmit
  ```
  Expected: no errors relating to the changed files. Fix any type mismatches (e.g. if `NoSchedulePage` is used elsewhere with old props).

- [ ] **Step 2: Check for remaining references to old props**

  ```bash
  grep -r "onWebsiteSaved" src/
  grep -r "websiteModalUrl" src/
  grep -r "savedWebsite" src/afda/components/AfdaAddWebsiteModal.tsx
  grep -r "isPendingModalOpen" src/
  grep -r "isAddedSubscriptionModalOpen" src/
  ```
  Expected: all return zero matches.

- [ ] **Step 3: Manual smoke test — YouTube flow**

  Start the app and open the Skedulosa tab:
  1. Click "+ Add your first subscription" (empty state) or "Subscribe" (taskbar)
  2. Enter a YouTube channel URL → channel analysis runs → `SkedulosaSubscribeModal` shows channel info
  3. Click Cancel with URL filled in → confirmation footer appears ("Exit setup? Your progress will be lost.")
  4. Click **Stay** → confirmation dismisses, modal is still open
  5. Click Cancel again → confirmation → click **Exit** → modal closes cleanly, no stale state
  6. Re-open subscribe modal → URL field is empty, no leftover state

- [ ] **Step 4: Manual smoke test — website flow**

  1. Open subscribe modal → enter a non-YouTube URL (e.g. `https://example.com`)
  2. Click Subscribe → `SkedulosaSubscribeModal` closes, `AfdaAddWebsiteModal` opens with the URL pre-filled
  3. Wait for mapper to finish — sections appear
  4. Click Cancel → confirmation footer appears ("Exit setup? Your progress will be lost.")
  5. Click **Stay** → stays open
  6. Click Cancel → **Exit** → modal closes, flow returns to idle cleanly
  7. Re-open subscribe modal → clean state

- [ ] **Step 5: Manual smoke test — success path**

  1. Complete a YouTube subscription → `AddedSubscriptionModal` appears
  2. Click "View Subscription" → navigates to subscription detail, modal closes
  3. Complete a website subscription → `AfdaAddedSubscriptionModal` appears
  4. Click "View Subscription" → navigates to article detail, modal closes

- [ ] **Step 6: Manual smoke test — background analysis**

  1. Start a YouTube channel analysis
  2. In `GlobalScanningModal`, click "Run in Background" → orange toast appears, `SkedulosaSubscribeModal` is not visible
  3. Click "View Progress" in the toast → `ScanningModal` reappears
  4. Click Cancel in `ScanningModal` → everything clears, flow returns to idle

- [ ] **Step 7: Final commit**

  ```bash
  git add -A
  git commit -m "feat: subscription modal flow refactor — state machine, cancel confirmations, flat modal rendering"
  ```
