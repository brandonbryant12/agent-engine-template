import { writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readWorkflowRegistry } from "./registry";
import { runScript } from "../lib/effect-script";

async function main() {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const workflowsDir = resolve(scriptDir, "../../workflows");
  const readmePath = resolve(workflowsDir, "README.md");
  const repoRoot = resolve(workflowsDir, "../..");

  const registry = await readWorkflowRegistry();

  const core = registry.coreWorkflows ?? [];
  const utility = registry.utilitySkills ?? [];

  const coreNameById = new Map(core.map((entry) => [entry.id, entry.name]));

  const laneLink = (lane) => `[\`${lane}\`](../automations/${lane}/${lane}.md)`;
  const skillLink = (skill) => `[\`${skill}\`](../../.agents/skills/${skill}/SKILL.md)`;
  const workflowDocLink = (entry) => {
    const absolutePath = resolve(repoRoot, entry.docsPath);
    const relativePath = relative(workflowsDir, absolutePath).split("\\").join("/");
    const href = relativePath.startsWith(".") ? relativePath : `./${relativePath}`;
    return `[\`${entry.id}\`](${href})`;
  };

  const renderLanes = (lanes) => {
    if (!lanes || lanes.length === 0) {
      return "No dedicated lane";
    }
    return lanes.map(laneLink).join(", ");
  };

  const renderSkills = (skills) => skills.map(skillLink).join(", ");

  const renderUsedWith = (workflowIds) => {
    if (!workflowIds || workflowIds.length === 0) {
      return "-";
    }

    return workflowIds
      .map((id) => {
        const name = coreNameById.get(id);
        if (!name) {
          throw new Error(`Unknown workflow id in utilitySkills.usedWithWorkflows: ${id}`);
        }
        return `\`${name}\``;
      })
      .join(", ");
  };

  const lines = [];

  lines.push("<!-- GENERATED FILE. DO NOT EDIT DIRECTLY. -->");
  lines.push("<!-- Run `pnpm workflows:generate` to regenerate from registry.json. -->");
  lines.push("");
  lines.push("# Workflow Catalog");
  lines.push("");
  lines.push("Canonical workflow catalog for Agent Engine Template.");
  lines.push("");
  lines.push("Source of truth: [`agent-engine/workflows/registry.json`](./registry.json)");
  lines.push("");
  lines.push("## Concepts");
  lines.push("");
  lines.push("- `Workflow`: A process contract that defines scope, expected outcome, and workflow-memory key.");
  lines.push("- `Skill`: A reusable execution method that implements one part of a workflow (or a helper task).");
  lines.push(
    "- `Automation`: A runtime lane (scheduled or event-driven) that can trigger one or more workflows and skills with lane-specific policies.",
  );
  lines.push("");
  lines.push("Not every workflow has an automation lane, and not every automation lane maps 1:1 to one workflow.");
  lines.push("");
  lines.push("## Core Workflows");
  lines.push("");
  lines.push("Core workflows are the only entries with first-class workflow memory keys.");
  lines.push("");
  lines.push("| Workflow | Directory | Memory Key | Primary Skills | Automation Triggers | Intent |");
  lines.push("|---|---|---|---|---|---|");

  for (const entry of core) {
    lines.push(
      `| ${entry.name} | ${workflowDocLink(entry)} | \`${entry.memoryKey}\` | ${renderSkills(entry.primarySkills)} | ${renderLanes(entry.automationLanes)} | ${entry.summary} |`,
    );
  }

  lines.push("");
  lines.push("## Utility Skills (Not Workflows)");
  lines.push("");
  lines.push("These are reusable helper/orchestrator skills. They do not define standalone workflow classes.");
  lines.push("");
  lines.push("| Utility Skill | Memory Key | Source Skill | Used With Workflows | Automation Triggers | Purpose |");
  lines.push("|---|---|---|---|---|---|");

  for (const entry of utility) {
    lines.push(
      `| ${entry.name} | \`${entry.memoryKey}\` | ${renderSkills(entry.skills)} | ${renderUsedWith(entry.usedWithWorkflows)} | ${renderLanes(entry.automationLanes)} | ${entry.summary} |`,
    );
  }

  lines.push("");
  lines.push("## Usage");
  lines.push("");
  lines.push("1. Pick the smallest core workflow set that satisfies the change.");
  lines.push("2. Add utility skills only when they reduce risk or improve execution clarity.");
  lines.push("3. Persist workflow-memory notes using the core workflow key(s) that were actually executed.");

  await writeFile(readmePath, `${lines.join("\n")}\n`, "utf8");
  console.log(`Generated ${readmePath}`);
}

runScript(main);
