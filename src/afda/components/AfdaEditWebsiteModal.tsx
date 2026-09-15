import BaseModal from '@/downlodr/components/modal/BaseModal';
import {
  useAfdaWebsitesStore,
  type WebsiteListItem,
} from '@/afda/store/afdaWebsitesStore';
import { useEffect, useState } from 'react';

interface AfdaEditWebsiteModalProps {
  isOpen: boolean;
  onClose: () => void;
  website: WebsiteListItem;
}

const STATUS_OPTIONS: { value: 'active' | 'paused'; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
];

const SOCIAL_PRESETS: { value: string; label: string }[] = [
  { value: 'every_15m', label: 'Every 15 minutes' },
  { value: 'every_30m', label: 'Every 30 minutes' },
  { value: 'every_1h', label: 'Every hour' },
  { value: 'every_6h', label: 'Every 6 hours' },
  { value: 'daily', label: 'Daily' },
];

const AfdaEditWebsiteModal = ({
  isOpen,
  onClose,
  website,
}: AfdaEditWebsiteModalProps) => {
  const updateWebsite = useAfdaWebsitesStore((s) => s.updateWebsite);
  const isSocial = website.kind === 'social';

  const [name, setName] = useState(website.name);
  const [status, setStatus] = useState<'active' | 'paused'>(
    website.status === 'paused' ? 'paused' : 'active',
  );
  const [account, setAccount] = useState(website.socialAccount ?? '');
  const [preset, setPreset] = useState(website.socialPreset ?? 'every_1h');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setName(website.name);
    setStatus(website.status === 'paused' ? 'paused' : 'active');
    setAccount(website.socialAccount ?? '');
    setPreset(website.socialPreset ?? 'every_1h');
  }, [isOpen, website]);

  const baseChanged =
    name.trim() !== website.name ||
    status !== (website.status === 'paused' ? 'paused' : 'active');
  const socialChanged =
    isSocial &&
    (account !== (website.socialAccount ?? '') ||
      preset !== (website.socialPreset ?? 'every_1h'));
  const hasChanges = baseChanged || socialChanged;

  const handleSaveSocial = async (bridge: any) => {
    if (!bridge?.social || website.socialId == null) {
      updateWebsite({ ...website, name: name.trim(), status });
      return;
    }
    // Name / account
    await bridge.social.sources.update({
      id: website.socialId,
      label: name.trim(),
      account: account.trim() || null,
    });
    // Schedule preset
    if (preset !== (website.socialPreset ?? 'every_1h')) {
      await bridge.social.schedule.assign({
        id: website.socialId,
        config: { type: 'preset', preset },
      });
    }
    // Status (pause/resume the source)
    const wasActive = website.status !== 'paused';
    if (status === 'paused' && wasActive) {
      await bridge.social.schedule.pause({ id: website.socialId });
    } else if (status === 'active' && !wasActive) {
      await bridge.social.schedule.resume({ id: website.socialId });
    }
    updateWebsite({
      ...website,
      name: name.trim(),
      status,
      socialAccount: account.trim() || null,
      socialPreset: preset,
    });
  };

  const handleSave = async () => {
    if (!hasChanges || name.trim() === '') return;
    setIsSaving(true);

    const bridge =
      typeof window !== 'undefined' ? (window as any).afdaBridge : undefined;

    try {
      if (isSocial) {
        await handleSaveSocial(bridge);
      } else {
        const patch: Record<string, unknown> = {};
        if (name.trim() !== website.name) patch.website_name = name.trim();
        if (status !== (website.status === 'paused' ? 'paused' : 'active'))
          patch.status = status;

        if (bridge) {
          const result = await bridge.websites.update({
            id: parseInt(website.id),
            patch,
          });
          if (result?.website) {
            updateWebsite(result.website);
          } else {
            updateWebsite({ ...website, name: name.trim(), status });
          }
        } else {
          updateWebsite({ ...website, name: name.trim(), status });
        }
      }
    } catch (err) {
      console.error('[AfdaEditWebsiteModal] update failed:', err);
      updateWebsite({ ...website, name: name.trim(), status });
    } finally {
      setIsSaving(false);
      onClose();
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={isSocial ? 'Edit Social Source' : 'Edit Website'}
      width="max-w-md"
      footer={
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs rounded-md border border-gray-300 dark:border-darkModeCompliment text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-darkModeCompliment/50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || name.trim() === '' || isSaving}
            className="px-4 py-1.5 text-xs rounded-md bg-primary text-white hover:opacity-90 dark:hover:opacity-75 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
      }
    >
      <div className="py-4 space-y-4 text-[12.5px] -mt-6">
        <div className="space-y-1">
          <label className="text-xs text-gray-500 dark:text-gray-400">
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-[#0000000D] dark:bg-darkModeCompliment border border-[#E8E8E8] dark:border-darkModeCompliment text-black dark:text-gray-100 px-2.5 py-1.5 rounded-md text-xs h-8"
          />
          {name.trim() === '' && (
            <span className="text-red-500 text-[10px]">Name is required</span>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-xs text-gray-500 dark:text-gray-400">
            URL
          </label>
          <input
            type="text"
            value={website.url}
            readOnly
            className="w-full bg-[#0000000D] dark:bg-darkModeCompliment border border-[#E8E8E8] dark:border-darkModeCompliment text-black dark:text-gray-100 px-2.5 py-1.5 rounded-md text-xs h-8 cursor-default opacity-70"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-gray-500 dark:text-gray-400">
            Status
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as 'active' | 'paused')}
            className="w-full bg-[#0000000D] dark:bg-darkModeCompliment border border-[#E8E8E8] dark:border-darkModeCompliment text-black dark:text-gray-100 px-2.5 py-1.5 rounded-md text-xs h-8"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {isSocial && (
          <>
            <div className="space-y-1">
              <label className="text-xs text-gray-500 dark:text-gray-400">
                Check Frequency
              </label>
              <select
                value={preset}
                onChange={(e) => setPreset(e.target.value)}
                className="w-full bg-[#0000000D] dark:bg-darkModeCompliment border border-[#E8E8E8] dark:border-darkModeCompliment text-black dark:text-gray-100 px-2.5 py-1.5 rounded-md text-xs h-8"
              >
                {SOCIAL_PRESETS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-gray-500 dark:text-gray-400">
                Login Account{' '}
                <span className="text-gray-400 dark:text-gray-500">
                  (optional)
                </span>
              </label>
              <input
                type="text"
                value={account}
                placeholder="accounts.json username"
                onChange={(e) => setAccount(e.target.value)}
                className="w-full bg-[#0000000D] dark:bg-darkModeCompliment border border-[#E8E8E8] dark:border-darkModeCompliment text-black dark:text-gray-100 px-2.5 py-1.5 rounded-md text-xs h-8"
              />
            </div>
          </>
        )}
      </div>
    </BaseModal>
  );
};

export default AfdaEditWebsiteModal;
