import { describe, expect, it } from 'vitest';
import type { GitTreeItem } from '../../types';
import { detectPreviewCapability, sanitizeStaticHtml } from '../preview';

const blob = (path: string): GitTreeItem => ({ path, mode: '100644', type: 'blob', sha: path });

describe('preview capability', () => {
  it('detects static HTML entry points', () => {
    const capability = detectPreviewCapability([blob('index.html')]);
    expect(capability.supported).toBe(true);
    expect(capability.kind).toBe('static-html');
  });

  it('falls back to README source preview', () => {
    const capability = detectPreviewCapability([blob('README.md')]);
    expect(capability.supported).toBe(true);
    expect(capability.kind).toBe('markdown');
  });

  it('refuses build-only frontend projects without sandboxing', () => {
    const capability = detectPreviewCapability([blob('package.json')]);
    expect(capability.supported).toBe(false);
    expect(capability.kind).toBe('unsupported-build');
  });

  it('removes active content from static HTML previews', () => {
    const sanitized = sanitizeStaticHtml('<button onclick="alert(1)">x</button><script>alert(1)</script>');
    expect(sanitized).not.toContain('onclick');
    expect(sanitized).not.toContain('<script>');
  });
});
