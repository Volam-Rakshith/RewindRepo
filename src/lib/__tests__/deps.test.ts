import { describe, expect, it } from 'vitest';
import { diffDependencies, parseDependencies } from '../deps';

describe('dependency parsing', () => {
  it('extracts npm dependency groups', () => {
    const deps = parseDependencies(
      'package.json',
      JSON.stringify({ dependencies: { react: '^19.0.0' }, devDependencies: { vite: '^7.0.0' } })
    );
    expect(deps.react).toBe('^19.0.0');
    expect(deps['dev:vite']).toBe('^7.0.0');
  });

  it('extracts Python requirements', () => {
    const deps = parseDependencies('requirements.txt', 'requests==2.31.0\n# comment\npytest>=8');
    expect(deps.requests).toBe('==2.31.0');
    expect(deps.pytest).toBe('>=8');
  });

  it('extracts Go module requirements', () => {
    const deps = parseDependencies('go.mod', 'module demo\nrequire (\n github.com/gin-gonic/gin v1.10.0\n)');
    expect(deps['github.com/gin-gonic/gin']).toBe('v1.10.0');
  });

  it('extracts npm package lock dependencies', () => {
    const deps = parseDependencies(
      'package-lock.json',
      JSON.stringify({ packages: { '': {}, 'node_modules/react': { version: '19.0.0' } } })
    );
    expect(deps.react).toBe('19.0.0');
  });

  it('reports added, removed, and changed dependencies', () => {
    const changes = diffDependencies(
      'package.json',
      JSON.stringify({ dependencies: { react: '^18.0.0', lodash: '^4.0.0' } }),
      JSON.stringify({ dependencies: { react: '^19.0.0', zod: '^4.0.0' } })
    );
    expect(changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ packageName: 'react', type: 'changed' }),
        expect.objectContaining({ packageName: 'lodash', type: 'removed' }),
        expect.objectContaining({ packageName: 'zod', type: 'added' })
      ])
    );
  });
});
