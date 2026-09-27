import { useEffect, useMemo, useState } from 'react';
import type { CompareResult, DependencyChange, RepoCoordinates, TimelinePoint } from '../types';
import { compareRefs, getFileTextAtRef } from '../lib/github';
import { dependencyFilesFromCompare, diffDependencies } from '../lib/deps';
import { toAppError } from '../lib/errors';
import { ErrorCallout } from './ErrorCallout';

type Props = {
  repo: RepoCoordinates | null;
  points: TimelinePoint[];
  current: TimelinePoint | null;
};

export function ComparePanel({ repo, points, current }: Props) {
  const defaultA = points[Math.max(0, points.length - 2)]?.ref ?? '';
  const defaultB = current?.ref ?? points[points.length - 1]?.ref ?? '';
  const [base, setBase] = useState(defaultA);
  const [head, setHead] = useState(defaultB);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [dependencies, setDependencies] = useState<DependencyChange[]>([]);
  const [dependencyFiles, setDependencyFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ReturnType<typeof toAppError> | null>(null);

  useEffect(() => {
    if (!base && defaultA) setBase(defaultA);
    if (!head && defaultB) setHead(defaultB);
  }, [base, defaultA, defaultB, head]);

  useEffect(() => {
    if (current?.ref) setHead(current.ref);
  }, [current?.ref]);

  const candidates = useMemo(() => points.filter((point) => point.ref), [points]);

  async function runCompare() {
    if (!repo || !base || !head || base === head) return;
    setLoading(true);
    setError(null);
    setDependencies([]);
    setDependencyFiles([]);
    try {
      const compare = await compareRefs(repo, base, head);
      setResult(compare);
      const depFiles = dependencyFilesFromCompare(compare.files).slice(0, 40);
      setDependencyFiles(depFiles);
      const depChanges = (
        await Promise.all(
          depFiles.map(async (file) => {
            const [before, after] = await Promise.all([
              getFileTextAtRef(repo, base, file),
              getFileTextAtRef(repo, head, file)
            ]);
            return diffDependencies(file, before, after);
          })
        )
      ).flat();
      setDependencies(depChanges);
    } catch (caught) {
      setError(toAppError(caught));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="compare-panel panel" aria-label="Code comparison">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Version A ↕ Version B</p>
          <h2>Compare historical states</h2>
        </div>
        <button onClick={runCompare} disabled={!repo || !base || !head || base === head || loading}>
          {loading ? 'Comparing…' : 'Compare'}
        </button>
      </div>
      <div className="compare-controls">
        <label>
          Version A
          <select value={base} onChange={(event) => setBase(event.target.value)}>
            <option value="">Select a point</option>
            {candidates.map((point) => (
              <option key={`a-${point.id}`} value={point.ref}>
                {point.label} · {point.kind}
              </option>
            ))}
          </select>
        </label>
        <span className="swap-glyph">↕</span>
        <label>
          Version B
          <select value={head} onChange={(event) => setHead(event.target.value)}>
            <option value="">Select a point</option>
            {candidates.map((point) => (
              <option key={`b-${point.id}`} value={point.ref}>
                {point.label} · {point.kind}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error ? <ErrorCallout error={error} /> : null}
      {result ? (
        <div className="compare-result">
          <div className="compare-summary">
            <span>{result.status}</span>
            <span>{result.files.length.toLocaleString()} files</span>
            <span>+{sum(result.files, 'additions').toLocaleString()}</span>
            <span>-{sum(result.files, 'deletions').toLocaleString()}</span>
            <a href={result.htmlUrl} target="_blank" rel="noreferrer">
              Open on GitHub
            </a>
          </div>
          <FileChangeGroups files={result.files} />
          <DependencySummary changes={dependencies} dependencyFiles={dependencyFiles} />
        </div>
      ) : (
        <p className="empty-state">
          Select two commits, tags, releases, or date-resolved states to view added, removed, modified, and renamed files.
        </p>
      )}
    </section>
  );
}

function FileChangeGroups({ files }: { files: CompareResult['files'] }) {
  const groups = groupByStatus(files);
  return (
    <div className="file-change-groups">
      {Object.entries(groups).map(([status, group]) => (
        <details key={status} open={status === 'modified' || status === 'added'}>
          <summary>
            {status} <span>{group.length}</span>
          </summary>
          {group.slice(0, 60).map((file) => (
            <article key={`${file.status}:${file.filename}`} className={`diff-file ${file.status}`}>
              <div className="diff-file-header">
                <strong>{file.filename}</strong>
                {file.previousFilename ? <small>renamed from {file.previousFilename}</small> : null}
                <span>
                  +{file.additions} −{file.deletions}
                </span>
              </div>
              {file.patch ? <pre className="patch-pane">{file.patch}</pre> : <p className="patch-missing">Line patch unavailable.</p>}
            </article>
          ))}
          {group.length > 60 ? <p className="empty-state">Showing first 60 files in this group.</p> : null}
        </details>
      ))}
    </div>
  );
}

function DependencySummary({ changes, dependencyFiles }: { changes: DependencyChange[]; dependencyFiles: string[] }) {
  return (
    <div className="dependency-summary">
      <div className="dependency-heading">
        <h3>Dependency changes</h3>
        {dependencyFiles.length ? <span>{dependencyFiles.length} dependency file{dependencyFiles.length === 1 ? '' : 's'} checked</span> : null}
      </div>
      {changes.length === 0 ? (
        dependencyFiles.length === 0 ? (
          <p>No dependency manifest or lock files changed in this comparison.</p>
        ) : (
          <div className="dependency-empty-detail">
            <p>Dependency files changed, but no package-level version changes were extracted.</p>
            <small>Checked: {dependencyFiles.join(', ')}</small>
          </div>
        )
      ) : (
        <div className="dependency-table" role="table" aria-label="Dependency changes">
          {changes.slice(0, 250).map((change) => (
            <div key={`${change.file}:${change.packageName}`} role="row" className={change.type}>
              <span>{change.ecosystem}</span>
              <strong>{change.packageName}</strong>
              <span>{change.before ?? '∅'}</span>
              <span>→</span>
              <span>{change.after ?? '∅'}</span>
              <small>{change.file}</small>
            </div>
          ))}
          {changes.length > 250 ? <p className="empty-state">Showing first 250 dependency changes.</p> : null}
        </div>
      )}
    </div>
  );
}

function groupByStatus(files: CompareResult['files']) {
  return files.reduce<Record<string, CompareResult['files']>>((groups, file) => {
    groups[file.status] = groups[file.status] ?? [];
    groups[file.status].push(file);
    return groups;
  }, {});
}

function sum(files: CompareResult['files'], key: 'additions' | 'deletions') {
  return files.reduce((total, file) => total + file[key], 0);
}
