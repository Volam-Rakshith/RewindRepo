import type { TimelineData, TimelinePoint } from '../types';
import { formatDate, formatDateTime } from '../lib/date';

export function Timeline({
  timeline,
  selectedId,
  onSelect
}: {
  timeline: TimelineData | null;
  selectedId?: string;
  onSelect: (point: TimelinePoint) => void;
}) {
  if (!timeline) {
    return (
      <section className="timeline panel skeleton-panel">
        <div className="skeleton line wide" />
        <div className="skeleton timeline-line" />
      </section>
    );
  }

  const points = timeline.points;
  const maxActivity = Math.max(1, ...timeline.activity.map((bucket) => bucket.count));

  return (
    <section className="timeline panel" aria-label="Repository timeline">
      <div className="timeline-header">
        <div>
          <p className="eyebrow">Time machine</p>
          <h2>Historical timeline</h2>
        </div>
        <div className="timeline-direction" aria-hidden="true">
          <span>← older</span>
          <span>newer →</span>
        </div>
      </div>
      <div className="activity-strip" aria-label="Major activity periods">
        {timeline.activity.map((bucket) => (
          <span
            key={`${bucket.start}-${bucket.end}`}
            style={{ height: `${12 + (bucket.count / maxActivity) * 46}px` }}
            title={`${bucket.count} commits · ${formatDate(bucket.start)} – ${formatDate(bucket.end)}`}
          />
        ))}
      </div>
      <div className="time-rail" role="list">
        {points.length === 0 ? (
          <p className="empty-state">No timeline points are available from the public GitHub API.</p>
        ) : (
          points.map((point, index) => {
            const selected = selectedId === point.id;
            return (
              <button
                key={point.id}
                className={`time-point ${point.kind} ${selected ? 'selected' : ''}`}
                style={{ '--point-index': index } as React.CSSProperties}
                onClick={() => onSelect(point)}
                title={`${point.title}\n${formatDateTime(point.date)}`}
                role="listitem"
              >
                <span className="point-dot" />
                <span className="point-label">{point.label}</span>
                <small>{point.kind}</small>
              </button>
            );
          })
        )}
      </div>
      {timeline.limited ? (
        <div className="callout subtle">
          Showing the latest 100 commits plus available tags and releases. Use date jump for older states.
        </div>
      ) : null}
    </section>
  );
}
