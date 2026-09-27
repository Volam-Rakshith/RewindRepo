import type { CompareFile, DependencyChange } from '../types';

const DEP_FILE_PATTERNS = [
  /(^|\/)package\.json$/,
  /(^|\/)requirements(-[\w.-]+)?\.txt$/,
  /(^|\/)pyproject\.toml$/,
  /(^|\/)go\.mod$/,
  /(^|\/)Cargo\.toml$/,
  /(^|\/)Gemfile$/,
  /(^|\/)pom\.xml$/,
  /(^|\/)build\.gradle(\.kts)?$/
];

export function isDependencyFile(path: string): boolean {
  return DEP_FILE_PATTERNS.some((pattern) => pattern.test(path));
}

export function dependencyFilesFromCompare(files: CompareFile[]): string[] {
  const paths = new Set<string>();
  for (const file of files) {
    if (isDependencyFile(file.filename)) paths.add(file.filename);
    if (file.previousFilename && isDependencyFile(file.previousFilename)) paths.add(file.previousFilename);
  }
  return [...paths];
}

export function diffDependencies(file: string, beforeText: string | null, afterText: string | null): DependencyChange[] {
  const before = parseDependencies(file, beforeText ?? '');
  const after = parseDependencies(file, afterText ?? '');
  const ecosystem = ecosystemFor(file);
  const names = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changes: DependencyChange[] = [];

  for (const packageName of [...names].sort((a, b) => a.localeCompare(b))) {
    const previous = before[packageName];
    const next = after[packageName];
    if (previous === next) continue;
    changes.push({
      file,
      ecosystem,
      packageName,
      before: previous,
      after: next,
      type: previous === undefined ? 'added' : next === undefined ? 'removed' : 'changed'
    });
  }
  return changes;
}

export function parseDependencies(file: string, text: string): Record<string, string> {
  if (!text.trim()) return {};
  if (/(^|\/)package\.json$/.test(file)) return parsePackageJson(text);
  if (/(^|\/)requirements(-[\w.-]+)?\.txt$/.test(file)) return parseRequirements(text);
  if (/(^|\/)go\.mod$/.test(file)) return parseGoMod(text);
  if (/(^|\/)Cargo\.toml$/.test(file)) return parseCargoToml(text);
  if (/(^|\/)pyproject\.toml$/.test(file)) return parsePyprojectToml(text);
  if (/(^|\/)Gemfile$/.test(file)) return parseGemfile(text);
  if (/(^|\/)pom\.xml$/.test(file)) return parsePom(text);
  if (/(^|\/)build\.gradle(\.kts)?$/.test(file)) return parseGradle(text);
  return {};
}

function parsePackageJson(text: string): Record<string, string> {
  try {
    const json = JSON.parse(text) as Record<string, Record<string, string> | undefined>;
    return {
      ...normalizeRecord(json.dependencies),
      ...prefixRecord(normalizeRecord(json.devDependencies), 'dev:'),
      ...prefixRecord(normalizeRecord(json.peerDependencies), 'peer:'),
      ...prefixRecord(normalizeRecord(json.optionalDependencies), 'optional:')
    };
  } catch {
    return {};
  }
}

function parseRequirements(text: string): Record<string, string> {
  const deps: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const cleaned = line.replace(/#.*/, '').trim();
    if (!cleaned || cleaned.startsWith('-')) continue;
    const match = cleaned.match(/^([A-Za-z0-9_.-]+)\s*(.*)$/);
    if (match) deps[match[1].toLowerCase()] = match[2].trim() || '*';
  }
  return deps;
}

function parseGoMod(text: string): Record<string, string> {
  const deps: Record<string, string> = {};
  const requireBlock = text.match(/require\s*\(([^]*?)\)/m)?.[1];
  const lines = [...text.split('\n'), ...(requireBlock ? requireBlock.split('\n') : [])];
  for (const line of lines) {
    const cleaned = line.replace(/\/\/.*$/, '').trim();
    const match = cleaned.match(/^(?:require\s+)?([^\s]+)\s+(v[^\s]+)$/);
    if (match && !match[1].includes('(')) deps[match[1]] = match[2];
  }
  return deps;
}

function parseCargoToml(text: string): Record<string, string> {
  const deps: Record<string, string> = {};
  let inDeps = false;
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (/^\[.*\]$/.test(trimmed)) {
      inDeps = /^\[(dev-|build-)?dependencies/.test(trimmed);
      continue;
    }
    if (!inDeps || !trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z0-9_-]+)\s*=\s*(.+)$/);
    if (match) deps[match[1]] = match[2].trim();
  }
  return deps;
}

function parsePyprojectToml(text: string): Record<string, string> {
  const deps: Record<string, string> = {};
  const poetry = text.match(/\[tool\.poetry\.dependencies\]([^]*?)(?=\n\[|$)/)?.[1];
  if (poetry) Object.assign(deps, parseCargoToml(`[dependencies]\n${poetry}`));
  const arrays = text.match(/dependencies\s*=\s*\[([^]*?)\]/m)?.[1];
  if (arrays) {
    for (const quoted of arrays.matchAll(/["']([^"']+)["']/g)) {
      const dep = quoted[1];
      const match = dep.match(/^([A-Za-z0-9_.-]+)\s*(.*)$/);
      if (match) deps[match[1].toLowerCase()] = match[2].trim() || '*';
    }
  }
  return deps;
}

function parseGemfile(text: string): Record<string, string> {
  const deps: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const match = line.trim().match(/^gem\s+['"]([^'"]+)['"]\s*(?:,\s*['"]([^'"]+)['"])?/);
    if (match) deps[match[1]] = match[2] ?? '*';
  }
  return deps;
}

function parsePom(text: string): Record<string, string> {
  const deps: Record<string, string> = {};
  for (const block of text.matchAll(/<dependency>([^]*?)<\/dependency>/g)) {
    const group = block[1].match(/<groupId>(.*?)<\/groupId>/)?.[1];
    const artifact = block[1].match(/<artifactId>(.*?)<\/artifactId>/)?.[1];
    const version = block[1].match(/<version>(.*?)<\/version>/)?.[1] ?? '*';
    if (group && artifact) deps[`${group}:${artifact}`] = version;
  }
  return deps;
}

function parseGradle(text: string): Record<string, string> {
  const deps: Record<string, string> = {};
  for (const match of text.matchAll(/(?:implementation|api|compileOnly|runtimeOnly|testImplementation)\s+['"]([^:'"]+):([^:'"]+):([^'"]+)['"]/g)) {
    deps[`${match[1]}:${match[2]}`] = match[3];
  }
  return deps;
}

function normalizeRecord(record: Record<string, string> | undefined): Record<string, string> {
  if (!record || typeof record !== 'object') return {};
  return Object.fromEntries(Object.entries(record).filter(([, value]) => typeof value === 'string'));
}

function prefixRecord(record: Record<string, string>, prefix: string): Record<string, string> {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [`${prefix}${key}`, value]));
}

function ecosystemFor(file: string): string {
  if (/(^|\/)package\.json$/.test(file)) return 'npm';
  if (/requirements|pyproject/.test(file)) return 'python';
  if (/go\.mod$/.test(file)) return 'go';
  if (/Cargo\.toml$/.test(file)) return 'rust';
  if (/Gemfile$/.test(file)) return 'ruby';
  if (/pom\.xml$|gradle/.test(file)) return 'jvm';
  return 'unknown';
}
