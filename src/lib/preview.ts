import type { GitTreeItem, PreviewCapability } from '../types';

const STATIC_ENTRIES = ['index.html', 'public/index.html', 'docs/index.html', 'site/index.html'];
const SOURCE_MANIFESTS = [
  'package.json',
  'vite.config.js',
  'vite.config.ts',
  'next.config.js',
  'next.config.mjs',
  'astro.config.mjs',
  'svelte.config.js',
  'angular.json'
];

export function detectPreviewCapability(items: GitTreeItem[]): PreviewCapability {
  const paths = new Set(items.map((item) => item.path));
  const htmlEntry = STATIC_ENTRIES.find((path) => paths.has(path));
  if (htmlEntry) {
    return {
      supported: true,
      kind: 'static-html',
      title: 'Static HTML snapshot',
      reason: 'This historical state contains an HTML entry file that can be rendered with scripts disabled.',
      entryPath: htmlEntry,
      warnings: [
        'Repository JavaScript is not executed.',
        'Build steps are not run.',
        'Some relative assets may be omitted unless they are embedded in the HTML/CSS.'
      ]
    };
  }

  const readme = items.find((item) => /^readme(\.(md|markdown|txt))?$/i.test(item.path));
  if (readme) {
    return {
      supported: true,
      kind: 'markdown',
      title: 'README source preview',
      reason: 'No safe static site entry was found, but a README can be inspected for this historical state.',
      entryPath: readme.path,
      warnings: ['Markdown is shown as source text; repository code is not executed.']
    };
  }

  const hasBuildManifest = SOURCE_MANIFESTS.some((manifest) => paths.has(manifest));
  if (hasBuildManifest) {
    return {
      supported: false,
      kind: 'unsupported-build',
      title: 'Build sandbox required',
      reason:
        'This appears to be a frontend project, but reconstructing it requires installing dependencies and running historical build code in an isolated sandbox.',
      warnings: [
        'RepoTimeMachine does not execute arbitrary repository code in the application environment.',
        'Use the source explorer and comparison tools for this repository state.'
      ]
    };
  }

  return {
    supported: false,
    kind: 'source-only',
    title: 'Source explorer only',
    reason: 'No known static preview entry or safe README preview was detected for this historical state.',
    warnings: ['Historical source exploration remains available.']
  };
}

export function sanitizeStaticHtml(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '<!-- script removed by RepoTimeMachine -->')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, '')
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '<!-- iframe removed by RepoTimeMachine -->')
    .replace(/<object\b[^>]*>[\s\S]*?<\/object>/gi, '<!-- object removed by RepoTimeMachine -->')
    .replace(/<embed\b[^>]*>/gi, '<!-- embed removed by RepoTimeMachine -->');
}
