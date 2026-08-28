const BAR_COUNT = 5;

/** Live mic mark shown while Part 2 is recording. */
export function RecordingPulse({ level }: { level: number }) {
  const meter = Math.min(1, Math.max(0, level));
  /** Quiet speech still moves the bars; room tone stays small. */
  const voice = Math.min(1, Math.pow(meter, 0.4) * 1.6);

  return (
    <div className="mt-6 flex items-end gap-4" data-testid="recording-pulse">
      <div
        className="recording-voice"
        aria-hidden="true"
        style={{ ["--voice" as string]: String(voice) }}
        data-level={voice.toFixed(2)}
      >
        {Array.from({ length: BAR_COUNT }, (_, index) => (
          <span key={index} className="recording-voice__bar" />
        ))}
      </div>
      <p className="mb-0.5 flex items-center gap-2 font-mono text-[0.7rem] uppercase tracking-[0.22em] text-vermilion">
        <span className="recording-pulse__dot" />
        Rec
      </p>
      <p role="status" className="sr-only">
        Recording — microphone live
      </p>
    </div>
  );
}
