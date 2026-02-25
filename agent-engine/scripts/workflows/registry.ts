import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const workflowsDir = resolve(scriptDir, "../../workflows");
const registryPath = resolve(workflowsDir, "registry.json");
const schemaPath = resolve(workflowsDir, "registry.schema.json");
const repoRoot = resolve(workflowsDir, "../..");
const AUTOMATION_LANE_FILE_EXTENSIONS = ["md", "toml"];

async function pathExists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

function formatAjvErrors(errors) {
  if (!errors || errors.length === 0) return "";
  return errors
    .map((error) => {
      const instancePath = error.instancePath || "/";
      const message = error.message ?? "invalid";
      return `${instancePath} ${message}`.trim();
    })
    .join("\n- ");
}

export async function readWorkflowRegistry() {
  const [rawRegistry, rawSchema] = await Promise.all([
    readFile(registryPath, "utf8"),
    readFile(schemaPath, "utf8"),
  ]);

  const registry = JSON.parse(rawRegistry);
  const schema = JSON.parse(rawSchema);

  const ajv = new Ajv({ allErrors: true });
  const validate = ajv.compile(schema);

  if (!validate(registry)) {
    const details = formatAjvErrors(validate.errors);
    throw new Error(
      `Workflow registry failed schema validation (${registryPath}).\n- ${details}`,
    );
  }

  const core = registry.coreWorkflows ?? [];
  const utility = registry.utilitySkills ?? [];

  const issues = [];
  const ids = new Set();
  const memoryKeys = new Set();

  for (const entry of [...core, ...utility]) {
    if (!entry?.id) continue;
    if (ids.has(entry.id)) {
      issues.push(`Duplicate registry id: ${entry.id}`);
    }
    ids.add(entry.id);
  }

  for (const entry of core) {
    const memoryKey = typeof entry?.memoryKey === "string" ? entry.memoryKey.trim() : "";
    if (!memoryKey) {
      issues.push(`Core workflow "${entry?.id}" missing memoryKey.`);
      continue;
    }
    if (memoryKeys.has(memoryKey)) {
      issues.push(`Duplicate core workflow memoryKey: ${memoryKey}`);
      continue;
    }
    memoryKeys.add(memoryKey);
  }

  const coreIds = new Set(core.map((entry) => entry.id));

  for (const entry of utility) {
    for (const workflowId of entry.usedWithWorkflows ?? []) {
      if (!coreIds.has(workflowId)) {
        issues.push(
          `Utility skill "${entry.id}" references unknown core workflow id in usedWithWorkflows: ${workflowId}`,
        );
      }
    }
  }

  const validationTasks = [];

  for (const entry of [...core, ...utility]) {
    const docsPath = resolve(repoRoot, entry.docsPath);
    validationTasks.push(
      pathExists(docsPath).then((exists) => {
        if (!exists) {
          issues.push(`Missing workflow docsPath for "${entry.id}": ${entry.docsPath}`);
        }
      }),
    );

    const skillIds = entry.primarySkills ?? entry.skills ?? [];
    for (const skillId of skillIds) {
      const skillPath = resolve(repoRoot, ".agents", "skills", skillId, "SKILL.md");
      validationTasks.push(
        pathExists(skillPath).then((exists) => {
          if (!exists) {
            issues.push(`Missing skill file for "${entry.id}": .agents/skills/${skillId}/SKILL.md`);
          }
        }),
      );
    }

    for (const lane of entry.automationLanes ?? []) {
      for (const extension of AUTOMATION_LANE_FILE_EXTENSIONS) {
        const lanePath = resolve(
          repoRoot,
          "agent-engine",
          "automations",
          lane,
          `${lane}.${extension}`,
        );
        validationTasks.push(
          pathExists(lanePath).then((exists) => {
            if (!exists) {
              issues.push(
                `Missing automation lane file for "${entry.id}": agent-engine/automations/${lane}/${lane}.${extension}`,
              );
            }
          }),
        );
      }
    }
  }

  await Promise.all(validationTasks);

  if (issues.length > 0) {
    throw new Error(`Workflow registry validation failed:\n- ${issues.join("\n- ")}`);
  }

  return registry;
}
