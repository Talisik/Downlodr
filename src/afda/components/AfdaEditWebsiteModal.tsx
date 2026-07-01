import BaseModal from '@/downlodr/components/modal/BaseModal';
import { useAfdaWebsitesStore } from '@/afda/store/afdaWebsitesStore';
import type { Website } from '@/afda/backend/afda-backend/src/types';
import { useEffect, useState } from 'react';

interface AfdaEditWebsiteModalProps {
  isOpen: boolean;
  onClose: () => void;
  website: Website;
}

const STATUS_OPTIONS: { value: 'active' | 'paused'; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
];

const AfdaEditWebsiteModal = ({
  isOpen,
  onClose,
  website,
}: AfdaEditWebsiteModalProps) => {
  const updateWebsite = useAfdaWebsitesStore((s) => s.updateWebsite);

  const [name, setName] = useState(website.name);
  const [status, setStatus] = useState<'active' | 'paused'>(
    website.status === 'paused' ? 'paused' : 'active',
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setName(website.name);
    setStatus(website.status === 'paused' ? 'paused' : 'active');
  }, [isOpen, website]);

  const hasChanges =
    name.trim() !== website.name ||
    status !== (website.status === 'paused' ? 'paused' : 'active');

  const handleSave = async () => {
    if (!hasChanges || name.trim() === '') return;
    setIsSaving(true);

    const bridge =
      typeof window !== 'undefined' ? (window as any).afdaBridge : undefined;

    try {
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
      title="Edit Website"
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
      </div>
    </BaseModal>
  );
};

export default AfdaEditWebsiteModal;
