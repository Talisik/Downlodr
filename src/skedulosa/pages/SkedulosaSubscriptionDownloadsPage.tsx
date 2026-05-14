/**
 * Subscription Downloads Page
 *
 * Displays all downloads tracked under each subscription.
 * Provides interface for viewing subscription download history and status.
 */
import type { Download } from '@/skedulosa/store/skedulosaStore';
import { useSkedulosaStore } from '@/skedulosa/store/skedulosaStore';
import { useMemo, useState } from 'react';
import { FiDownload } from 'react-icons/fi';

function formatDateAdded(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

function getStatusBadge(status: string): { className: string; label: string } {
  switch (status.toLowerCase()) {
    case 'completed':
      return {
        className:
          'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
        label: 'Completed',
      };
    case 'downloading':
      return {
        className:
          'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
        label: 'Downloading',
      };
    case 'queued':
      return {
        className:
          'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
        label: 'Queued',
      };
    case 'failed':
      return {
        className:
          'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
        label: 'Failed',
      };
    case 'pending':
      return {
        className:
          'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400',
        label: 'Pending',
      };
    case 'initializing':
      return {
        className:
          'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400',
        label: 'Processing',
      };
    default:
      return {
        className:
          'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400',
        label: status,
      };
  }
}

export default function SkedulosaSubscriptionDownloadsPage() {
  const subscriptions = useSkedulosaStore((s) => s.subscriptions);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedSubscription = useMemo(
    () =>
      selectedId
        ? subscriptions.find((s) => s.id === selectedId)
        : subscriptions[0] ?? null,
    [subscriptions, selectedId],
  );

  const downloadCount = selectedSubscription?.downloads.length ?? 0;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Subscription Downloads
          </h1>
          <button
            type="button"
            onClick={() => console.log(selectedSubscription)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
          >
            {' '}
          </button>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            View all downloads tracked under your subscriptions. Downloads are
            automatically recorded when initiated by a subscription schedule.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-sm">
            <FiDownload size={14} />
            {subscriptions.reduce(
              (sum, sub) => sum + sub.downloads.length,
              0,
            )}{' '}
            Total Downloads
          </div>
        </div>
      </div>

      {subscriptions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 dark:border-darkModeCompliment bg-gray-50 dark:bg-darkModeCompliment/10 p-12 text-center text-gray-600 dark:text-gray-400">
          <div className="space-y-3">
            <FiDownload size={48} className="mx-auto text-gray-400" />
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">
                No subscription downloads yet
              </h3>
              <p className="text-sm">
                Downloads initiated by subscription schedules will appear here
                automatically. Create subscriptions to start tracking scheduled
                downloads.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <section className="rounded-lg border border-gray-200 dark:border-darkModeCompliment bg-gray-50/50 dark:bg-darkModeCompliment/20 p-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
              Select subscription
            </h2>
            <div className="flex flex-wrap gap-2">
              {subscriptions.map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => setSelectedId(sub.id)}
                  className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    (selectedId ?? subscriptions[0]?.id) === sub.id
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white dark:bg-darkMode border border-gray-200 dark:border-darkModeCompliment text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-darkModeCompliment/50'
                  }`}
                >
                  {sub.source} ({sub.downloads.length})
                </button>
              ))}
            </div>
          </section>

          {selectedSubscription && (
            <section className="rounded-lg border border-gray-200 dark:border-darkModeCompliment bg-white dark:bg-darkMode overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-darkModeCompliment bg-gray-50 dark:bg-darkModeCompliment/30">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {selectedSubscription.source}
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                  {downloadCount} download
                  {downloadCount !== 1 ? 's' : ''} listed
                </p>
              </div>
              {downloadCount === 0 ? (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                  <div className="space-y-2">
                    <FiDownload size={24} className="mx-auto text-gray-400" />
                    <p>No downloads recorded for this subscription yet.</p>
                    <p className="text-xs">
                      Downloads will appear here when initiated by this
                      subscription's schedule.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-darkModeCompliment bg-gray-50 dark:bg-darkModeCompliment/20">
                        <th className="px-4 py-2 font-semibold text-gray-900 dark:text-gray-100">
                          Name
                        </th>
                        <th className="px-4 py-2 font-semibold text-gray-900 dark:text-gray-100">
                          Status
                        </th>
                        <th className="px-4 py-2 font-semibold text-gray-900 dark:text-gray-100">
                          Size
                        </th>
                        <th className="px-4 py-2 font-semibold text-gray-900 dark:text-gray-100">
                          Speed
                        </th>
                        <th className="px-4 py-2 font-semibold text-gray-900 dark:text-gray-100">
                          Date added
                        </th>
                        <th className="px-4 py-2 font-semibold text-gray-900 dark:text-gray-100">
                          ID
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedSubscription.downloads as Download[]).map(
                        (d) => (
                          <tr
                            key={d.id}
                            className="border-b border-gray-100 dark:border-darkModeCompliment/50 hover:bg-gray-50 dark:hover:bg-darkModeCompliment/20"
                          >
                            <td className="px-4 py-2 text-gray-800 dark:text-gray-200 font-medium max-w-[200px] truncate">
                              {d.name}
                            </td>
                            <td className="px-4 py-2">
                              {(() => {
                                const badge = getStatusBadge(d.status);
                                return (
                                  <span
                                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.className}`}
                                  >
                                    {badge.label}
                                  </span>
                                );
                              })()}
                            </td>
                            <td className="px-4 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                              {d.size || '—'}
                            </td>
                            <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                              {d.speed || '—'}
                            </td>
                            <td className="px-4 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                              {formatDateAdded(d.date_added)}
                            </td>
                            <td className="px-4 py-2 text-gray-500 dark:text-gray-500 text-xs font-mono max-w-[120px] truncate">
                              {d.id}
                            </td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
