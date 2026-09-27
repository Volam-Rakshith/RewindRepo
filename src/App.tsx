import { useCallback, useEffect, useMemo, useState } from 'react';
import './styles.css';
import type {
  AppError,
  BranchInfo,
  FileContent,
  RepoCoordinates,
  RepositoryInfo,
  RepoTree,
  TimelineData,
  TimelinePoint,
  TreeNode
} from './types';
import { BranchSelector } from './components/BranchSelector';
import { ComparePanel } from './components/ComparePanel';
import { DateJump } from './components/DateJump';
import { ErrorCallout } from './components/ErrorCallout';
import { FileExplorer } from './components/FileExplorer';
import { FileViewer } from './components/FileViewer';
import { RepositoryForm } from './components/RepositoryForm';
import { Timeline } from './components/Timeline';
import { getBlob, getBranches, getLatestCommitBeforeDate, getRepository, getTimeline, getTree, resolveCommit } from './lib/github';
import { toAppError } from './lib/errors';
import { repoToString, repoUrl } from './lib/repo';
import { findReadme } from './lib/tree';

const INITIAL_REPO: RepoCoordinates = { owner: 'vitejs', repo: 'vite' };

type Status = 'idle' | 'loading-repo' | 'loading-timeline' | 'loading-tree' | 'loading-file';

export default function App() {
  const [coordinates, setCoordinates] = useState<RepoCoordinates | null>(INITIAL_REPO);
  const [repository, setRepository] = useState<RepositoryInfo | null>(null);
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [branch, setBranch] = useState<string>('');
  const [timeline, setTimeline] = useState<TimelineData | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<TimelinePoint | null>(null);
  const [tree, setTree] = useState<RepoTree | null>(null);
  const [selectedFile, setSelectedFile] = useState<FileContent | null>(null);
  const [selectedPath, setSelectedPath] = useState<string>('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<AppError | null>(null);

  const isLoading = status !== 'idle';

  const loadRepository = useCallback(async (repo: RepoCoordinates) => {
    setCoordinates(repo);
    setStatus('loading-repo');
    setError(null);
    setTimeline(null);
    setSelectedPoint(null);
    setTree(null);
    setSelectedFile(null);
    setSelectedPath('');
    try {
      const [repoInfo, branchList] = await Promise.all([getRepository(repo), getBranches(repo)]);
      setRepository(repoInfo);
      setBranches(branchList);
      setBranch(repoInfo.defaultBranch);
    } catch (caught) {
      setError(toAppError(caught));
      setRepository(null);
      setBranches([]);
      setBranch('');
    } finally {
      setStatus('idle');
    }
  }, []);

  useEffect(() => {
    void loadRepository(INITIAL_REPO);
  }, [loadRepository]);

  useEffect(() => {
    if (!coordinates || !branch) return;
    const repo = coordinates;
    const selectedBranch = branch;
    let cancelled = false;
    async function run() {
      setStatus('loading-timeline');
      setError(null);
      setTimeline(null);
      setSelectedPoint(null);
      setTree(null);
      setSelectedFile(null);
      setSelectedPath('');
      try {
        const nextTimeline = await getTimeline(repo, selectedBranch);
        if (cancelled) return;
        setTimeline(nextTimeline);
        const newestCommit = nextTimeline.commits[0];
        if (newestCommit) {
          setSelectedPoint({
            id: `commit:${newestCommit.sha}`,
            kind: 'commit',
            label: newestCommit.shortSha,
            ref: newestCommit.sha,
            sha: newestCommit.sha,
            date: newestCommit.authorDate,
            title: newestCommit.message,
            description: `${newestCommit.authorName}`,
            url: newestCommit.url
          });
        }
      } catch (caught) {
        if (!cancelled) setError(toAppError(caught));
      } finally {
        if (!cancelled) setStatus('idle');
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [coordinates, branch]);

  useEffect(() => {
    if (!coordinates || !selectedPoint) return;
    const repo = coordinates;
    const point = selectedPoint;
    let cancelled = false;
    async function run() {
      setStatus('loading-tree');
      setError(null);
      setTree(null);
      setSelectedFile(null);
      setSelectedPath('');
      try {
        const sha = point.sha ?? (await resolveCommit(repo, point.ref)).sha;
        const nextTree = await getTree(repo, sha);
        if (cancelled) return;
        setTree(nextTree);
        const readme = findReadme(nextTree.items);
        if (readme && readme.type === 'blob') {
          setSelectedPath(readme.path);
          setStatus('loading-file');
          const content = await getBlob(repo, readme.path, readme.sha, readme.size);
          if (!cancelled) setSelectedFile(content);
        }
      } catch (caught) {
        if (!cancelled) setError(toAppError(caught));
      } finally {
        if (!cancelled) setStatus('idle');
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [coordinates, selectedPoint]);

  async function handleOpenFile(node: TreeNode) {
    if (!coordinates || !node.sha) return;
    setSelectedPath(node.path);
    setStatus('loading-file');
    setError(null);
    try {
      const content = await getBlob(coordinates, node.path, node.sha, node.size);
      setSelectedFile(content);
    } catch (caught) {
      setError(toAppError(caught));
    } finally {
      setStatus('idle');
    }
  }

  async function handleDateJump(date: string) {
    if (!coordinates || !branch) return;
    setStatus('loading-timeline');
    setError(null);
    try {
      const commit = await getLatestCommitBeforeDate(coordinates, branch, `${date}T23:59:59.999Z`);
      if (!commit) {
        setError({
          kind: 'deleted-commit',
          title: 'No historical commit found',
          message: `GitHub returned no commits on ${branch} at or before ${date}.`,
          recovery: 'Try a later date or a different branch.'
        });
        return;
      }
      const point: TimelinePoint = {
        id: `date:${date}:${commit.sha}`,
        kind: 'date',
        label: date,
        ref: commit.sha,
        sha: commit.sha,
        date: commit.authorDate,
        title: `Date jump: ${date}`,
        description: `Resolved to ${commit.shortSha} · ${commit.message}`,
        url: commit.url
      };
      setTimeline((current) =>
        current
          ? {
              ...current,
              points: [...current.points.filter((item) => item.id !== point.id), point].sort(
                (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
              )
            }
          : current
      );
      setSelectedPoint(point);
    } catch (caught) {
      setError(toAppError(caught));
    } finally {
      setStatus('idle');
    }
  }

  const selectedSummary = useMemo(() => {
    if (!selectedPoint) return 'Select a point on the timeline.';
    return `${selectedPoint.kind.toUpperCase()} · ${selectedPoint.label} · ${selectedPoint.title}`;
  }, [selectedPoint]);

  return (
    <div className="app-shell">
      <div className="background-grid" aria-hidden="true" />
      <RepositoryForm initial={coordinates} loading={status === 'loading-repo'} onSubmit={loadRepository} />

      <main className="workspace">
        {error ? <ErrorCallout error={error} /> : null}

        {repository ? (
          <>
            <div className="top-grid">
              <BranchSelector repo={repository} branches={branches} selected={branch} onChange={setBranch} />
              <DateJump disabled={!coordinates || !branch || isLoading} onJump={handleDateJump} />
              <section className="panel safety-panel">
                <p className="eyebrow">Safety model</p>
                <strong>No arbitrary repository code is executed.</strong>
                <p>
                  RepoTimeMachine uses public GitHub APIs, lazy file retrieval, local metadata caching, and source-only fallbacks.
                </p>
              </section>
            </div>

            <Timeline timeline={timeline} selectedId={selectedPoint?.id} onSelect={setSelectedPoint} />

            <section className="state-strip panel" aria-label="Selected historical state">
              <div>
                <p className="eyebrow">Current coordinates</p>
                <strong>{selectedSummary}</strong>
              </div>
              {coordinates ? (
                <a href={repoUrl(coordinates)} target="_blank" rel="noreferrer">
                  {repoToString(coordinates)} ↗
                </a>
              ) : null}
            </section>

            <div className="explorer-grid">
              <FileExplorer tree={tree} selectedPath={selectedPath} onOpen={handleOpenFile} />
              <FileViewer file={selectedFile} selectedPoint={selectedPoint} loading={status === 'loading-file'} />
            </div>

            <div className="lower-grid">
              <ComparePanel repo={coordinates} points={timeline?.points ?? []} current={selectedPoint} />
            </div>
          </>
        ) : !error ? (
          <section className="panel empty-state tall">Load a public GitHub repository to begin time travel.</section>
        ) : null}
      </main>
    </div>
  );
}
