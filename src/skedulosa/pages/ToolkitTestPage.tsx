/**
 * ToolkitTestPage — interactive test harness for window.skedulosaBridge.
 *
 * Route: /skedulosa/toolkit-test  (no route-guard, bypasses empty-store redirect)
 *
 * Each section has a "Run" button that calls the real IPC bridge method and
 * displays the raw JSON result or error inline. Use this page to verify the
 * toolkit is wired up correctly after any IPC or handler change.
 */
import { useEffect, useRef, useState } from 'react';

// ─── tiny helpers ────────────────────────────────────────────────────────────

type Status = 'idle' | 'running' | 'ok' | 'error';

interface SectionResult {
  status: Status;
  output: string;
}

function useSectionResult() {
  const [result, setResult] = useState<SectionResult>({
    status: 'idle',
    output: '',
  });

  async function run(fn: () => Promise<unknown>) {
    setResult({ status: 'running', output: '' });
    try {
      const data = await fn();
      setResult({ status: 'ok', output: JSON.stringify(data, null, 2) });
    } catch (err) {
      setResult({
        status: 'error',
        output: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { result, run };
}

// ─── sub-components ──────────────────────────────────────────────────────────

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-gray-200 dark:border-darkModeCompliment bg-gray-50/50 dark:bg-darkModeCompliment/20 p-4 mb-5">
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-0.5">
        {title}
      </h2>
      {description && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          {description}
        </p>
      )}
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function ResultBlock({ result }: { result: SectionResult }) {
  if (result.status === 'idle') return null;

  const colors: Record<Status, string> = {
    idle: '',
    running:
      'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300',
    ok: 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300',
    error:
      'border-red-400 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400',
  };

  return (
    <pre
      className={`mt-2 rounded border p-3 text-xs overflow-auto max-h-48 whitespace-pre-wrap ${
        colors[result.status]
      }`}
    >
      {result.status === 'running' ? 'Calling IPC…' : result.output}
    </pre>
  );
}

function RunBtn({
  onClick,
  disabled,
  label = 'Run',
  variant = 'primary',
}: {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
  variant?: 'primary' | 'danger' | 'neutral';
}) {
  const base =
    'px-3 py-1.5 rounded text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed';
  const styles: Record<string, string> = {
    primary: 'bg-primary hover:bg-primary/90 text-white',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    neutral:
      'border border-gray-300 dark:border-darkModeCompliment hover:bg-gray-100 dark:hover:bg-darkModeCompliment text-gray-700 dark:text-gray-300',
  };
  return (
    <button
      type="button"
      className={`${base} ${styles[variant]}`}
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </button>
  );
}

// ─── main page ───────────────────────────────────────────────────────────────

export default function ToolkitTestPage() {
  const bridge =
    typeof window !== 'undefined' ? window.skedulosaBridge : undefined;
  const bridgeAvailable = !!bridge;

  // ── 1. connection check ──────────────────────────────────────────────────
  const connectionCheck = useSectionResult();

  // ── 2. schedules ─────────────────────────────────────────────────────────
  const schedulesList = useSectionResult();
  const scheduleCreate = useSectionResult();
  const [createdScheduleId, setCreatedScheduleId] = useState<number | null>(
    null,
  );
  const scheduleDelete = useSectionResult();

  async function handleCreateSchedule() {
    await scheduleCreate.run(async () => {
      const s = await bridge!.createSchedule({
        name: 'Test Schedule (toolkit-test)',
      });
      if (s && typeof s === 'object' && 'id' in s) {
        setCreatedScheduleId((s as { id: number }).id);
      }
      return s;
    });
  }

  async function handleDeleteSchedule() {
    if (createdScheduleId == null) return;
    await scheduleDelete.run(async () => {
      await bridge!.deleteSchedule(createdScheduleId);
      setCreatedScheduleId(null);
      return `Deleted schedule ${createdScheduleId}`;
    });
  }

  // ── 3. channels ───────────────────────────────────────────────────────────
  const channelsList = useSectionResult();
  const channelCreate = useSectionResult();
  const [createdChannelId, setCreatedChannelId] = useState<number | null>(null);
  const channelDelete = useSectionResult();

  async function handleCreateChannel() {
    if (createdScheduleId == null) {
      channelCreate.run(async () => {
        throw new Error(
          'Create a Schedule first (section 2) to get a schedule_id',
        );
      });
      return;
    }
    await channelCreate.run(async () => {
      const ch = await bridge!.createChannel({
        schedule_id: createdScheduleId,
        url: 'https://www.youtube.com/@abscbnentertainment',
        name: 'ABS',
        download_format: 'mp4',
        active: 1,
      });
      if (ch && typeof ch === 'object' && 'id' in ch) {
        setCreatedChannelId((ch as { id: number }).id);
      }
      return ch;
    });
  }

  async function handleDeleteChannel() {
    if (createdChannelId == null) return;
    await channelDelete.run(async () => {
      await bridge!.deleteChannel(createdChannelId);
      setCreatedChannelId(null);
      return `Deleted channel ${createdChannelId}`;
    });
  }

  // ── 4. channel slots ──────────────────────────────────────────────────────
  const slotsList = useSectionResult();
  const slotsReplace = useSectionResult();
  const nextRun = useSectionResult();

  // ── delete-all helpers ────────────────────────────────────────────────────
  const deleteAllSchedules = useSectionResult();
  const deleteAllChannels = useSectionResult();

  async function handleDeleteAllSchedules() {
    await deleteAllSchedules.run(async () => {
      await bridge!.stopDownloadWorker();
      const schedules = (await bridge!.listSchedules()) as Array<{
        id: number;
      }>;
      if (!Array.isArray(schedules) || schedules.length === 0)
        return 'No schedules found — nothing deleted.';
      for (const s of schedules) await bridge!.deleteSchedule(s.id);
      setCreatedScheduleId(null);
      setCreatedChannelId(null);
      return `Worker stopped. Deleted ${schedules.length} schedule(s).`;
    });
  }

  async function handleDeleteAllChannels() {
    await deleteAllChannels.run(async () => {
      await bridge!.stopDownloadWorker();
      const channels = (await bridge!.listChannels()) as Array<{ id: number }>;
      if (!Array.isArray(channels) || channels.length === 0)
        return 'No channels found — nothing deleted.';
      for (const ch of channels) await bridge!.deleteChannel(ch.id);
      setCreatedChannelId(null);
      return `Worker stopped. Deleted ${channels.length} channel(s).`;
    });
  }

  // ── 5. download tasks ─────────────────────────────────────────────────────
  const tasksList = useSectionResult();
  const tasksListAll = useSectionResult();
  const taskDelete = useSectionResult();
  const taskClearPending = useSectionResult();
  const [deleteTaskId, setDeleteTaskId] = useState('');

  // ── 6. download history ───────────────────────────────────────────────────
  const historyList = useSectionResult();

  // ── 7. intelligent schedules ──────────────────────────────────────────────
  const intelligentUpcoming = useSectionResult();
  const intelligentOverdue = useSectionResult();
  const intelligentStats = useSectionResult();
  const intelligentRefresh = useSectionResult();

  // ── 8. worker & scraper ───────────────────────────────────────────────────
  const workerStatus = useSectionResult();
  const workerStart = useSectionResult();
  const workerStop = useSectionResult();
  const scraperStop = useSectionResult();
  const scraperRunOnce = useSectionResult();
  const processLoad = useSectionResult();

  // ── 12. diagnostic: raw scraper:runOnce ──────────────────────────────────
  const [diagChannelId, setDiagChannelId] = useState('');
  const [diagLogs, setDiagLogs] = useState<string[]>([]);
  const [diagRunning, setDiagRunning] = useState(false);

  function diagLog(msg: string) {
    const ts = new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm
    setDiagLogs((prev) => [`[${ts}] ${msg}`, ...prev]);
  }

  async function handleDiagRunScraperOnce(channelId?: number) {
    if (!bridge) return;
    setDiagLogs([]);
    setDiagRunning(true);

    // Attach a one-shot status listener so we can capture every phase event
    bridge.removeScraperStatusListener();
    bridge.onScraperStatus((status) => {
      diagLog(
        `STATUS EVENT → phase="${status.phase}"${
          status.nextRunAt ? ` nextRunAt=${status.nextRunAt}` : ''
        }`,
      );
    });

    diagLog(
      channelId !== undefined
        ? `Calling bridge.runScraperOnce(channelId=${channelId}) …`
        : 'Calling bridge.runScraperOnce() — no channelId (schedule-driven mode) …',
    );

    try {
      const result = await bridge.runScraperOnce(channelId);
      diagLog(`Promise resolved. Return value: ${JSON.stringify(result)}`);
      diagLog('--- DONE (no error) ---');
    } catch (err) {
      diagLog(
        `Promise REJECTED: ${err instanceof Error ? err.message : String(err)}`,
      );
      diagLog('--- DONE (with error) ---');
    } finally {
      setDiagRunning(false);
      // Leave the status listener active so any late events still appear
    }
  }

  // ── 10. schedule & trend inference ───────────────────────────────────────
  const inferSchedule = useSectionResult();
  const [inferUrl, setInferUrl] = useState('https://www.youtube.com/@MrBeast');

  // ── 11. fetch upload dates ────────────────────────────────────────────────
  const fetchUploadDatesResult = useSectionResult();
  const [uploadDatesUrl, setUploadDatesUrl] = useState(
    'https://www.youtube.com/@MrBeast',
  );
  const [uploadDatesDaysBack, setUploadDatesDaysBack] = useState('30');

  // ── 7b. this week sched ───────────────────────────────────────────────────
  const thisWeekSched = useSectionResult();

  // ── 13. first-scrape debugger ────────────────────────────────────────────
  const [fsUrl, setFsUrl] = useState('https://www.youtube.com/@aruakabane2077');
  const [fsName, setFsName] = useState('Test Channel');
  const [fsLimit, setFsLimit] = useState('5');
  const [fsLogs, setFsLogs] = useState<string[]>([]);
  const [fsRunning, setFsRunning] = useState(false);
  const [fsTempScheduleId, setFsTempScheduleId] = useState<number | null>(null);
  const [fsTempChannelId, setFsTempChannelId] = useState<number | null>(null);

  function fsLog(msg: string) {
    const ts = new Date().toISOString().slice(11, 23);
    setFsLogs((prev) => [...prev, `[${ts}] ${msg}`]);
  }

  async function handleFirstScrapeTest() {
    if (!bridge) return;
    setFsLogs([]);
    setFsRunning(true);
    setFsTempScheduleId(null);
    setFsTempChannelId(null);

    let scheduleId: number | null = null;
    let channelId: number | null = null;

    try {
      // Step 1: create a temp schedule
      fsLog('Step 1: Creating temp schedule…');
      const sched = (await bridge.createSchedule({
        name: '__first-scrape-debug__',
      })) as { id: number };
      scheduleId = sched.id;
      setFsTempScheduleId(sched.id);
      fsLog(`Schedule created: id=${sched.id}`);

      // Step 2: create the channel fresh (last_scraped_at = null guaranteed)
      fsLog(
        `Step 2: Creating channel "${fsName}" → ${fsUrl.trim()} (first_scrape_limit=${
          fsLimit || '5'
        })…`,
      );
      const ch = (await bridge.createChannel({
        schedule_id: scheduleId,
        url: fsUrl.trim(),
        name: fsName.trim() || 'Debug Channel',
        download_format: 'mp4',
        active: 1,
        first_scrape_limit: fsLimit ? Number(fsLimit) : 5,
      })) as { id: number };
      channelId = ch.id;
      setFsTempChannelId(ch.id);
      fsLog(
        `Channel created: id=${ch.id} — last_scraped_at is null (guaranteed first scrape)`,
      );

      // Step 3: attach status listener
      bridge.removeScraperStatusListener();
      bridge.onScraperStatus((status) => {
        fsLog(
          `STATUS → phase="${status.phase}"${
            status.nextRunAt ? ` nextRunAt=${status.nextRunAt}` : ''
          }`,
        );
      });

      // Step 4: run scrape once on the fresh channel
      fsLog(`Step 3: Calling runScraperOnce(channelId=${ch.id})…`);
      await bridge.runScraperOnce(ch.id);
      fsLog('Step 3: Promise resolved.');

      // Step 5: check what landed in download_tasks
      fsLog('Step 4: Checking download_tasks…');
      const tasks = (await bridge.listDownloadTasks()) as Array<{
        id: number;
        video_url: string;
        status: string;
        channel_id: number;
      }>;
      const channelTasks = tasks.filter((t) => t.channel_id === ch.id);
      if (channelTasks.length === 0) {
        fsLog(
          '⚠ No tasks were added for this channel — yt-dlp returned 0 new videos or all were filtered.',
        );
      } else {
        fsLog(`✓ ${channelTasks.length} task(s) queued:`);
        channelTasks.forEach((t) => fsLog(`  · [${t.status}] ${t.video_url}`));
      }

      fsLog('--- DONE ---');
    } catch (err) {
      fsLog(`ERROR: ${err instanceof Error ? err.message : String(err)}`);
      fsLog('--- DONE (with error) ---');
    } finally {
      setFsRunning(false);
    }
  }

  async function handleFirstScrapeCleanup() {
    if (!bridge) return;
    try {
      if (fsTempChannelId != null) {
        await bridge.deleteChannel(fsTempChannelId);
        fsLog(`Cleanup: deleted channel id=${fsTempChannelId}`);
        setFsTempChannelId(null);
      }
      if (fsTempScheduleId != null) {
        await bridge.deleteSchedule(fsTempScheduleId);
        fsLog(`Cleanup: deleted schedule id=${fsTempScheduleId}`);
        setFsTempScheduleId(null);
      }
    } catch (err) {
      fsLog(
        `Cleanup error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // ── 9. push events ────────────────────────────────────────────────────────
  const [queueEvents, setQueueEvents] = useState<string[]>([]);
  const [scraperEvents, setScraperEvents] = useState<string[]>([]);
  const [channelLogEntries, setChannelLogEntries] = useState<string[]>([]);
  const [channelLogListening, setChannelLogListening] = useState(false);
  const channelLogListenedRef = useRef(false);
  const [listening, setListening] = useState(false);
  const listenedRef = useRef(false);

  function startListening() {
    if (listenedRef.current || !bridge) return;
    listenedRef.current = true;
    setListening(true);

    bridge.onDownloadQueuePushed((tasks) => {
      setQueueEvents((prev) => [
        `[${new Date().toLocaleTimeString()}] ${
          tasks.length
        } tasks: ${JSON.stringify(tasks).slice(0, 120)}`,
        ...prev.slice(0, 9),
      ]);
    });

    bridge.onScraperStatus((status) => {
      setScraperEvents((prev) => [
        `[${new Date().toLocaleTimeString()}] phase=${status.phase}${
          status.nextRunAt ? ` nextRunAt=${status.nextRunAt}` : ''
        }`,
        ...prev.slice(0, 9),
      ]);
    });
  }

  function stopListening() {
    bridge?.removeDownloadQueueListener();
    bridge?.removeScraperStatusListener();
    listenedRef.current = false;
    setListening(false);
  }

  function startChannelLogListening() {
    if (channelLogListenedRef.current || !bridge) return;
    channelLogListenedRef.current = true;
    setChannelLogListening(true);

    bridge.onScraperChannelLog((message) => {
      const ts = new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm
      setChannelLogEntries((prev) => {
        const next = [`[${ts}] ${message}`, ...prev];
        return next.length > 100 ? next.slice(0, 100) : next;
      });
    });
  }

  function stopChannelLogListening() {
    bridge?.removeScraperChannelLogListener();
    channelLogListenedRef.current = false;
    setChannelLogListening(false);
  }

  // cleanup on unmount
  useEffect(() => {
    return () => {
      if (listenedRef.current && bridge) {
        bridge.removeDownloadQueueListener();
        bridge.removeScraperStatusListener();
      }
      if (channelLogListenedRef.current && bridge) {
        bridge.removeScraperChannelLogListener();
      }
    };
  }, []);

  // ─────────────────────────────────────────────────────────────────────────

  if (!bridgeAvailable) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-400 bg-red-50 dark:bg-red-900/20 p-6 text-center text-red-700 dark:text-red-300">
          <p className="font-semibold text-sm">
            window.skedulosaBridge is not available
          </p>
          <p className="text-xs mt-1 opacity-75">
            Check that skedulosaHandler is imported in preload.ts and the
            Electron contextBridge.exposeInMainWorld call ran successfully.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 max-w-3xl mx-auto">
      {/* header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          Toolkit IPC Test
        </h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Calls the real{' '}
          <code className="font-mono">window.skedulosaBridge</code> methods. Run
          sections in order — Schedule → Channel → Slots → Tasks.
        </p>
        <div className="mt-2 inline-flex items-center gap-1.5 rounded bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          skedulosaBridge detected
        </div>
      </div>

      <div className="mb-4">
        <RunBtn
          onClick={() => scraperStop.run(() => bridge.stopScraper())}
          label="Stop Scraper"
          variant="danger"
        />
        <ResultBlock result={scraperStop.result} />
      </div>

      {/* ── 1. connection check ── */}
      <Section
        title="1. Connection check"
        description="listSchedules() — verifies the IPC channel reaches the SQLite database."
      >
        <RunBtn
          onClick={() => connectionCheck.run(() => bridge.listSchedules())}
          label="Ping (listSchedules)"
        />
        <ResultBlock result={connectionCheck.result} />
      </Section>

      {/* ── 5. download tasks ── */}
      <Section
        title="5. Download Tasks"
        description="listDownloadTasks — lists pending tasks, then all tasks. Delete by ID or clear all pending."
      >
        <div className="flex flex-wrap gap-2">
          <RunBtn
            onClick={() =>
              tasksList.run(() => bridge.listDownloadTasks('pending'))
            }
            label="List pending"
          />
          <RunBtn
            onClick={() => tasksListAll.run(() => bridge.listDownloadTasks())}
            label="List all"
            variant="neutral"
          />
        </div>
        <ResultBlock result={tasksList.result} />
        <ResultBlock result={tasksListAll.result} />
        <div className="border-t border-gray-200 dark:border-darkModeCompliment pt-3 mt-1 space-y-2">
          <div className="flex flex-wrap gap-2 items-center">
            <input
              type="number"
              value={deleteTaskId}
              onChange={(e) => setDeleteTaskId(e.target.value)}
              placeholder="Task ID"
              min={1}
              className="w-24 rounded border border-gray-300 dark:border-darkModeCompliment bg-white dark:bg-darkMode text-xs text-gray-800 dark:text-gray-200 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <RunBtn
              onClick={() =>
                taskDelete.run(() => {
                  const id = Number(deleteTaskId);
                  if (!id) throw new Error('Enter a valid task ID');
                  return bridge.deleteDownloadTask(id);
                })
              }
              label="Delete task by ID"
              variant="danger"
              disabled={!deleteTaskId}
            />
          </div>
          <ResultBlock result={taskDelete.result} />
          <div className="border-t border-red-200 dark:border-red-800 pt-3">
            <p className="text-xs text-red-500 dark:text-red-400 mb-2 font-medium">
              ⚠ Danger — deletes ALL pending tasks from the toolkit DB
            </p>
            <RunBtn
              onClick={() =>
                taskClearPending.run(() => bridge.clearPendingDownloadTasks())
              }
              label="Clear ALL pending tasks"
              variant="danger"
            />
            <ResultBlock result={taskClearPending.result} />
          </div>
        </div>
      </Section>

      {/* ── 6. download history ── */}
      <Section
        title="6. Download History"
        description="listDownloadHistory — all completed/failed download records"
      >
        <RunBtn
          onClick={() => historyList.run(() => bridge.listDownloadHistory())}
          label="List history"
        />
        <ResultBlock result={historyList.result} />
      </Section>

      {/* ── 8. worker & scraper ── */}
      <Section
        title="8. Worker &amp; Scraper control"
        description="getDownloadWorkerStatus / start / stop — scraper runOnce — process load"
      >
        <div className="flex flex-wrap gap-2">
          <RunBtn
            onClick={() =>
              workerStatus.run(() => bridge.getDownloadWorkerStatus())
            }
            label="Worker status"
          />
          <RunBtn
            onClick={() => workerStart.run(() => bridge.startDownloadWorker())}
            label="Start worker"
            variant="neutral"
          />
          <RunBtn
            onClick={() => workerStop.run(() => bridge.stopDownloadWorker())}
            label="Stop worker"
            variant="danger"
          />
          <RunBtn
            onClick={() => processLoad.run(() => bridge.getProcessLoad())}
            label="Process load"
            variant="neutral"
          />
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          <RunBtn
            onClick={() =>
              scraperRunOnce.run(async () => {
                await bridge.runScraperOnce();
                return 'runScraperOnce() called — check push events below';
              })
            }
            label="Scraper: run once (all)"
            variant="neutral"
          />
          <RunBtn
            onClick={() =>
              scraperRunOnce.run(async () => {
                await bridge.runScraperOnce(createdChannelId!);
                return `runScraperOnce(channelId=${createdChannelId}) called — check push events below`;
              })
            }
            label={`Scrape channel #${createdChannelId ?? '—'}`}
            variant="primary"
            disabled={createdChannelId == null}
          />
        </div>
        <ResultBlock result={workerStatus.result} />
        <ResultBlock result={workerStart.result} />
        <ResultBlock result={workerStop.result} />
        <ResultBlock result={processLoad.result} />
        <ResultBlock result={scraperRunOnce.result} />
      </Section>

      {/* ── 10. schedule & trend inference ── */}
      <Section
        title="10. Schedule &amp; Trend Inference"
        description="analyzeChannelSchedule(url) — calls inferScheduleFromChannelUrl under the hood and returns suggestedSlots, intervalDays, intelligentPrediction, and more."
      >
        <div className="flex flex-wrap gap-2 items-center">
          <input
            type="text"
            value={inferUrl}
            onChange={(e) => setInferUrl(e.target.value)}
            placeholder="https://www.youtube.com/@ChannelName"
            className="flex-1 min-w-0 rounded border border-gray-300 dark:border-darkModeCompliment bg-white dark:bg-darkMode text-xs text-gray-800 dark:text-gray-200 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <RunBtn
            onClick={() =>
              inferSchedule.run(() =>
                bridge.analyzeChannelSchedule(inferUrl.trim()),
              )
            }
            label="Analyze"
            disabled={!inferUrl.trim()}
          />
        </div>
        <ResultBlock result={inferSchedule.result} />
      </Section>

      {/* ── 12. diagnostic: raw scraper:runOnce ── */}
      <Section
        title="12. Diagnostic — raw scraper:runOnce"
        description="Calls bridge.runScraperOnce() exactly as the nemesis handler expects: optional channelId as args[0]. Captures every status event inline so you can tell whether the issue is in the package or your UI."
      >
        <div className="flex flex-wrap gap-2 items-center">
          <input
            type="number"
            value={diagChannelId}
            onChange={(e) => setDiagChannelId(e.target.value)}
            placeholder="channelId (leave blank = schedule mode)"
            min={1}
            className="w-56 rounded border border-gray-300 dark:border-darkModeCompliment bg-white dark:bg-darkMode text-xs text-gray-800 dark:text-gray-200 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <RunBtn
            onClick={() => handleDiagRunScraperOnce(undefined)}
            label="Run (no channelId)"
            disabled={diagRunning}
            variant="neutral"
          />
          <RunBtn
            onClick={() => {
              const id = diagChannelId ? Number(diagChannelId) : undefined;
              handleDiagRunScraperOnce(id);
            }}
            label={
              diagChannelId
                ? `Run (channelId=${diagChannelId})`
                : 'Run (enter channelId first)'
            }
            disabled={diagRunning || !diagChannelId}
            variant="primary"
          />
          {diagRunning && (
            <span className="text-xs text-yellow-600 dark:text-yellow-400 animate-pulse">
              Running…
            </span>
          )}
        </div>

        {/* live log */}
        {diagLogs.length > 0 && (
          <div className="mt-3 rounded border border-gray-200 dark:border-darkModeCompliment bg-white dark:bg-darkMode p-2 space-y-0.5 max-h-56 overflow-auto">
            {diagLogs.map((line, i) => {
              const isError =
                line.includes('REJECTED') || line.includes('error');
              const isStatus = line.includes('STATUS EVENT');
              const isDone = line.includes('--- DONE');
              return (
                <p
                  key={i}
                  className={`text-xs font-mono ${
                    isError
                      ? 'text-red-600 dark:text-red-400'
                      : isStatus
                      ? 'text-blue-600 dark:text-blue-400'
                      : isDone
                      ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                      : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {line}
                </p>
              );
            })}
          </div>
        )}

        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
          Expected flow: <span className="font-mono">STATUS running</span> →
          (scrape runs) → <span className="font-mono">STATUS finished</span> →
          Promise resolves.
          <br />
          If the Promise resolves but no status events appear, the package
          scraper instance is null (getScraper() returned null).
          <br />
          If Promise rejects, it&apos;s a package-side error — check the
          main-process console.
        </p>
      </Section>

      {/* ── 13. first-scrape debugger ── */}
      <Section
        title="13. First-Scrape Debugger"
        description="Creates a fresh channel (last_scraped_at = null), runs runScraperOnce, then shows exactly what tasks were queued. Use this to test any channel URL from scratch without cooldown interference."
      >
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2 items-center">
            <input
              type="text"
              value={fsUrl}
              onChange={(e) => setFsUrl(e.target.value)}
              placeholder="https://www.youtube.com/@ChannelName"
              className="flex-1 min-w-0 rounded border border-gray-300 dark:border-darkModeCompliment bg-white dark:bg-darkMode text-xs text-gray-800 dark:text-gray-200 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <input
              type="text"
              value={fsName}
              onChange={(e) => setFsName(e.target.value)}
              placeholder="Channel name"
              className="flex-1 min-w-0 rounded border border-gray-300 dark:border-darkModeCompliment bg-white dark:bg-darkMode text-xs text-gray-800 dark:text-gray-200 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <input
              type="number"
              value={fsLimit}
              onChange={(e) => setFsLimit(e.target.value)}
              placeholder="first_scrape_limit"
              min={1}
              max={50}
              className="w-36 rounded border border-gray-300 dark:border-darkModeCompliment bg-white dark:bg-darkMode text-xs text-gray-800 dark:text-gray-200 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <span className="text-xs text-gray-400">
              videos on first scrape
            </span>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <RunBtn
              onClick={handleFirstScrapeTest}
              label={fsRunning ? 'Running…' : 'Run first scrape test'}
              disabled={fsRunning || !fsUrl.trim()}
            />
            <RunBtn
              onClick={handleFirstScrapeCleanup}
              label="Clean up temp channel + schedule"
              variant="danger"
              disabled={
                fsRunning ||
                (fsTempScheduleId == null && fsTempChannelId == null)
              }
            />
            {(fsTempScheduleId != null || fsTempChannelId != null) && (
              <span className="text-xs text-yellow-600 dark:text-yellow-400">
                Temp resources: schedule={fsTempScheduleId ?? '—'} channel=
                {fsTempChannelId ?? '—'}
              </span>
            )}
          </div>
        </div>

        {/* log output */}
        {fsLogs.length > 0 && (
          <div className="mt-3 rounded border border-gray-200 dark:border-darkModeCompliment bg-white dark:bg-darkMode p-2 space-y-0.5 max-h-72 overflow-auto">
            {fsLogs.map((line, i) => {
              const isError = line.includes('ERROR') || line.includes('error');
              const isWarning = line.includes('⚠');
              const isSuccess =
                line.includes('✓') || line.includes('--- DONE ---');
              const isStatus = line.includes('STATUS →');
              return (
                <p
                  key={i}
                  className={`text-xs font-mono ${
                    isError
                      ? 'text-red-600 dark:text-red-400'
                      : isWarning
                      ? 'text-yellow-600 dark:text-yellow-400'
                      : isSuccess
                      ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                      : isStatus
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {line}
                </p>
              );
            })}
          </div>
        )}

        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
          If step 4 shows "0 tasks" after a clean first scrape, yt-dlp returned
          no videos for that URL — check the main process console for yt-dlp
          errors.
        </p>
      </Section>

      {/* ── 9. push events ── */}
      <Section
        title="9. Push events (Main → Renderer)"
        description="Subscribe to toolkit:downloadQueue:pushed and toolkit:scraper:status — then trigger a scraper run to see live events."
      >
        <div className="flex gap-2">
          {!listening ? (
            <RunBtn onClick={startListening} label="Start listening" />
          ) : (
            <RunBtn
              onClick={stopListening}
              label="Stop listening"
              variant="danger"
            />
          )}
          <span
            className={`self-center text-xs ${
              listening
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-gray-400'
            }`}
          >
            {listening ? 'Listening for events…' : 'Not listening'}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              toolkit:downloadQueue:pushed
            </p>
            <div className="rounded border border-gray-200 dark:border-darkModeCompliment bg-white dark:bg-darkMode p-2 min-h-[72px] space-y-1">
              {queueEvents.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No events yet</p>
              ) : (
                queueEvents.map((e, i) => (
                  <p
                    key={i}
                    className="text-xs text-gray-700 dark:text-gray-300 truncate"
                  >
                    {e}
                  </p>
                ))
              )}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              toolkit:scraper:status
            </p>
            <div className="rounded border border-gray-200 dark:border-darkModeCompliment bg-white dark:bg-darkMode p-2 min-h-[72px] space-y-1">
              {scraperEvents.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No events yet</p>
              ) : (
                scraperEvents.map((e, i) => (
                  <p
                    key={i}
                    className="text-xs text-gray-700 dark:text-gray-300"
                  >
                    {e}
                  </p>
                ))
              )}
            </div>
          </div>
        </div>
      </Section>

      {/* ── 14. scraper live log ── */}
      <Section
        title="14. Scraper Live Log"
        description="Forwards every [scraper] console.log from the main process in real time. Start listening, then trigger a scraper run from Section 8 or 12."
      >
        <div className="flex gap-2 items-center">
          {!channelLogListening ? (
            <RunBtn
              onClick={startChannelLogListening}
              label="Start listening"
            />
          ) : (
            <RunBtn
              onClick={stopChannelLogListening}
              label="Stop listening"
              variant="danger"
            />
          )}
          {channelLogEntries.length > 0 && (
            <RunBtn
              onClick={() => setChannelLogEntries([])}
              label="Clear"
              variant="neutral"
            />
          )}
          <span
            className={`self-center text-xs ${
              channelLogListening
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-gray-400'
            }`}
          >
            {channelLogListening ? 'Listening…' : 'Not listening'}
          </span>
        </div>

        <div className="mt-3 rounded border border-gray-200 dark:border-darkModeCompliment bg-white dark:bg-darkMode p-2 min-h-[72px] max-h-72 overflow-auto space-y-0.5">
          {channelLogEntries.length === 0 ? (
            <p className="text-xs text-gray-400 italic">No messages yet</p>
          ) : (
            channelLogEntries.map((entry, i) => {
              const isNemesis = entry.includes('Nemesis is scraping');
              return (
                <p
                  key={i}
                  className={`text-xs font-mono ${
                    isNemesis
                      ? 'text-orange-500 dark:text-orange-400'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {entry}
                </p>
              );
            })
          )}
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          Buffer capped at 100 entries. Newest entries appear at the top.
        </p>
      </Section>
    </div>
  );
}
