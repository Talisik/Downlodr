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
      {/* Blurred content behind the gate */}
      <div className="pointer-events-none select-none opacity-30 blur-sm h-full">
        {children}
      </div>

      {/* Gate overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-[#0f1117]/60 backdrop-blur-sm">
        <div className="w-full max-w-sm mx-4 rounded-xl border border-[#1e293b] bg-[#161b27] p-6 shadow-2xl">
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
        <span className="text-2xl leading-none mt-0.5">🔒</span>
        <div>
          <p className="text-sm font-semibold text-[#e2e8f0]">Add-on not installed</p>
          <p className="text-xs text-[#64748b] mt-1 leading-relaxed">
            This feature requires the {label} add-on to be downloaded.
          </p>
        </div>
      </div>
      <button
        onClick={onDownload}
        className="self-start px-4 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-indigo-100 text-xs font-semibold transition-colors"
      >
        Download Add-on
      </button>
    </div>
  );
}

function DownloadingState({ label, progress }: { label: string; progress: number }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none mt-0.5">⬇</span>
        <div>
          <p className="text-sm font-semibold text-[#e2e8f0]">Downloading {label} add-on…</p>
          <p className="text-xs text-[#64748b] mt-1">Please wait while the pack is installed.</p>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <div className="h-1.5 rounded-full bg-[#1e293b] overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-indigo-400 transition-all duration-150"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-[11px] text-[#475569]">{progress}%</span>
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
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none mt-0.5">⚠️</span>
        <div>
          <p className="text-sm font-semibold text-[#e2e8f0]">Update required</p>
          <p className="text-xs text-amber-400/80 mt-1 leading-relaxed">
            {installedVersion && `v${installedVersion} → `}A new version is needed for this release of downlodr.
          </p>
        </div>
      </div>
      <button
        onClick={onUpdate}
        className="self-start px-4 py-1.5 rounded-md bg-amber-800 hover:bg-amber-700 text-amber-200 text-xs font-semibold transition-colors"
      >
        Update {label} Add-on
      </button>
    </div>
  );
}
