import { useEffect, useState } from 'react';
import type { FileContent, PreviewCapability, RepoCoordinates, RepoTree } from '../types';
import { getBlob } from '../lib/github';
import { detectPreviewCapability, sanitizeStaticHtml } from '../lib/preview';
import { findTreeItem } from '../lib/tree';

export function PreviewPanel({ repo, tree }: { repo: RepoCoordinates | null; tree: RepoTree | null }) {
  const [capability, setCapability] = useState<PreviewCapability | null>(null);
  const [entry, setEntry] = useState<FileContent | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!repo || !tree) {
      setCapability(null);
      setEntry(null);
      return;
    }
    const next = detectPreviewCapability(tree.items);
    setCapability(next);
    setEntry(null);
    if (!next.supported || !next.entryPath) return;
    const item = findTreeItem(tree.items, next.entryPath);
    if (!item || item.type !== 'blob') return;
    setLoading(true);
    getBlob(repo, item.path, item.sha, item.size)
      .then(setEntry)
      .catch(() => setEntry(null))
      .finally(() => setLoading(false));
  }, [repo, tree]);

  const html = capability?.kind === 'static-html' && entry?.text ? sanitizeStaticHtml(entry.text) : null;

  return (
    <section className="preview-panel panel" aria-label="Historical preview">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Website preview</p>
          <h2>{capability?.title ?? 'Preview capability'}</h2>
        </div>
        <span className={`preview-badge ${capability?.supported ? 'supported' : 'unsupported'}`}>
          {capability?.supported ? 'safe preview' : 'source only'}
        </span>
      </div>
      {!capability ? (
        <p className="empty-state">Load a repository state to evaluate preview support.</p>
      ) : (
        <>
          <p className="context-line">{capability.reason}</p>
          {capability.warnings.map((warning) => (
            <div className="callout subtle" key={warning}>
              {warning}
            </div>
          ))}
          {loading ? <div className="skeleton block" /> : null}
          {html ? (
            <iframe
              className="static-preview-frame"
              title="Historical static HTML preview"
              sandbox=""
              srcDoc={html}
            />
          ) : capability.kind === 'markdown' && entry?.text ? (
            <pre className="readme-preview">{entry.text}</pre>
          ) : capability.supported && !loading ? (
            <p className="empty-state">The preview entry could not be loaded from this historical state.</p>
          ) : null}
        </>
      )}
    </section>
  );
}
