import type { BranchInfo, RepositoryInfo } from '../types';

export function BranchSelector({
  repo,
  branches,
  selected,
  onChange
}: {
  repo: RepositoryInfo;
  branches: BranchInfo[];
  selected: string;
  onChange: (branch: string) => void;
}) {
  return (
    <div className="branch-card panel">
      <div>
        <p className="eyebrow">Repository</p>
        <h2>{repo.fullName}</h2>
        {repo.description ? <p>{repo.description}</p> : <p>No description provided.</p>}
      </div>
      <div className="repo-stats" aria-label="Repository stats">
        <span>★ {repo.stars.toLocaleString()}</span>
        <span>⑂ {repo.forks.toLocaleString()}</span>
        <span>{Math.round(repo.sizeKb / 1024).toLocaleString()} MB</span>
        {repo.isArchived ? <span className="archived">Archived</span> : null}
      </div>
      <label className="select-label">
        Branch
        <select value={selected} onChange={(event) => onChange(event.target.value)}>
          {branches.map((branch) => (
            <option key={branch.name} value={branch.name}>
              {branch.name}
              {branch.name === repo.defaultBranch ? ' (default)' : ''}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
