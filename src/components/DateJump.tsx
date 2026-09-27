import { FormEvent, useState } from 'react';

export function DateJump({ disabled, onJump }: { disabled?: boolean; onJump: (date: string) => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (date) onJump(date);
  }

  return (
    <form className="date-jump panel" onSubmit={submit}>
      <div>
        <p className="eyebrow">Jump by date</p>
        <strong>Find the latest commit at or before a date.</strong>
      </div>
      <div className="date-controls">
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} max={today} />
        <button type="submit" disabled={disabled}>
          Travel
        </button>
      </div>
    </form>
  );
}
