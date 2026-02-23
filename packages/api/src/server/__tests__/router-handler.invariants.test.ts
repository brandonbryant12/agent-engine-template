import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '..', '..', '..', '..', '..');
const routerDir = path.join(repoRoot, 'packages/api/src/server/router');

type HelperRequirement =
  | 'handleEffectWithProtocol'
  | 'handleEffectStreamWithProtocol'
  | null;

interface RouterRule {
  readonly helper: HelperRequirement;
  readonly minSpanCount: number | null;
  readonly spanPrefix: string | null;
  readonly rationale?: string;
}

const ROUTER_RULES: Record<string, RouterRule> = {
  'chat.ts': {
    helper: 'handleEffectStreamWithProtocol',
    minSpanCount: 1,
    spanPrefix: 'api.chat.',
  },
  'events.ts': {
    helper: null,
    minSpanCount: null,
    spanPrefix: null,
    rationale:
      'SSE subscribe is async-generator based, so protocol helper/span requirements are explicitly exempted.',
  },
  'runs.ts': {
    helper: 'handleEffectWithProtocol',
    minSpanCount: 2,
    spanPrefix: 'api.runs.',
  },
};

const DB_SCHEMA_IMPORT_ALLOWLIST = new Set<string>([]);

const readRouterSource = (filename: string) =>
  fs.readFileSync(path.join(routerDir, filename), 'utf-8');

const listRouterHandlerFiles = () =>
  fs
    .readdirSync(routerDir)
    .filter((file) => file.endsWith('.ts'))
    .filter((file) => file !== 'index.ts')
    .sort();

describe('router handler invariants', () => {
  it('covers every handler router with explicit invariant rules', () => {
    const routerFiles = listRouterHandlerFiles();
    const ruleFiles = Object.keys(ROUTER_RULES).sort();

    expect(ruleFiles).toEqual(routerFiles);
  });

  it('forbids direct runtime.runPromise usage in routers', () => {
    const forbidden = /context\.runtime\.runPromise/;

    for (const file of listRouterHandlerFiles()) {
      const source = readRouterSource(file);

      if (forbidden.test(source)) {
        throw new Error(`Router ${file} must not call context.runtime.runPromise`);
      }
    }
  });

  it('forbids @repo/db/schema imports in routers unless allowlisted', () => {
    const forbiddenImport = /from ['"]@repo\/db\/schema['"]/;

    for (const file of listRouterHandlerFiles()) {
      if (DB_SCHEMA_IMPORT_ALLOWLIST.has(file)) {
        continue;
      }

      const source = readRouterSource(file);
      if (forbiddenImport.test(source)) {
        throw new Error(`Router ${file} must not import @repo/db/schema directly`);
      }
    }
  });

  it('requires standardized helper pipelines for Effect-backed handlers', () => {
    for (const file of listRouterHandlerFiles()) {
      const source = readRouterSource(file);
      const rule = ROUTER_RULES[file];

      if (!rule) {
        throw new Error(`Missing invariant rule for router ${file}`);
      }

      if (rule.helper === null) {
        if (!rule.rationale) {
          throw new Error(`Router ${file} is exempt but missing rationale`);
        }
        expect(source).toContain('async function*');
        continue;
      }

      expect(source).toContain(rule.helper);
    }
  });

  it('requires API spans or explicit exemptions with rationale', () => {
    for (const file of listRouterHandlerFiles()) {
      const source = readRouterSource(file);
      const rule = ROUTER_RULES[file];

      if (!rule) {
        throw new Error(`Missing invariant rule for router ${file}`);
      }

      if (rule.minSpanCount === null || rule.spanPrefix === null) {
        if (!rule.rationale) {
          throw new Error(`Router ${file} span exemption missing rationale`);
        }
        expect(source).toContain('protectedProcedure.events.subscribe.handler');
        continue;
      }

      const escapedPrefix = rule.spanPrefix.replaceAll('.', '\\.');
      const spanPattern = new RegExp(`span:\\s*'${escapedPrefix}[^']+'`, 'g');
      const matches = source.match(spanPattern) ?? [];

      expect(matches.length).toBeGreaterThanOrEqual(rule.minSpanCount);
    }
  });
});
