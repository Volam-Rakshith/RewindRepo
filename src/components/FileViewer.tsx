import type { FileContent, TimelinePoint } from '../types';
import { formatBytes, languageForPath } from '../lib/text';
import { formatDateTime } from '../lib/date';

export function FileViewer({
  file,
  loading,
  selectedPoint
}: {
  file: FileContent | null;
  loading?: boolean;
  selectedPoint: TimelinePoint | null;
}) {
  return (
    <section className="file-viewer panel" aria-label="File viewer">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Inspector</p>
          <h2>{file?.path ?? 'Select a file'}</h2>
        </div>
        {file ? <span className="language-pill">{languageForPath(file.path)}</span> : null}
      </div>
      {selectedPoint ? (
        <p className="context-line">
          Viewing <strong>{selectedPoint.label}</strong> from {formatDateTime(selectedPoint.date)}
        </p>
      ) : null}
      {loading ? (
        <div className="code-loading">
          <div className="skeleton line wide" />
          <div className="skeleton block" />
        </div>
      ) : !file ? (
        <div className="empty-state tall">
          Choose a source file from the tree. Text files are fetched lazily from GitHub at the selected commit.
        </div>
      ) : file.isTooLarge ? (
        <div className="callout warning">
          <strong>File too large for safe inline viewing.</strong>
          <p>{file.path} is {formatBytes(file.size)}. RepoTimeMachine avoids loading large files into the browser.</p>
        </div>
      ) : file.isBinary || file.text === undefined ? (
        <div className="callout warning">
          <strong>Binary or unsupported file.</strong>
          <p>{file.path} cannot be displayed as source text. Size: {formatBytes(file.size)}.</p>
        </div>
      ) : (
        <pre className="code-pane">
          <code>{file.text}</code>
        </pre>
      )}
    </section>
  );
}
