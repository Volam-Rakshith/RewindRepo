import type { AppError } from '../types';

export function ErrorCallout({ error }: { error: AppError }) {
  return (
    <div className={`callout error ${error.kind}`} role="alert">
      <div>
        <strong>{error.title}</strong>
        <p>{error.message}</p>
        {error.recovery ? <small>{error.recovery}</small> : null}
      </div>
      {error.status ? <span className="status-code">{error.status}</span> : null}
    </div>
  );
}
