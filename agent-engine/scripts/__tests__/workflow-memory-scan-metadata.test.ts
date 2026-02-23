import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '..', '..', '..');
const addEntryScriptPath = path.join(currentDir, "..", "workflow-memory", "add-entry.ts");
const retrieveScriptPath = path.join(currentDir, "..", "workflow-memory", "retrieve.ts");
const tsxBinaryPath = path.join(repoRoot, "node_modules", ".bin", "tsx");

const tempDirs: string[] = [];

async function createWorkflowMemoryFixture(indexRows: unknown[] = []): Promise<string> {
  const fixtureDir = await mkdtemp(path.join(os.tmpdir(), "workflow-memory-scan-"));
  tempDirs.push(fixtureDir);

  const memoryRoot = path.join(fixtureDir, "agent-engine", "workflow-memory");
  await mkdir(path.join(memoryRoot, "events"), { recursive: true });
  await writeFile(path.join(memoryRoot, "index.json"), `${JSON.stringify(indexRows, null, 2)}\n`, "utf8");

  return fixtureDir;
}

function runWorkflowMemoryScript(scriptPath: string, args: string[], cwd: string) {
  return spawnSync(tsxBinaryPath, [scriptPath, ...args], {
    cwd,
    encoding: "utf8",
  });
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) =>
      rm(dir, {
        recursive: true,
        force: true,
      }),
    ),
  );
});

describe("workflow-memory structured scan metadata", () => {
  it("writes scan metadata to events and index rows", async () => {
    const fixtureDir = await createWorkflowMemoryFixture();
    const result = runWorkflowMemoryScript(
      addEntryScriptPath,
      [
        "--id",
        "scan-metadata-entry",
        "--date",
        "2026-02-23",
        "--workflow",
        "Periodic Scans",
        "--title",
        "best-practice-researcher: scan entry",
        "--trigger",
        "test",
        "--finding",
        "structured metadata check",
        "--evidence",
        "tests",
        "--follow-up",
        "none",
        "--owner",
        "@automation",
        "--status",
        "open",
        "--tags",
        "best-practice-researcher,periodic-scans",
        "--scan-walk-mode",
        "weighted-random",
        "--scan-scope",
        "meso",
        "--scan-domain",
        "api-contracts-orpc-hono",
        "--scan-signal",
        "4",
      ],
      fixtureDir,
    );

    expect(result.status).toBe(0);

    const eventsPath = path.join(
      fixtureDir,
      "agent-engine",
      "workflow-memory",
      "events",
      "2026-02.jsonl",
    );
    const eventLines = (await readFile(eventsPath, "utf8")).trim().split(/\r?\n/);
    const event = JSON.parse(eventLines[0]) as { scan?: Record<string, unknown> };
    expect(event.scan).toEqual({
      walkMode: "weighted-random",
      scope: "meso",
      domain: "api-contracts-orpc-hono",
      signal: "4",
    });

    const indexPath = path.join(fixtureDir, "agent-engine", "workflow-memory", "index.json");
    const indexRows = JSON.parse(await readFile(indexPath, "utf8")) as Array<{
      scan?: Record<string, unknown>;
    }>;
    expect(indexRows[0]?.scan).toEqual({
      walkMode: "weighted-random",
      scope: "meso",
      domain: "api-contracts-orpc-hono",
      signal: "4",
    });
  }, 20_000);

  it("rejects best-practice Periodic Scans entries that omit scan metadata", async () => {
    const fixtureDir = await createWorkflowMemoryFixture();
    const result = runWorkflowMemoryScript(
      addEntryScriptPath,
      [
        "--id",
        "scan-metadata-missing",
        "--date",
        "2026-02-23",
        "--workflow",
        "Periodic Scans",
        "--title",
        "best-practice-researcher: missing metadata",
        "--trigger",
        "test",
        "--finding",
        "missing structured metadata",
        "--evidence",
        "tests",
        "--follow-up",
        "none",
        "--owner",
        "@automation",
        "--status",
        "open",
        "--tags",
        "best-practice-researcher,periodic-scans",
      ],
      fixtureDir,
    );

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain(
      'must include structured scan metadata via --scan-walk-mode, --scan-scope, --scan-domain, and --scan-signal',
    );
  }, 20_000);

  it("filters retrieve results by scan scope/domain and reports scan metadata", async () => {
    const fixtureDir = await createWorkflowMemoryFixture([
      {
        id: "scan-target",
        date: "2026-02-23",
        month: "2026-02",
        workflow: "Periodic Scans",
        title: "target row",
        severity: "medium",
        status: "open",
        tags: ["best-practice-researcher"],
        scan: {
          walkMode: "weighted-random",
          scope: "meso",
          domain: "api-contracts-orpc-hono",
          signal: "4",
        },
        eventFile: "events/2026-02.jsonl",
      },
      {
        id: "scan-other",
        date: "2026-02-22",
        month: "2026-02",
        workflow: "Periodic Scans",
        title: "other row",
        severity: "medium",
        status: "open",
        tags: ["best-practice-researcher"],
        scan: {
          walkMode: "weighted-random",
          scope: "macro",
          domain: "docs-and-guardrail-drift",
          signal: "3",
        },
        eventFile: "events/2026-02.jsonl",
      },
    ]);

    const result = runWorkflowMemoryScript(
      retrieveScriptPath,
      [
        "--workflow",
        "Periodic Scans",
        "--scan-scope",
        "meso",
        "--scan-domain",
        "api-contracts-orpc-hono",
        "--limit",
        "10",
        "--min-score",
        "0",
      ],
      fixtureDir,
    );

    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout) as {
      query: { scanScope: string | null; scanDomain: string | null };
      results: Array<{ id: string; scan?: Record<string, unknown> }>;
    };

    expect(parsed.query.scanScope).toBe("meso");
    expect(parsed.query.scanDomain).toBe("api-contracts-orpc-hono");
    expect(parsed.results.map((row) => row.id)).toEqual(["scan-target"]);
    expect(parsed.results[0]?.scan).toEqual({
      walkMode: "weighted-random",
      scope: "meso",
      domain: "api-contracts-orpc-hono",
      signal: "4",
    });
  }, 20_000);
});
