import { FormEvent, useState } from 'react';
import type { RepoCoordinates } from '../types';
import { parseGitHubRepoUrl, repoToString } from '../lib/repo';

const EXAMPLES = ['https://github.com/facebook/react', 'vitejs/vite', 'https://github.com/vuejs/core'];

type Props = {
  initial?: RepoCoordinates | null;
  loading?: boolean;
  onSubmit: (repo: RepoCoordinates) => void;
};

export function RepositoryForm({ initial, loading, onSubmit }: Props) {
  const [value, setValue] = useState(initial ? repoToString(initial) : 'https://github.com/vitejs/vite');
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseGitHubRepoUrl(value);
    if (!parsed) {
      setError('Enter a public GitHub repository URL, owner/name shorthand, or git@github.com SSH URL.');
      return;
    }
    setError(null);
    onSubmit(parsed);
  }

  return (
    <section className="repo-form-shell" aria-label="Repository selection">
      <div>
        <p className="eyebrow">RepoTimeMachine by VR Developments</p>
        <h1>Explore a repository across time.</h1>
        <p className="hero-copy">
          Enter a public GitHub repository, choose a branch, and jump between commits, tags, releases, or a date.
        </p>
      </div>
      <form className="repo-form" onSubmit={submit}>
        <label htmlFor="repository-url">Repository URL</label>
        <div className="repo-input-row">
          <input
            id="repository-url"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="https://github.com/owner/repo"
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Loading…' : 'Launch'}
          </button>
        </div>
        {error ? <p className="field-error">{error}</p> : null}
        <div className="example-row" aria-label="Examples">
          {EXAMPLES.map((example) => (
            <button key={example} type="button" onClick={() => setValue(example)}>
              {example.replace('https://github.com/', '')}
            </button>
          ))}
        </div>
      </form>
    </section>
  );
}
