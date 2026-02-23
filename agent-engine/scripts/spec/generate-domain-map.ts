import { promises as fs } from 'node:fs';
import path from 'node:path';
import { generatedRoot, repoRoot, writeUtf8 } from './utils';

type DomainSurface = {
  readonly domain: string;
  readonly useCases: readonly string[];
  readonly endpointCount: number | null;
};

const pluralizeDomain = (domain: string): string => {
  if (domain.endsWith('y')) {
    return `${domain.slice(0, -1)}ies`;
  }
  if (domain.endsWith('s')) {
    return `${domain}es`;
  }
  return `${domain}s`;
};

const resolveContractFileForDomain = async (
  domain: string,
): Promise<string | null> => {
  const contractDir = path.join(repoRoot, 'packages/api/src/contracts');
  const candidateFiles = [domain, pluralizeDomain(domain)];

  for (const candidate of candidateFiles) {
    const contractFile = path.join(contractDir, `${candidate}.ts`);
    try {
      await fs.access(contractFile);
      return contractFile;
    } catch {
      // try next candidate
    }
  }

  return null;
};

const csvCell = (value: string): string => value.replaceAll('|', '\\|');

const extractUseCases = (source: string): string[] => {
  const useCases = new Set<string>();
  const pattern = /from\s+['"]\.\/([^'"]+)['"]/g;

  let match = pattern.exec(source);
  while (match) {
    if (match[1] && !match[1].includes('__tests__')) {
      useCases.add(match[1]);
    }
    match = pattern.exec(source);
  }

  return [...useCases].sort((a, b) => a.localeCompare(b));
};

const countContractRoutes = (source: string): number => {
  return (source.match(/\.route\(/g) ?? []).length;
};

const listDomainUseCaseIndexes = async (): Promise<
  readonly { domain: string; filePath: string }[]
> => {
  const packagesDir = path.join(repoRoot, 'packages');
  const packageEntries = await fs
    .readdir(packagesDir, { withFileTypes: true })
    .catch(() => []);
  const result: { domain: string; filePath: string }[] = [];

  for (const packageEntry of packageEntries) {
    if (!packageEntry.isDirectory()) continue;

    const srcDir = path.join(packagesDir, packageEntry.name, 'src');
    const domainEntries = await fs
      .readdir(srcDir, { withFileTypes: true })
      .catch(() => []);

    for (const domainEntry of domainEntries) {
      if (!domainEntry.isDirectory()) continue;
      const indexPath = path.join(
        srcDir,
        domainEntry.name,
        'use-cases/index.ts',
      );

      try {
        await fs.access(indexPath);
        result.push({ domain: domainEntry.name, filePath: indexPath });
      } catch {
        // skip non-domain directories
      }
    }
  }

  return result.sort((a, b) => a.domain.localeCompare(b.domain));
};

const loadDomainSurface = async (): Promise<readonly DomainSurface[]> => {
  const indexes = await listDomainUseCaseIndexes();
  const surfaces: DomainSurface[] = [];

  for (const index of indexes) {
    const source = await fs.readFile(index.filePath, 'utf8');
    const useCases = extractUseCases(source);

    let endpointCount: number | null = null;
    const contractFile = await resolveContractFileForDomain(index.domain);
    if (contractFile) {
      const contractSource = await fs.readFile(contractFile, 'utf8');
      endpointCount = countContractRoutes(contractSource);
    }

    surfaces.push({
      domain: index.domain,
      useCases,
      endpointCount,
    });
  }

  return surfaces;
};

const formatDomainMapMarkdown = (domains: readonly DomainSurface[]): string => {
  const lines: string[] = [];
  const totalUseCases = domains.reduce((sum, domain) => sum + domain.useCases.length, 0);

  lines.push('# Domain Capability Surface (Generated)');
  lines.push('');
  lines.push(`- Domains: ${domains.length}`);
  lines.push(`- Exported use cases: ${totalUseCases}`);
  lines.push('');
  lines.push('| Domain | Use Cases | API Endpoints |');
  lines.push('|---|---|---|');

  for (const domain of domains) {
    lines.push(
      `| ${csvCell(domain.domain)} | ${domain.useCases.length} | ${domain.endpointCount ?? 'n/a'} |`,
    );
  }

  lines.push('');
  lines.push('## Use Cases by Domain');
  lines.push('');

  for (const domain of domains) {
    lines.push(`### ${domain.domain}`);
    lines.push('');
    if (domain.useCases.length === 0) {
      lines.push('- none');
    } else {
      for (const useCase of domain.useCases) {
        lines.push(`- \`${useCase}\``);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
};

export type DomainMapStats = {
  readonly domainCount: number;
  readonly useCaseCount: number;
};

export const generateDomainMapArtifact = async (): Promise<DomainMapStats> => {
  const domains = await loadDomainSurface();
  const useCaseCount = domains.reduce(
    (sum, domain) => sum + domain.useCases.length,
    0,
  );

  await writeUtf8(
    path.join(generatedRoot, 'domain-surface.md'),
    formatDomainMapMarkdown(domains),
  );

  return {
    domainCount: domains.length,
    useCaseCount,
  };
};
