import * as Clipboard from 'expo-clipboard';

export type LogLevel = 'error' | 'warn' | 'info' | 'success' | 'debug';

export interface LogEntry {
  id: string;
  ts: string;
  level: LogLevel;
  ctx: string;
  msg: string;
  data?: string;
}

const MAX_ENTRIES = 500;
const entries: LogEntry[] = [];
const listeners: Array<() => void> = [];

function notify() {
  listeners.forEach(fn => fn());
}

function add(level: LogLevel, ctx: string, msg: string, data?: unknown): LogEntry {
  const entry: LogEntry = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    ts: new Date().toISOString(),
    level,
    ctx,
    msg,
    data: data !== undefined ? JSON.stringify(data, null, 2) : undefined,
  };
  entries.unshift(entry);
  if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES;
  notify();
  return entry;
}

export const logger = {
  error:   (ctx: string, msg: string, data?: unknown) => add('error',   ctx, msg, data),
  warn:    (ctx: string, msg: string, data?: unknown) => add('warn',    ctx, msg, data),
  info:    (ctx: string, msg: string, data?: unknown) => add('info',    ctx, msg, data),
  success: (ctx: string, msg: string, data?: unknown) => add('success', ctx, msg, data),
  debug:   (ctx: string, msg: string, data?: unknown) => add('debug',   ctx, msg, data),

  getEntries: (): LogEntry[] => [...entries],

  clear: () => {
    entries.length = 0;
    notify();
  },

  subscribe: (fn: () => void): (() => void) => {
    listeners.push(fn);
    return () => {
      const i = listeners.indexOf(fn);
      if (i !== -1) listeners.splice(i, 1);
    };
  },

  formatEntry: (e: LogEntry): string => {
    const time = new Date(e.ts).toLocaleTimeString('he-IL', { hour12: false });
    const level = e.level.toUpperCase().padEnd(7);
    const base = `[${time}] ${level} ${e.ctx}\n  ${e.msg}`;
    return e.data ? `${base}\n  ${e.data}` : base;
  },

  copyEntry: async (e: LogEntry): Promise<void> => {
    await Clipboard.setStringAsync(logger.formatEntry(e));
  },

  copyAll: async (): Promise<void> => {
    const text = entries.map(logger.formatEntry).join('\n\n---\n\n');
    await Clipboard.setStringAsync(text || '(no logs)');
  },

  copyAllAsJson: async (): Promise<void> => {
    await Clipboard.setStringAsync(JSON.stringify(entries, null, 2));
  },
};
