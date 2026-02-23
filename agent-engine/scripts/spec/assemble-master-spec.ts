import path from 'node:path';
import {
  generatedRoot,
  readUtf8,
  replaceGeneratedSection,
  repoRoot,
  writeUtf8,
} from './utils';

const SECTION_FILE_MAP: Record<string, string> = {
  'snapshot-metadata': 'snapshot-metadata.md',
  'api-surface': 'api-surface.md',
  'domain-surface': 'domain-surface.md',
  'data-model': 'data-model.md',
  'ui-surface': 'ui-surface.md',
};

export const assembleMasterSpec = async (): Promise<void> => {
  const masterSpecPath = path.join(repoRoot, 'docs/master-spec.md');
  let masterSpec = await readUtf8(masterSpecPath);

  for (const [section, fileName] of Object.entries(SECTION_FILE_MAP)) {
    const sectionContent = await readUtf8(path.join(generatedRoot, fileName));
    masterSpec = replaceGeneratedSection(masterSpec, section, sectionContent);
  }

  await writeUtf8(masterSpecPath, masterSpec);
};
