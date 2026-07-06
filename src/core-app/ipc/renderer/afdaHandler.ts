import { contextBridge, ipcRenderer } from 'electron';

/**
 * Renderer-side bridge for AFDA (Article Fetcher & Detail Analyzer).
 * Exposes AFDA IPC channels to the renderer via window.afdaBridge.
 */

// All 48 AFDA IPC channels from extendrChannels
const afdaChannels = {
  // Mapper
  'mapper:run': (payload: any) => ipcRenderer.invoke('mapper:run', payload),

  // Batch
  'batch:start': (payload: any) => ipcRenderer.invoke('batch:start', payload),
  'batch:cancel': () => ipcRenderer.invoke('batch:cancel'),
  'batch:get-status': () => ipcRenderer.invoke('batch:get-status'),

  // Websites
  'websites:save': (payload: any) =>
    ipcRenderer.invoke('websites:save', payload),
  'websites:delete': (id: number) => ipcRenderer.invoke('websites:delete', id),
  'websites:update': (payload: any) =>
    ipcRenderer.invoke('websites:update', payload),
  'websites:add_sections': (payload: any) =>
    ipcRenderer.invoke('websites:add_sections', payload),
  'websites:reset_initial_scrape': (id: number) =>
    ipcRenderer.invoke('websites:reset_initial_scrape', id),

  // Schedule
  'schedule:assign': (payload: any) =>
    ipcRenderer.invoke('schedule:assign', payload),
  'schedule:pause': (id: number) => ipcRenderer.invoke('schedule:pause', id),
  'schedule:resume': (id: number) => ipcRenderer.invoke('schedule:resume', id),
  'schedule:get': (id: number) => ipcRenderer.invoke('schedule:get', id),

  // Scrape
  'scrape:run_now': (payload: any) =>
    ipcRenderer.invoke('scrape:run_now', payload),
  'scrape:job_status': (id: number) =>
    ipcRenderer.invoke('scrape:job_status', id),
  'scrape:list_jobs': (payload?: any) =>
    ipcRenderer.invoke('scrape:list_jobs', payload),
  'scrape:job_size': (id: number) => ipcRenderer.invoke('scrape:job_size', id),
  'scrape:job_articles': (payload: any) =>
    ipcRenderer.invoke('scrape:job_articles', payload),

  // Articles
  'articles:list': (payload?: any) =>
    ipcRenderer.invoke('articles:list', payload),
  'articles:get': (id: number) => ipcRenderer.invoke('articles:get', id),
  'articles:reparse': (id: number) =>
    ipcRenderer.invoke('articles:reparse', id),

  // Manual Articles
  'manual_articles:parse': (payload: any) =>
    ipcRenderer.invoke('manual_articles:parse', payload),
  'manual_articles:list': (payload?: any) =>
    ipcRenderer.invoke('manual_articles:list', payload),
  'manual_articles:count': (payload?: any) =>
    ipcRenderer.invoke('manual_articles:count', payload),
  'manual_articles:get': (id: number) =>
    ipcRenderer.invoke('manual_articles:get', id),
  'manual_articles:delete': (id: number) =>
    ipcRenderer.invoke('manual_articles:delete', id),
  'manual_articles:reparse': (id: number) =>
    ipcRenderer.invoke('manual_articles:reparse', id),

  // Articles Analytics
  'articles:distinct_fqdns': () =>
    ipcRenderer.invoke('articles:distinct_fqdns'),
  'articles:distinct_section_paths': (fqdn: string) =>
    ipcRenderer.invoke('articles:distinct_section_paths', fqdn),

  // Analytics
  'analytics:get_website': (payload: any) =>
    ipcRenderer.invoke('analytics:get_website', payload),

  // Temporal Analysis
  'ta:run_section': (payload: any) =>
    ipcRenderer.invoke('ta:run_section', payload),

  // Sections
  'sections:delete': (id: number) => ipcRenderer.invoke('sections:delete', id),
  'sections:add': (payload: any) => ipcRenderer.invoke('sections:add', payload),
  'sections:set_max_articles': (payload: { section_id: number; max_articles_per_run: number | null }) =>
    ipcRenderer.invoke('sections:set_max_articles', payload),

  // Store
  'store:get_all': () => ipcRenderer.invoke('store:get_all'),

  // Articles Filtered
  'articles:list_filtered': (payload: any) =>
    ipcRenderer.invoke('articles:list_filtered', payload),
  'articles:count_filtered': (payload: any) =>
    ipcRenderer.invoke('articles:count_filtered', payload),
  'articles:export': (payload: any) =>
    ipcRenderer.invoke('articles:export', payload),

  // Settings
  'settings:get': () => ipcRenderer.invoke('settings:get'),
  'settings:set': (payload: any) => ipcRenderer.invoke('settings:set', payload),
  'settings:update_load_control': (payload: any) =>
    ipcRenderer.invoke('settings:update_load_control', payload),

  // Shell
  'shell:open_path': (path: string) =>
    ipcRenderer.invoke('shell:open_path', path),

  // Memory Monitor
  'memory:start': () => ipcRenderer.invoke('memory:start'),
  'memory:stop': () => ipcRenderer.invoke('memory:stop'),
  'memory:export': () => ipcRenderer.invoke('memory:export'),

  // Auth
  'auth:open-login': () => ipcRenderer.invoke('auth:open-login'),
  'auth:get-status': () => ipcRenderer.invoke('auth:get-status'),
  'auth:clear': () => ipcRenderer.invoke('auth:clear'),
};

// Group by category for better organization
contextBridge.exposeInMainWorld('afdaBridge', {
  // Legacy compatibility
  parseArticle: (url: string) =>
    ipcRenderer.invoke('manual_articles:parse', { url }),

  // Push-event listeners (main → renderer)
  on: {
    mapperProgress: (cb: (data: any) => void) => {
      const wrapped = (_: any, data: any) => cb(data);
      ipcRenderer.on('mapper:progress', wrapped);
      return () => ipcRenderer.removeListener('mapper:progress', wrapped);
    },
    mapperComplete: (cb: (data: any) => void) => {
      const wrapped = (_: any, data: any) => cb(data);
      ipcRenderer.on('mapper:complete', wrapped);
      return () => ipcRenderer.removeListener('mapper:complete', wrapped);
    },
    mapperError: (cb: (data: { fqdn: string; message: string }) => void) => {
      const wrapped = (_: any, data: any) => cb(data);
      ipcRenderer.on('mapper:error', wrapped);
      return () => ipcRenderer.removeListener('mapper:error', wrapped);
    },
    mapperAuthRequired: (cb: (data: any) => void) => {
      const wrapped = (_: any, data: any) => cb(data);
      ipcRenderer.on('mapper:auth_required', wrapped);
      return () => ipcRenderer.removeListener('mapper:auth_required', wrapped);
    },
    scrapeArticleSaved: (cb: (data: { job_id: number; article_id: number; section_id: number; url: string }) => void) => {
      const wrapped = (_: any, data: any) => cb(data);
      ipcRenderer.on('scrape:article_saved', wrapped);
      return () => ipcRenderer.removeListener('scrape:article_saved', wrapped);
    },
  },

  // Categorized access
  mapper: {
    run: afdaChannels['mapper:run'],
  },

  batch: {
    start: afdaChannels['batch:start'],
    cancel: afdaChannels['batch:cancel'],
    getStatus: afdaChannels['batch:get-status'],
  },

  websites: {
    save: afdaChannels['websites:save'],
    delete: afdaChannels['websites:delete'],
    update: afdaChannels['websites:update'],
    addSections: afdaChannels['websites:add_sections'],
    resetInitialScrape: afdaChannels['websites:reset_initial_scrape'],
  },

  schedule: {
    assign: afdaChannels['schedule:assign'],
    pause: afdaChannels['schedule:pause'],
    resume: afdaChannels['schedule:resume'],
    get: afdaChannels['schedule:get'],
  },

  scrape: {
    runNow: afdaChannels['scrape:run_now'],
    jobStatus: afdaChannels['scrape:job_status'],
    listJobs: afdaChannels['scrape:list_jobs'],
    jobSize: afdaChannels['scrape:job_size'],
    jobArticles: afdaChannels['scrape:job_articles'],
  },

  articles: {
    list: afdaChannels['articles:list'],
    get: afdaChannels['articles:get'],
    reparse: afdaChannels['articles:reparse'],
    distinctFqdns: afdaChannels['articles:distinct_fqdns'],
    distinctSectionPaths: afdaChannels['articles:distinct_section_paths'],
    listFiltered: afdaChannels['articles:list_filtered'],
    countFiltered: afdaChannels['articles:count_filtered'],
    export: afdaChannels['articles:export'],
  },

  manualArticles: {
    parse: afdaChannels['manual_articles:parse'],
    list: afdaChannels['manual_articles:list'],
    count: afdaChannels['manual_articles:count'],
    get: afdaChannels['manual_articles:get'],
    delete: afdaChannels['manual_articles:delete'],
    reparse: afdaChannels['manual_articles:reparse'],
  },

  analytics: {
    getWebsite: afdaChannels['analytics:get_website'],
    runSection: afdaChannels['ta:run_section'],
  },

  sections: {
    delete: afdaChannels['sections:delete'],
    add: afdaChannels['sections:add'],
    setMaxArticles: afdaChannels['sections:set_max_articles'],
  },

  store: {
    getAll: afdaChannels['store:get_all'],
  },

  settings: {
    get: afdaChannels['settings:get'],
    set: afdaChannels['settings:set'],
    updateLoadControl: afdaChannels['settings:update_load_control'],
  },

  shell: {
    openPath: afdaChannels['shell:open_path'],
  },

  memory: {
    start: afdaChannels['memory:start'],
    stop: afdaChannels['memory:stop'],
    export: afdaChannels['memory:export'],
  },

  auth: {
    openLogin: afdaChannels['auth:open-login'],
    getStatus: afdaChannels['auth:get-status'],
    clear: afdaChannels['auth:clear'],
  },
});
