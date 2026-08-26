import { AlertTriangle, Download, Lock } from 'lucide-react';
import { type ReactNode } from 'react';
import { useAddonStore, PACK_STORE_KEY, type PackName } from '@/core-app/store/addonStore';

const PACK_LABELS: Record<PackName, string> = {
  'afda-backend': 'Article Fetcher',
  'video-nemesis-toolkit': 'Subscriptions',
};

interface AddonGateProps {
  packName: PackName;
  children: ReactNode;
}

export default function AddonGate({ packName, children }: AddonGateProps) {
  const label = PACK_LABELS[packName];
  const key = PACK_STORE_KEY[packName];
  const packState = useAddonStore((s) => s[key]);

  if (packState.status === 'ready') {
    return <>{children}</>;
  }

  const handleDownload = () => {
    window.addonBridge?.download(packName);
    useAddonStore.getState().setPackState(packName, { status: 'downloading', progress: 0 });
  };

  return (
    <div className="relative h-full w-full min-h-[200px] overflow-hidden">
      {/* Blurred content behind the gate — sidebar/header live outside this
          subtree, so they stay fully visible and unmodified. */}
      <div className="pointer-events-none select-none opacity-30 blur-sm h-full">
        {children}
      </div>

      {/* Gate overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-[#171717]/60 backdrop-blur-sm">
        <div className="w-full max-w-sm mx-4 rounded-xl border border-[#303030] border-t-[3px] border-t-addonAccent bg-[#1E1E1E] shadow-2xl font-manrope">
          <div className="p-6">
            {packState.status === 'downloading' ? (
              <DownloadingState label={label} progress={packState.progress ?? 0} />
            ) : packState.status === 'outdated' ? (
              <OutdatedState
                label={label}
                installedVersion={packState.installedVersion}
                onUpdate={handleDownload}
              />
            ) : (
              <NotInstalledState label={label} onDownload={handleDownload} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function NotInstalledState({
  label,
  onDownload,
}: {
  label: string;
  onDownload: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span className="flex items-center justify-center w-9 h-9 shrink-0 rounded-full bg-addonAccent/10 border border-addonAccent/30">
          <Lock size={16} className="text-addonAccent" strokeWidth={2} />
        </span>
        <div>
          <p className="text-[19px] font-bold leading-tight text-[#F5F5F5]">
            Add-on not installed
          </p>
          <p className="text-[14.5px] leading-[1.55] text-[#9D9D9D] mt-1">
            This feature requires the {label} add-on to be downloaded.
          </p>
        </div>
      </div>
      <button
        onClick={onDownload}
        className="self-start px-4 py-1.5 rounded-md bg-addonAccent hover:opacity-90 text-white text-xs font-semibold transition-opacity"
      >
        Download Add-on
      </button>
    </div>
  );
}

function DownloadingState({ label, progress }: { label: string; progress: number }) {
  return (
    <div className="flex flex-col gap-3 font-manrope">
      <div className="flex items-start gap-3">
        <span className="flex items-center justify-center w-9 h-9 shrink-0 rounded-full bg-addonAccent/10 border border-addonAccent/30">
          <Download size={16} className="text-addonAccent" strokeWidth={2} />
        </span>
        <div>
          <p className="text-[19px] font-bold leading-tight text-[#F5F5F5]">
            Downloading {label} add-on…
          </p>
          <p className="text-[14.5px] leading-[1.55] text-[#9D9D9D] mt-1">
            Please wait while the pack is installed.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <div className="h-1.5 rounded-full bg-[#303030] overflow-hidden">
          <div
            className="h-full rounded-full bg-addonAccent transition-all duration-150"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-[11px] text-[#9D9D9D]">{progress}%</span>
      </div>
    </div>
  );
}

function OutdatedState({
  label,
  installedVersion,
  onUpdate,
}: {
  label: string;
  installedVersion?: string;
  onUpdate: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 font-manrope">
      <div className="flex items-start gap-3">
        <span className="flex items-center justify-center w-9 h-9 shrink-0 rounded-full bg-addonAccent/10 border border-addonAccent/30">
          <AlertTriangle size={16} className="text-addonAccent" strokeWidth={2} />
        </span>
        <div>
          <p className="text-[19px] font-bold leading-tight text-[#F5F5F5]">
            Update required
          </p>
          <p className="text-[14.5px] leading-[1.55] text-[#9D9D9D] mt-1">
            {installedVersion && `v${installedVersion} → `}A new version is needed for this release of downlodr.
          </p>
        </div>
      </div>
      <button
        onClick={onUpdate}
        className="self-start px-4 py-1.5 rounded-md bg-addonAccent hover:opacity-90 text-white text-xs font-semibold transition-opacity"
      >
        Update {label} Add-on
      </button>
    </div>
  );
}
