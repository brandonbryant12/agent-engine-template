#!/usr/bin/env node

import { execFile as execFileCallback } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { runScript } from "../lib/effect-script";

const execFile = promisify(execFileCallback);

const MEMORY_ROOT_PATH = "agent-engine/workflow-memory";
const EVENTS_PATH = `${MEMORY_ROOT_PATH}/events`;
const INDEX_PATH = `${MEMORY_ROOT_PATH}/index.json`;
const SUMMARIES_PATH = `${MEMORY_ROOT_PATH}/summaries`;
const MEMORY_PATHS = [EVENTS_PATH, INDEX_PATH, SUMMARIES_PATH] as const;

const DEFAULT_REMOTE = "origin";
const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_COMMIT_MESSAGE = "chore(workflow-memory): append automation memory";

const USAGE = `Usage:
  pnpm workflow-memory:sync \\
    [--remote origin] \\
    [--branch <current-branch>] \\
    [--message "chore(workflow-memory): append automation memory"] \\
    [--max-attempts 5] \\
    [--dry-run]

Notes:
  - Stages and commits only workflow-memory append artifacts:
    - agent-engine/workflow-memory/events/*.jsonl
    - agent-engine/workflow-memory/index.json
    - agent-engine/workflow-memory/summaries/*.md
  - Retries push on non-fast-forward and auto-resolves append-only memory conflicts.
  - Aborts if non-memory conflicts appear during rebase.
`;

type CommandResult = {
  code: number;
  stdout: string;
  stderr: string;
};

type EventRecord = Record<string, unknown> & {
  id: string;
};

type IndexRow = {
  id: string;
  date: string;
  month: string;
  workflow: string;
  title: string;
  severity: string;
  status: string;
  tags: string[];
  eventFile: string;
  importance?: number;
  recency?: number;
  confidence?: number;
  hasScenario?: true;
  scenarioSkill?: string;
};

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      continue;
    }

    const key = token.slice(2).replace(/-/g, "_");
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = "true";
      continue;
    }

    args[key] = next;
    i += 1;
  }
  return args;
}

function toFsPath(repoPath: string): string {
  return path.join(process.cwd(), ...repoPath.split("/"));
}

function combineOutput(result: CommandResult): string {
  return [result.stdout.trim(), result.stderr.trim()].filter(Boolean).join("\n");
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isEventFile(pathname: string): boolean {
  return pathname.startsWith(`${EVENTS_PATH}/`) && pathname.endsWith(".jsonl");
}

function isSummaryFile(pathname: string): boolean {
  return pathname.startsWith(`${SUMMARIES_PATH}/`) && pathname.endsWith(".md");
}

function isMemoryConflictPath(pathname: string): boolean {
  return pathname === INDEX_PATH || isEventFile(pathname) || isSummaryFile(pathname);
}

function isNonFastForwardPush(output: string): boolean {
  return /(non-fast-forward|fetch first|failed to push some refs|rejected)/i.test(output);
}

function isNoChangesToCommit(output: string): boolean {
  return /(nothing to commit|no changes added to commit)/i.test(output);
}

function isNoRebaseInProgress(output: string): boolean {
  return /(no rebase in progress|no rebase in progress\?)/i.test(output);
}

function isEmptyRebaseStep(output: string): boolean {
  return /(previous cherry-pick is now empty|patch is empty|nothing to commit)/i.test(output);
}

function inferMonth(eventDate: string, eventFilePath: string): string {
  if (isIsoDate(eventDate)) {
    return eventDate.slice(0, 7);
  }

  const basename = path.basename(eventFilePath);
  const match = basename.match(/^(\d{4}-\d{2})\.jsonl$/);
  return match?.[1] ?? "";
}

function compareEventRecords(a: EventRecord, b: EventRecord): number {
  const aDate = typeof a.date === "string" ? a.date : "";
  const bDate = typeof b.date === "string" ? b.date : "";
  if (aDate === bDate) {
    return a.id.localeCompare(b.id);
  }
  return aDate.localeCompare(bDate);
}

function compareIndexRows(a: IndexRow, b: IndexRow): number {
  if (a.date === b.date) {
    return a.id.localeCompare(b.id);
  }
  return b.date.localeCompare(a.date);
}

function parseEventLine(rawLine: string): EventRecord | null {
  const line = rawLine.trim();
  if (!line) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  const event = parsed as Record<string, unknown>;
  if (typeof event.id !== "string" || !event.id.trim()) {
    return null;
  }

  return event as EventRecord;
}

async function runCommand(
  command: string,
  args: string[],
  options: { allowFailure?: boolean } = {},
): Promise<CommandResult> {
  const allowFailure = options.allowFailure ?? false;

  try {
    const result = await execFile(command, args, {
      cwd: process.cwd(),
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
      env: {
        ...process.env,
        GIT_EDITOR: process.env.GIT_EDITOR ?? "true",
      },
    });

    return {
      code: 0,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
    };
  } catch (error) {
    const failed = error as Error & {
      stdout?: string;
      stderr?: string;
      code?: number;
    };

    const result: CommandResult = {
      code: typeof failed.code === "number" ? failed.code : 1,
      stdout: failed.stdout ?? "",
      stderr: failed.stderr ?? "",
    };

    if (allowFailure) {
      return result;
    }

    const details = combineOutput(result);
    throw new Error(
      details
        ? `${command} ${args.join(" ")} failed:\n${details}`
        : `${command} ${args.join(" ")} failed.`,
    );
  }
}

async function isRebaseInProgress(): Promise<boolean> {
  const mergePath = (await runCommand("git", ["rev-parse", "--git-path", "rebase-merge"])).stdout.trim();
  const applyPath = (await runCommand("git", ["rev-parse", "--git-path", "rebase-apply"])).stdout.trim();

  for (const candidate of [mergePath, applyPath]) {
    if (!candidate) continue;
    try {
      await fs.access(candidate);
      return true;
    } catch {
      // Ignore missing paths.
    }
  }

  return false;
}

async function getConflictedPaths(): Promise<string[]> {
  const result = await runCommand("git", ["diff", "--name-only", "--diff-filter=U"]);
  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

async function readConflictStage(stage: 2 | 3, repoPath: string): Promise<string> {
  const result = await runCommand("git", ["show", `:${stage}:${repoPath}`], { allowFailure: true });
  if (result.code !== 0) {
    return "";
  }
  return result.stdout;
}

function mergeEventJsonl(upstreamSource: string, localSource: string): string {
  const byId = new Map<string, EventRecord>();
  const fallbackLines = new Set<string>();

  const ingest = (source: string): void => {
    for (const rawLine of source.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line) continue;

      const parsed = parseEventLine(line);
      if (!parsed) {
        fallbackLines.add(line);
        continue;
      }

      byId.set(parsed.id, parsed);
    }
  };

  ingest(upstreamSource);
  ingest(localSource);

  const events = Array.from(byId.values()).sort(compareEventRecords);
  const lines = [
    ...events.map((event) => JSON.stringify(event)),
    ...Array.from(fallbackLines).sort(),
  ];

  if (lines.length === 0) {
    return "";
  }

  return `${lines.join("\n")}\n`;
}

async function resolveEventConflict(repoPath: string): Promise<void> {
  const upstream = await readConflictStage(2, repoPath);
  const local = await readConflictStage(3, repoPath);
  const merged = mergeEventJsonl(upstream, local);
  const targetPath = toFsPath(repoPath);
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, merged, "utf8");
}

async function resolveSummaryConflict(repoPath: string): Promise<void> {
  const upstream = await readConflictStage(2, repoPath);
  const local = await readConflictStage(3, repoPath);

  const upstreamScore = upstream.trim().length;
  const localScore = local.trim().length;
  const chosen = localScore >= upstreamScore ? local : upstream;

  if (!chosen.trim()) {
    return;
  }

  const targetPath = toFsPath(repoPath);
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, chosen.endsWith("\n") ? chosen : `${chosen}\n`, "utf8");
}

function toNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}

function toIndexRow(event: EventRecord, eventFilePath: string): IndexRow {
  const date = typeof event.date === "string" ? event.date : "";
  const month = inferMonth(date, eventFilePath);
  const scenario = event.scenario as Record<string, unknown> | undefined;
  const scenarioSkill = scenario && typeof scenario.skill === "string" ? scenario.skill : undefined;
  const importance = toNumber(event.importance);
  const recency = toNumber(event.recency);
  const confidence = toNumber(event.confidence);

  return {
    id: event.id,
    date,
    month,
    workflow: typeof event.workflow === "string" ? event.workflow : "",
    title: typeof event.title === "string" ? event.title : "",
    severity: typeof event.severity === "string" ? event.severity : "medium",
    status: typeof event.status === "string" ? event.status : "open",
    tags: toStringList(event.tags),
    ...(importance === undefined ? {} : { importance }),
    ...(recency === undefined ? {} : { recency }),
    ...(confidence === undefined ? {} : { confidence }),
    ...(scenarioSkill ? { hasScenario: true as const, scenarioSkill } : {}),
    eventFile: path.relative(toFsPath(MEMORY_ROOT_PATH), toFsPath(eventFilePath)).split(path.sep).join("/"),
  };
}

async function rebuildIndexFromEvents(): Promise<void> {
  const eventsDirectory = toFsPath(EVENTS_PATH);
  let entries: string[] = [];

  try {
    const files = await fs.readdir(eventsDirectory, { withFileTypes: true });
    entries = files
      .filter((entry) => entry.isFile() && entry.name.endsWith(".jsonl"))
      .map((entry) => `${EVENTS_PATH}/${entry.name}`)
      .sort();
  } catch (error) {
    if (error && (error as NodeJS.ErrnoException).code === "ENOENT") {
      entries = [];
    } else {
      throw error;
    }
  }

  const rows: IndexRow[] = [];
  for (const eventFilePath of entries) {
    const raw = await fs.readFile(toFsPath(eventFilePath), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const event = parseEventLine(line);
      if (!event) continue;
      rows.push(toIndexRow(event, eventFilePath));
    }
  }

  rows.sort(compareIndexRows);
  const deduped: IndexRow[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.id)) {
      continue;
    }
    seen.add(row.id);
    deduped.push(row);
  }

  await fs.mkdir(path.dirname(toFsPath(INDEX_PATH)), { recursive: true });
  await fs.writeFile(toFsPath(INDEX_PATH), `${JSON.stringify(deduped, null, 2)}\n`, "utf8");
}

async function continueOrSkipRebase(): Promise<void> {
  const result = await runCommand("git", ["rebase", "--continue"], { allowFailure: true });
  if (result.code === 0) {
    return;
  }

  const output = combineOutput(result);
  if (isNoRebaseInProgress(output)) {
    return;
  }

  if (isEmptyRebaseStep(output)) {
    await runCommand("git", ["rebase", "--skip"]);
    return;
  }

  const conflicts = await getConflictedPaths();
  if (conflicts.length > 0) {
    return;
  }

  throw new Error(`git rebase --continue failed:\n${output}`);
}

async function resolveRebaseConflicts(): Promise<void> {
  while (await isRebaseInProgress()) {
    const conflicts = await getConflictedPaths();
    if (conflicts.length === 0) {
      await continueOrSkipRebase();
      continue;
    }

    const unexpected = conflicts.filter((pathname) => !isMemoryConflictPath(pathname));
    if (unexpected.length > 0) {
      await runCommand("git", ["rebase", "--abort"], { allowFailure: true });
      throw new Error(
        `Concurrent update introduced non-memory conflicts: ${unexpected.join(", ")}. Rebase aborted.`,
      );
    }

    let needsIndexRebuild = false;
    const filesToStage = new Set<string>();

    for (const pathname of conflicts) {
      if (isEventFile(pathname)) {
        await resolveEventConflict(pathname);
        needsIndexRebuild = true;
        filesToStage.add(pathname);
        continue;
      }

      if (pathname === INDEX_PATH) {
        needsIndexRebuild = true;
        continue;
      }

      if (isSummaryFile(pathname)) {
        await resolveSummaryConflict(pathname);
        filesToStage.add(pathname);
        continue;
      }
    }

    if (needsIndexRebuild) {
      await rebuildIndexFromEvents();
      filesToStage.add(INDEX_PATH);
    }

    if (filesToStage.size > 0) {
      await runCommand("git", ["add", "--", ...Array.from(filesToStage)]);
    }

    await continueOrSkipRebase();
  }
}

async function rebaseOnto(baseRef: string): Promise<void> {
  const result = await runCommand("git", ["rebase", baseRef], { allowFailure: true });
  if (result.code === 0) {
    return;
  }

  if (!(await isRebaseInProgress())) {
    throw new Error(`git rebase ${baseRef} failed:\n${combineOutput(result)}`);
  }

  await resolveRebaseConflicts();
}

async function stageMemoryChanges(): Promise<void> {
  await runCommand("git", ["add", "--", ...MEMORY_PATHS]);
}

async function hasStagedMemoryChanges(): Promise<boolean> {
  const result = await runCommand(
    "git",
    ["diff", "--cached", "--quiet", "--", ...MEMORY_PATHS],
    { allowFailure: true },
  );

  if (result.code === 0) {
    return false;
  }
  if (result.code === 1) {
    return true;
  }

  throw new Error(`Unable to inspect staged workflow-memory changes:\n${combineOutput(result)}`);
}

async function commitMemoryChanges(message: string): Promise<boolean> {
  const result = await runCommand(
    "git",
    ["commit", "-m", message, "--", ...MEMORY_PATHS],
    { allowFailure: true },
  );

  if (result.code === 0) {
    return true;
  }

  const output = combineOutput(result);
  if (isNoChangesToCommit(output)) {
    return false;
  }

  throw new Error(`Unable to commit workflow-memory changes:\n${output}`);
}

async function fetchBranch(remote: string, branch: string): Promise<void> {
  const result = await runCommand("git", ["fetch", remote, branch], { allowFailure: true });
  if (result.code === 0) {
    return;
  }

  throw new Error(`git fetch ${remote} ${branch} failed:\n${combineOutput(result)}`);
}

async function pushWithRetry(remote: string, branch: string, maxAttempts: number): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const pushResult = await runCommand(
      "git",
      ["push", remote, `HEAD:${branch}`],
      { allowFailure: true },
    );

    if (pushResult.code === 0) {
      console.log(`Workflow-memory push succeeded on attempt ${attempt}/${maxAttempts}.`);
      return;
    }

    const output = combineOutput(pushResult);
    if (!isNonFastForwardPush(output)) {
      throw new Error(`git push failed:\n${output}`);
    }

    if (attempt === maxAttempts) {
      throw new Error(
        `Unable to push workflow-memory changes after ${maxAttempts} attempts due to concurrent updates.`,
      );
    }

    console.log(
      `Push rejected by concurrent updates (attempt ${attempt}/${maxAttempts}). Rebasing and retrying...`,
    );
    await fetchBranch(remote, branch);
    await rebaseOnto(`${remote}/${branch}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help === "true" || args.h === "true") {
    console.log(USAGE);
    return;
  }

  const maxAttempts = Number(args.max_attempts ?? DEFAULT_MAX_ATTEMPTS);
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new Error("--max-attempts must be an integer >= 1.");
  }

  const remote = (args.remote ?? DEFAULT_REMOTE).trim();
  const message = (args.message ?? DEFAULT_COMMIT_MESSAGE).trim();
  const dryRun = args.dry_run === "true";

  await runCommand("git", ["rev-parse", "--is-inside-work-tree"]);
  const currentBranch = (await runCommand("git", ["rev-parse", "--abbrev-ref", "HEAD"])).stdout.trim();
  if (!currentBranch || currentBranch === "HEAD") {
    throw new Error("workflow-memory:sync requires a named branch (detached HEAD is not supported).");
  }

  const branch = (args.branch ?? currentBranch).trim();
  if (!branch) {
    throw new Error("Target branch cannot be empty.");
  }

  await stageMemoryChanges();
  if (!(await hasStagedMemoryChanges())) {
    console.log("No workflow-memory changes to sync.");
    return;
  }

  const committed = await commitMemoryChanges(message);
  if (!committed) {
    console.log("No workflow-memory commit created (nothing to commit).");
    return;
  }

  if (dryRun) {
    console.log("Dry-run mode enabled: committed workflow-memory changes locally; push skipped.");
    return;
  }

  await pushWithRetry(remote, branch, maxAttempts);
  console.log(`Workflow-memory sync complete: ${remote}/${branch}`);
}

runScript(main);
