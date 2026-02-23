import { promises as fs } from 'node:fs';
import path from 'node:path';

const MEMORY_DIR = path.join('agent-engine', 'workflow-memory');
const EVENTS_DIR = path.join(MEMORY_DIR, 'events');
const SUMMARIES_DIR = path.join(MEMORY_DIR, 'summaries');
const CLOSED_STATUSES = new Set(['closed', 'resolved', 'done', 'completed']);

export const SUMMARY_STALE_SENTINEL = 'No project-specific workflow-memory events recorded yet.';

export type WorkflowMemoryEvent = {
  id: string;
  date?: string;
  workflow?: string;
  title?: string;
  status?: string;
  severity?: string;
  tags?: string[];
  followUp?: string;
};

type SummaryMarker = {
  month: string;
  events: number;
};

function isValidMonth(month: string): boolean {
  return /^\d{4}-\d{2}$/.test(month);
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeStatus(status: unknown): string {
  const normalized = normalizeText(status).toLowerCase();
  return normalized || 'open';
}

function normalizeSeverity(severity: unknown): string {
  const normalized = normalizeText(severity).toLowerCase();
  if (normalized === 'critical' || normalized === 'high' || normalized === 'medium' || normalized === 'low') {
    return normalized;
  }
  return 'medium';
}

function isOpenEvent(event: WorkflowMemoryEvent): boolean {
  return !CLOSED_STATUSES.has(normalizeStatus(event.status));
}

function severityRank(severity: string): number {
  if (severity === 'critical') return 4;
  if (severity === 'high') return 3;
  if (severity === 'medium') return 2;
  return 1;
}

function compareEvents(a: WorkflowMemoryEvent, b: WorkflowMemoryEvent): number {
  const aDate = normalizeText(a.date);
  const bDate = normalizeText(b.date);
  if (aDate !== bDate) {
    return bDate.localeCompare(aDate);
  }

  const aSeverity = severityRank(normalizeSeverity(a.severity));
  const bSeverity = severityRank(normalizeSeverity(b.severity));
  if (aSeverity !== bSeverity) {
    return bSeverity - aSeverity;
  }

  return normalizeText(a.id).localeCompare(normalizeText(b.id));
}

async function readMonthEvents(rootDir: string, month: string): Promise<WorkflowMemoryEvent[]> {
  const eventsPath = path.join(rootDir, EVENTS_DIR, `${month}.jsonl`);
  let raw = '';
  try {
    raw = await fs.readFile(eventsPath, 'utf8');
  } catch (error) {
    if (error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }

  const events: WorkflowMemoryEvent[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed) as WorkflowMemoryEvent;
      if (parsed && typeof parsed === 'object' && typeof parsed.id === 'string') {
        events.push(parsed);
      }
    } catch {
      // Ignore malformed rows; index/events compaction handles normalization.
    }
  }

  events.sort(compareEvents);
  return events;
}

function renderList(items: string[], emptyLine: string): string[] {
  if (items.length === 0) {
    return [`- ${emptyLine}`];
  }
  return items.map((item) => `- ${item}`);
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

function buildTopTagItems(events: WorkflowMemoryEvent[]): string[] {
  const counts = new Map<string, number>();
  for (const event of events) {
    const tags = Array.isArray(event.tags) ? event.tags : [];
    for (const tag of tags) {
      const value = normalizeText(tag).toLowerCase();
      if (!value) continue;
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }

  const entries = [...counts.entries()];
  const preferred = entries.filter(([tag]) => !tag.includes(':'));
  const source = preferred.length > 0 ? preferred : entries;

  return source
    .sort((a, b) => (a[1] === b[1] ? a[0].localeCompare(b[0]) : b[1] - a[1]))
    .slice(0, 5)
    .map(([tag, count]) => `\`${tag}\` (${count})`);
}

function buildGuardrailItems(events: WorkflowMemoryEvent[]): string[] {
  return events
    .filter((event) => {
      const tags = Array.isArray(event.tags) ? event.tags.map((tag) => normalizeText(tag).toLowerCase()) : [];
      if (tags.includes('guardrail')) {
        return true;
      }
      const title = normalizeText(event.title).toLowerCase();
      return title.includes('guardrail');
    })
    .slice(0, 5)
    .map((event) => `${normalizeText(event.date) || 'unknown-date'} - ${normalizeText(event.title) || event.id}`);
}

function buildOpenRiskItems(events: WorkflowMemoryEvent[]): string[] {
  const openEvents = events.filter((event) => isOpenEvent(event)).sort(compareEvents);
  const selected = openEvents.filter((event) => {
    const severity = normalizeSeverity(event.severity);
    return severity === 'critical' || severity === 'high';
  });
  const source = selected.length > 0 ? selected : openEvents;

  return source.slice(0, 5).map((event) => {
    const severity = normalizeSeverity(event.severity);
    const title = normalizeText(event.title) || event.id;
    return `[${severity}] ${title} (${event.id})`;
  });
}

function buildCarryOverItems(events: WorkflowMemoryEvent[]): string[] {
  const openFollowUps = events
    .filter((event) => isOpenEvent(event))
    .map((event) => normalizeText(event.followUp))
    .filter(Boolean);

  return unique(openFollowUps).slice(0, 5);
}

export function buildSummaryMarker(month: string, eventCount: number): string {
  return `<!-- workflow-memory-summary:month=${month};events=${eventCount} -->`;
}

export function parseSummaryMarker(content: string): SummaryMarker | null {
  const match = content.match(/<!--\s*workflow-memory-summary:month=(\d{4}-\d{2});events=(\d+)\s*-->/);
  if (!match) {
    return null;
  }

  return {
    month: match[1],
    events: Number.parseInt(match[2], 10),
  };
}

export function renderMonthlySummary(month: string, events: WorkflowMemoryEvent[]): string {
  const totalEvents = events.length;
  const openEvents = events.filter((event) => isOpenEvent(event)).length;
  const workflows = unique(events.map((event) => normalizeText(event.workflow)).filter(Boolean)).sort();
  const topTags = buildTopTagItems(events);
  const guardrails = buildGuardrailItems(events);
  const openRisks = buildOpenRiskItems(events);
  const carryOver = buildCarryOverItems(events);

  const lines: string[] = [
    `# ${month} Workflow Memory Summary`,
    '',
    buildSummaryMarker(month, totalEvents),
    '',
    `Generated from \`events/${month}.jsonl\` and \`index.json\` by workflow-memory scripts.`,
    'If this summary cannot be trusted, agents should skip it and read `index.json` and matching `events/*.jsonl` directly.',
    '',
    '## Snapshot',
    '',
    `- Total events: ${totalEvents}`,
    `- Open events: ${openEvents}`,
    `- Workflows represented: ${workflows.length > 0 ? workflows.join(', ') : 'none'}`,
  ];

  if (totalEvents === 0) {
    lines.push('', SUMMARY_STALE_SENTINEL);
  }

  lines.push(
    '',
    '## Top Repeated Patterns',
    '',
    ...renderList(topTags, '_No entries yet._'),
    '',
    '## Guardrails Added',
    '',
    ...renderList(guardrails, '_No entries yet._'),
    '',
    '## Open Risks',
    '',
    ...renderList(openRisks, '_No entries yet._'),
    '',
    '## Carry-Over Actions',
    '',
    ...renderList(carryOver, '_No entries yet._'),
    '',
  );

  return lines.join('\n');
}

export async function refreshMonthlySummary(month: string, rootDir = process.cwd()): Promise<void> {
  if (!isValidMonth(month)) {
    throw new Error(`Invalid month format: ${month}`);
  }

  const events = await readMonthEvents(rootDir, month);
  const summary = renderMonthlySummary(month, events);
  const summaryPath = path.join(rootDir, SUMMARIES_DIR, `${month}.md`);
  await fs.mkdir(path.dirname(summaryPath), { recursive: true });
  await fs.writeFile(summaryPath, summary, 'utf8');
}

export async function refreshMonthlySummaries(months: string[], rootDir = process.cwd()): Promise<void> {
  const uniqueMonths = unique(months.filter((month) => isValidMonth(month))).sort();
  for (const month of uniqueMonths) {
    await refreshMonthlySummary(month, rootDir);
  }
}
