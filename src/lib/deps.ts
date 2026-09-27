import type { CompareFile, DependencyChange } from '../types';

const DEP_FILE_PATTERNS = [
  /(^|\/)package\.json$/,
  /(^|\/)(package-lock|npm-shrinkwrap)\.json$/,
  /(^|\/)pnpm-lock\.yaml$/,
  /(^|\/)yarn\.lock$/,
  /(^|\/)bun\.lock$/,
  /(^|\/)deno\.lock$/,
  /(^|\/)requirements(-[\w.-]+)?\.txt$/,
  /(^|\/)pyproject\.toml$/,
  /(^|\/)Pipfile(\.lock)?$/,
  /(^|\/)go\.mod$/,
  /(^|\/)Cargo\.toml$/,
  /(^|\/)Gemfile(\.lock)?$/,
  /(^|\/)composer\.(json|lock)$/,
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
  return [...paths].sort((a, b) => a.localeCompare(b));
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
  if (/(^|\/)(package-lock|npm-shrinkwrap)\.json$/.test(file)) return parsePackageLock(text);
  if (/(^|\/)pnpm-lock\.yaml$/.test(file)) return parsePnpmLock(text);
  if (/(^|\/)yarn\.lock$/.test(file)) return parseYarnLock(text);
  if (/(^|\/)bun\.lock$/.test(file)) return parseBunLock(text);
  if (/(^|\/)deno\.lock$/.test(file)) return parseDenoLock(text);
  if (/(^|\/)requirements(-[\w.-]+)?\.txt$/.test(file)) return parseRequirements(text);
  if (/(^|\/)pyproject\.toml$/.test(file)) return parsePyprojectToml(text);
  if (/(^|\/)Pipfile$/.test(file)) return parsePipfile(text);
  if (/(^|\/)Pipfile\.lock$/.test(file)) return parsePipfileLock(text);
  if (/(^|\/)go\.mod$/.test(file)) return parseGoMod(text);
  if (/(^|\/)Cargo\.toml$/.test(file)) return parseCargoToml(text);
  if (/(^|\/)Gemfile$/.test(file)) return parseGemfile(text);
  if (/(^|\/)Gemfile\.lock$/.test(file)) return parseGemfileLock(text);
  if (/(^|\/)composer\.json$/.test(file)) return parseComposerJson(text);
  if (/(^|\/)composer\.lock$/.test(file)) return parseComposerLock(text);
  if (/(^|\/)pom\.xml$/.test(file)) return parsePom(text);
  if (/(^|\/)build\.gradle(\.kts)?$/.test(file)) return parseGradle(text);
  return {};
}

function parsePackageJson(text: string): Record<string, string> {
  try {
    const json = JSON.parse(text) as Record<string, unknown>;
    return {
      ...normalizeRecord(json.dependencies),
      ...prefixRecord(normalizeRecord(json.devDependencies), 'dev:'),
      ...prefixRecord(normalizeRecord(json.peerDependencies), 'peer:'),
      ...prefixRecord(normalizeRecord(json.optionalDependencies), 'optional:'),
      ...prefixRecord(normalizeRecord(json.overrides), 'override:'),
      ...prefixRecord(normalizeRecord(json.resolutions), 'resolution:')
    };
  } catch {
    return {};
  }
}

function parsePackageLock(text: string): Record<string, string> {
  try {
    const json = JSON.parse(text) as {
      packages?: Record<string, { version?: string }>;
      dependencies?: Record<string, { version?: string }>;
    };
    const deps: Record<string, string> = {};

    if (json.packages) {
      for (const [path, meta] of Object.entries(json.packages)) {
        if (!path || !meta?.version) continue;
        const name = packageNameFromNodeModulesPath(path);
        if (name) deps[name] = meta.version;
      }
    }

    if (json.dependencies) {
      collectNpmLockDependencies(json.dependencies, deps);
    }

    return deps;
  } catch {
    return {};
  }
}

function collectNpmLockDependencies(
  dependencies: Record<string, unknown>,
  deps: Record<string, string>,
  prefix = ''
): void {
  for (const [name, rawMeta] of Object.entries(dependencies)) {
    if (!rawMeta || typeof rawMeta !== 'object') continue;
    const meta = rawMeta as { version?: unknown; dependencies?: Record<string, unknown> };
    const packageName = prefix ? `${prefix}>${name}` : name;
    if (typeof meta.version === 'string') deps[packageName] = meta.version;
    if (meta.dependencies) collectNpmLockDependencies(meta.dependencies, deps, packageName);
  }
}

function packageNameFromNodeModulesPath(path: string): string | null {
  const parts = path.split('/');
  const index = parts.lastIndexOf('node_modules');
  if (index === -1) return null;
  const first = parts[index + 1];
  if (!first) return null;
  if (first.startsWith('@')) {
    const second = parts[index + 2];
    return second ? `${first}/${second}` : null;
  }
  return first;
}

function parsePnpmLock(text: string): Record<string, string> {
  const deps: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim().replace(/^['"]|['"]$/g, '').replace(/:$/, '');
    if (!trimmed || trimmed.startsWith('#') || trimmed.includes(' ') || !trimmed.includes('@')) continue;
    const parsed = parseLockKey(trimmed.replace(/^\//, ''));
    if (parsed) deps[parsed.name] = parsed.version;
  }
  return deps;
}

function parseYarnLock(text: string): Record<string, string> {
  const deps: Record<string, string> = {};
  let pendingNames: string[] = [];

  for (const line of text.split('\n')) {
    if (line && !line.startsWith(' ') && line.trim().endsWith(':')) {
      pendingNames = line
        .trim()
        .replace(/:$/, '')
        .split(',')
        .map((entry) => parseLockKey(entry.trim().replace(/^['"]|['"]$/g, ''))?.name)
        .filter(Boolean) as string[];
      continue;
    }

    const version = line.trim().match(/^version\s+['"]?([^'"]+)['"]?$/)?.[1];
    if (version && pendingNames.length) {
      for (const name of pendingNames) deps[name] = version;
      pendingNames = [];
    }
  }

  return deps;
}

function parseLockKey(raw: string): { name: string; version: string } | null {
  const cleaned = raw.replace(/^npm:/, '').replace(/\(.+\)$/, '');
  const atIndex = cleaned.startsWith('@') ? cleaned.indexOf('@', 1) : cleaned.indexOf('@');
  if (atIndex <= 0) return null;
  const name = cleaned.slice(0, atIndex);
  const spec = cleaned.slice(atIndex + 1).replace(/^npm:/, '');
  const version = spec.match(/\d+\.\d+\.\d+[^/)]*/)?.[0] ?? spec;
  if (!name || !version || version.startsWith('^') || version.startsWith('~')) return null;
  return { name, version };
}

function parseBunLock(text: string): Record<string, string> {
  try {
    const json = JSON.parse(text) as Record<string, unknown>;
    const deps: Record<string, string> = {};
    const packages = json.packages as Record<string, unknown> | undefined;
    if (packages) {
      for (const [name, meta] of Object.entries(packages)) {
        if (Array.isArray(meta) && typeof meta[0] === 'string') deps[name] = meta[0];
        if (meta && typeof meta === 'object' && 'version' in meta) deps[name] = String((meta as { version: unknown }).version);
      }
    }
    return deps;
  } catch {
    return {};
  }
}

function parseDenoLock(text: string): Record<string, string> {
  try {
    const json = JSON.parse(text) as { npm?: Record<string, string> };
    const deps: Record<string, string> = {};
    for (const [key, value] of Object.entries(json.npm ?? {})) {
      const parsed = parseLockKey(key);
      if (parsed) deps[parsed.name] = parsed.version || value;
    }
    return deps;
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

function parsePipfile(text: string): Record<string, string> {
  const deps: Record<string, string> = {};
  let inDeps = false;
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (/^\[.*\]$/.test(trimmed)) {
      inDeps = /^\[(packages|dev-packages)\]$/.test(trimmed);
      continue;
    }
    if (!inDeps || !trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z0-9_.-]+)\s*=\s*(.+)$/);
    if (match) deps[match[1].toLowerCase()] = match[2].replace(/["']/g, '').trim();
  }
  return deps;
}

function parsePipfileLock(text: string): Record<string, string> {
  try {
    const json = JSON.parse(text) as Record<string, Record<string, { version?: string }> | undefined>;
    return {
      ...normalizePipfileLockRecord(json.default),
      ...prefixRecord(normalizePipfileLockRecord(json.develop), 'dev:')
    };
  } catch {
    return {};
  }
}

function normalizePipfileLockRecord(record: Record<string, { version?: string }> | undefined): Record<string, string> {
  if (!record) return {};
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, value.version ?? '*']));
}

function parseGemfile(text: string): Record<string, string> {
  const deps: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const match = line.trim().match(/^gem\s+['"]([^'"]+)['"]\s*(?:,\s*['"]([^'"]+)['"])?/);
    if (match) deps[match[1]] = match[2] ?? '*';
  }
  return deps;
}

function parseGemfileLock(text: string): Record<string, string> {
  const deps: Record<string, string> = {};
  let inSpecs = false;
  for (const line of text.split('\n')) {
    if (line.trim() === 'specs:') {
      inSpecs = true;
      continue;
    }
    if (inSpecs && /^[A-Z]/.test(line)) inSpecs = false;
    if (!inSpecs) continue;
    const match = line.trim().match(/^([A-Za-z0-9_.-]+) \(([^)]+)\)/);
    if (match) deps[match[1]] = match[2];
  }
  return deps;
}

function parseComposerJson(text: string): Record<string, string> {
  try {
    const json = JSON.parse(text) as Record<string, unknown>;
    return {
      ...normalizeRecord(json.require),
      ...prefixRecord(normalizeRecord(json['require-dev']), 'dev:')
    };
  } catch {
    return {};
  }
}

function parseComposerLock(text: string): Record<string, string> {
  try {
    const json = JSON.parse(text) as Record<string, Array<{ name?: string; version?: string }> | undefined>;
    const deps: Record<string, string> = {};
    for (const key of ['packages', 'packages-dev']) {
      for (const pkg of json[key] ?? []) {
        if (pkg.name && pkg.version) deps[key === 'packages-dev' ? `dev:${pkg.name}` : pkg.name] = pkg.version;
      }
    }
    return deps;
  } catch {
    return {};
  }
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

function normalizeRecord(record: unknown): Record<string, string> {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return {};
  return Object.fromEntries(
    Object.entries(record as Record<string, unknown>)
      .filter(([, value]) => typeof value === 'string')
      .map(([key, value]) => [key, String(value)])
  );
}

function prefixRecord(record: Record<string, string>, prefix: string): Record<string, string> {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [`${prefix}${key}`, value]));
}

function ecosystemFor(file: string): string {
  if (/(^|\/)(package|package-lock|npm-shrinkwrap)\.json$|pnpm-lock\.yaml$|yarn\.lock$|bun\.lock$/.test(file)) return 'npm';
  if (/requirements|pyproject|Pipfile/.test(file)) return 'python';
  if (/go\.mod$/.test(file)) return 'go';
  if (/Cargo\.toml$/.test(file)) return 'rust';
  if (/Gemfile/.test(file)) return 'ruby';
  if (/composer\.(json|lock)$/.test(file)) return 'php';
  if (/pom\.xml$|gradle/.test(file)) return 'jvm';
  if (/deno\.lock$/.test(file)) return 'deno';
  return 'unknown';
}
