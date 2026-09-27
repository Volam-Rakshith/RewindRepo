const TEXT_EXTENSIONS = new Set([
  'txt',
  'md',
  'mdx',
  'js',
  'jsx',
  'ts',
  'tsx',
  'json',
  'css',
  'scss',
  'sass',
  'less',
  'html',
  'htm',
  'xml',
  'svg',
  'yml',
  'yaml',
  'toml',
  'ini',
  'env',
  'sh',
  'bash',
  'zsh',
  'fish',
  'py',
  'rb',
  'go',
  'rs',
  'java',
  'kt',
  'kts',
  'c',
  'h',
  'cpp',
  'hpp',
  'cs',
  'php',
  'swift',
  'sql',
  'graphql',
  'gql',
  'vue',
  'svelte',
  'astro',
  'dockerfile',
  'gitignore',
  'gitattributes',
  'editorconfig',
  'npmrc',
  'lock',
  'gradle',
  'properties',
  'csv'
]);

const BINARY_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'ico',
  'pdf',
  'zip',
  'gz',
  'tar',
  '7z',
  'rar',
  'mp4',
  'mov',
  'mp3',
  'wav',
  'woff',
  'woff2',
  'ttf',
  'eot',
  'wasm',
  'exe',
  'dll',
  'so',
  'dylib'
]);

export const MAX_TEXT_FILE_BYTES = 1_000_000;

export function extensionFor(path: string): string {
  const name = path.split('/').pop() ?? path;
  if (name.toLowerCase() === 'dockerfile') return 'dockerfile';
  const parts = name.split('.');
  if (parts.length <= 1) return name.startsWith('.') ? name.slice(1).toLowerCase() : '';
  return parts.pop()?.toLowerCase() ?? '';
}

export function isProbablyTextPath(path: string): boolean {
  const ext = extensionFor(path);
  if (BINARY_EXTENSIONS.has(ext)) return false;
  if (TEXT_EXTENSIONS.has(ext)) return true;
  const basename = path.split('/').pop()?.toLowerCase() ?? '';
  return [
    'readme',
    'license',
    'copying',
    'notice',
    'makefile',
    'gemfile',
    'rakefile',
    'procfile',
    'dockerfile'
  ].includes(basename);
}

export function isBinaryString(text: string): boolean {
  if (text.includes('\u0000')) return true;
  const sample = text.slice(0, 512);
  let suspicious = 0;
  for (const char of sample) {
    const code = char.charCodeAt(0);
    if (code < 7 || (code > 13 && code < 32)) suspicious += 1;
  }
  return sample.length > 0 && suspicious / sample.length > 0.08;
}

export function decodeBase64Utf8(content: string): string {
  const normalized = content.replace(/\n/g, '');
  const binary = atob(normalized);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}

export function formatBytes(bytes?: number): string {
  if (bytes === undefined) return 'unknown size';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function languageForPath(path: string): string {
  const ext = extensionFor(path);
  const map: Record<string, string> = {
    ts: 'TypeScript',
    tsx: 'TSX',
    js: 'JavaScript',
    jsx: 'JSX',
    json: 'JSON',
    css: 'CSS',
    scss: 'SCSS',
    html: 'HTML',
    htm: 'HTML',
    md: 'Markdown',
    mdx: 'MDX',
    py: 'Python',
    rb: 'Ruby',
    go: 'Go',
    rs: 'Rust',
    java: 'Java',
    kt: 'Kotlin',
    c: 'C',
    cpp: 'C++',
    cs: 'C#',
    php: 'PHP',
    swift: 'Swift',
    yml: 'YAML',
    yaml: 'YAML',
    toml: 'TOML',
    xml: 'XML',
    svg: 'SVG',
    sh: 'Shell',
    sql: 'SQL'
  };
  return map[ext] ?? 'Text';
}
