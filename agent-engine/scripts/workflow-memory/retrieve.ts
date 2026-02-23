#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import { runScript } from "../lib/effect-script";

const MEMORY_DIR = path.join("agent-engine", "workflow-memory");
const INDEX_PATH = path.join(MEMORY_DIR, "index.json");

const USAGE = `Usage:
  pnpm workflow-memory:retrieve \\
    --workflow "Self-Improvement" \\
    --tags guardrail,docs \\
    --limit 5 \\
    --min-score 0.35 \\
    [--month YYYY-MM] \\
    [--has-scenario] \\
    [--scenario-skill <skill-name>]

Scoring (0-1):
  score = 0.4 * importance + 0.3 * recency + 0.2 * tagMatch + 0.1 * confidence

Recency defaults to a 90-day linear decay if the row lacks a recency field.

Scenario filters:
  --has-scenario       Only return events that have an attached scenario
  --scenario-skill     Only return events whose scenario targets this skill
`;

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    if (token === "--") continue;

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

async function readJsonArray(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function parseOptionalNumber(raw) {
  if (raw === undefined || raw === null || raw === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function computeRecency(dateString, now) {
  if (!dateString) return 0;
  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) return 0;
  const daysAgo = Math.max(0, (now.getTime() - parsed.getTime()) / 86_400_000);
  const horizonDays = 90;
  return clamp01(1 - Math.min(daysAgo, horizonDays) / horizonDays);
}

function computeTagMatch(rowTags, desiredTags) {
  if (!desiredTags.length) return 0;
  const rowSet = new Set(Array.isArray(rowTags) ? rowTags : []);
  let hits = 0;
  for (const tag of desiredTags) {
    if (rowSet.has(tag)) hits += 1;
  }
  return hits / desiredTags.length;
}

function parseLimit(raw) {
  if (!raw) return 5;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  throw new Error(`Invalid --limit value: ${raw}`);
}

function parseMinScore(raw) {
  if (!raw) return 0;
  const parsed = Number(raw);
  if (Number.isFinite(parsed)) return parsed;
  throw new Error(`Invalid --min-score value: ${raw}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help === "true" || args.h === "true") {
    console.log(USAGE);
    return;
  }

  const workflow = args.workflow ? args.workflow.trim() : "";
  const month = args.month ? args.month.trim() : "";
  const tags = args.tags
    ? args.tags
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
  const limit = parseLimit(args.limit);
  const minScore = parseMinScore(args.min_score);

  const index = await readJsonArray(INDEX_PATH);
  const now = new Date();

  const hasScenario = args.has_scenario === "true";
  const scenarioSkill = args.scenario_skill ? args.scenario_skill.trim() : "";

  const scored = index
    .filter((row) => {
      if (!row || typeof row !== "object") return false;
      if (workflow && row.workflow !== workflow) return false;
      if (month && row.month !== month) return false;
      if (hasScenario && !row.hasScenario) return false;
      if (scenarioSkill && row.scenarioSkill !== scenarioSkill) return false;
      return true;
    })
    .map((row) => {
      const importance = clamp01(parseOptionalNumber(row.importance) ?? 0);
      const confidence = clamp01(parseOptionalNumber(row.confidence) ?? 0);
      const recency = clamp01(
        parseOptionalNumber(row.recency) ?? computeRecency(row.date, now),
      );
      const tagMatch = clamp01(computeTagMatch(row.tags, tags));
      const score =
        0.4 * importance + 0.3 * recency + 0.2 * tagMatch + 0.1 * confidence;

      return {
        id: row.id,
        date: row.date,
        workflow: row.workflow,
        title: row.title,
        tags: row.tags ?? [],
        score: Number(score.toFixed(4)),
        breakdown: {
          importance,
          recency,
          tagMatch,
          confidence,
        },
        eventFile: row.eventFile,
      };
    })
    .filter((row) => row.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  const response = {
    query: {
      workflow: workflow || null,
      tags,
      month: month || null,
      minScore,
      limit,
    },
    results: scored,
  };

  console.log(JSON.stringify(response, null, 2));
}

runScript(main);
