import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { BrandLockup } from "../BrandLockup";
import {
  getSpeakingAttempt,
  reviseSpeakingAttempt,
  submitSpeakingAttempt,
  type SpeakingAttemptDetail,
  type SpeakingFeedback,
  type SpeakingMark,
  type SpeakingScores,
} from "../api/speaking";
import { BandStamp } from "../practice/BandStamp";
import { formatClock } from "../practice/exam-math";
import { formatBandDelta, reviseAction } from "../practice/revise-availability";
import { SidePanel } from "../SidePanel";
import { recordingBlockReason } from "../speaking/rms-silence";
import { SpeakingCriteriaBars } from "../speaking/SpeakingCriteriaBars";
import { paintSpeakingHighlights, clearSpeakingHighlights } from "../speaking/speaking-highlights";
import { recordingSupported, useRecorder } from "../speaking/useRecorder";
import { encodeWav } from "../speaking/wav-encode";

const PREP_SECONDS = 60;

type Phase = "prep" | "record" | "review";

type Capture = {
  pcm: Float32Array;
  sampleRate: number;
  durationMs: number;
};

export function SpeakingAttemptPage() {
  const { id } = useParams<{ id: string }>();
  const attempt = useQuery({
    queryKey: ["speaking-attempt", id],
    queryFn: () => getSpeakingAttempt(id!),
    enabled: Boolean(id),
  });

  if (!id || attempt.isLoading) {
    return <CenteredNote>Opening the cue card…</CenteredNote>;
  }

  if (attempt.isError || !attempt.data) {
    return <CenteredNote>That talk is not here.</CenteredNote>;
  }

  if (attempt.data.submittedAt) {
    return <ResultView attempt={attempt.data} />;
  }

  return <SpeakingSession attempt={attempt.data} />;
}

function SpeakingSession({ attempt }: { attempt: SpeakingAttemptDetail }) {
  const queryClient = useQueryClient();
  const {
    state: recorderState,
    pcm,
    sampleRate,
    durationMs: recordingMs,
    level,
    errorMessage: recorderError,
    start,
    stop,
    reset,
  } = useRecorder();
  const [phase, setPhase] = useState<Phase>("prep");
  const [prepLeft, setPrepLeft] = useState(PREP_SECONDS);
  const [capture, setCapture] = useState<Capture | null>(null);
  const [blockMessage, setBlockMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const enteredRecordRef = useRef(false);

  const cue = attempt.cueCard;
  const isRevision = attempt.revisionRound > 0 || Boolean(attempt.parentAttemptId);

  // Prep countdown
  useEffect(() => {
    if (phase !== "prep") return;
    if (prepLeft <= 0) {
      setPhase("record");
      return;
    }
    const timer = setTimeout(() => setPrepLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [phase, prepLeft]);

  // Enter record → start mic once per visit to the phase
  useEffect(() => {
    if (phase !== "record") {
      enteredRecordRef.current = false;
      return;
    }
    if (enteredRecordRef.current) return;
    enteredRecordRef.current = true;

    if (!recordingSupported()) return;
    void start();
  }, [phase, start]);

  // Recorder finished (stop or auto-stop) → Review with buffered audio
  useEffect(() => {
    if (phase !== "record") return;
    if (recorderState !== "done") return;
    setCapture({
      pcm,
      sampleRate,
      durationMs: recordingMs,
    });
    setPhase("review");
  }, [phase, recorderState, pcm, sampleRate, recordingMs]);

  const playbackUrl = useMemo(() => {
    if (!capture || capture.pcm.length === 0 || capture.sampleRate <= 0) return null;
    if (typeof URL.createObjectURL !== "function") return null;
    const wav = encodeWav(capture.pcm, capture.sampleRate);
    const copy = new Uint8Array(wav.byteLength);
    copy.set(wav);
    return URL.createObjectURL(new Blob([copy], { type: "audio/wav" }));
  }, [capture]);

  useEffect(() => {
    return () => {
      if (playbackUrl) URL.revokeObjectURL(playbackUrl);
    };
  }, [playbackUrl]);

  const skipPrep = () => {
    setPrepLeft(0);
    setPhase("record");
  };

  const handleStop = () => {
    stop();
  };

  const handleRecordAgain = () => {
    setBlockMessage(null);
    setSubmitError(false);
    setCapture(null);
    reset();
    setPhase("record");
  };

  const handleSubmit = async () => {
    if (!capture) return;
    setSubmitError(false);
    const reason = recordingBlockReason(capture.pcm, capture.durationMs);
    if (reason === "too-short") {
      setBlockMessage("Speak for at least 10 seconds before submitting.");
      return;
    }
    if (reason === "silent") {
      setBlockMessage("That recording sounds silent. Check your microphone and record again.");
      return;
    }

    setSubmitting(true);
    setBlockMessage(null);
    try {
      const wav = encodeWav(capture.pcm, capture.sampleRate);
      const audioBase64 = bytesToBase64(wav);
      await submitSpeakingAttempt(attempt.id, {
        audioBase64,
        format: "wav",
        durationMs: capture.durationMs,
      });
      await queryClient.invalidateQueries({ queryKey: ["speaking-attempt", attempt.id] });
      await queryClient.invalidateQueries({ queryKey: ["speaking-attempts"] });
    } catch {
      setSubmitError(true);
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen min-w-0 flex-col overflow-x-hidden">
      <header className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-rule px-3 py-3 sm:gap-x-4 sm:px-6">
        <BrandLockup to="/speaking" size="sm" />
        <span className="min-w-0 truncate font-mono text-[0.65rem] uppercase tracking-[0.15em] text-ink-faint sm:text-[0.7rem]">
          Part 2 · {attempt.level}
        </span>
        {isRevision && (
          <span className="font-mono text-[0.65rem] uppercase tracking-[0.15em] text-vermilion sm:text-[0.7rem]">
            Recording {attempt.revisionRound}/2
          </span>
        )}
        <Link
          to="/speaking"
          className="ml-auto font-mono text-[0.65rem] uppercase tracking-[0.15em] text-ink-soft hover:text-vermilion sm:text-[0.7rem]"
        >
          All talks
        </Link>
      </header>

      <main className="mx-auto flex w-full min-w-0 max-w-2xl flex-1 flex-col px-6 py-10">
        {phase === "prep" && (
          <PrepPhase cue={cue} secondsLeft={prepLeft} onSkip={skipPrep} />
        )}

        {phase === "record" && (
          <RecordPhase
            cue={cue}
            durationMs={recordingMs}
            level={level}
            errorMessage={
              recorderState === "error"
                ? recorderError
                : !recordingSupported()
                  ? "This browser cannot record audio."
                  : null
            }
            onStop={handleStop}
          />
        )}

        {phase === "review" && capture && (
          <ReviewPhase
            playbackUrl={playbackUrl}
            durationMs={capture.durationMs}
            blockMessage={blockMessage}
            submitError={submitError}
            submitting={submitting}
            onRecordAgain={handleRecordAgain}
            onSubmit={() => void handleSubmit()}
          />
        )}
      </main>
    </div>
  );
}

function PrepPhase({
  cue,
  secondsLeft,
  onSkip,
}: {
  cue: { topic: string; bullets: string[] };
  secondsLeft: number;
  onSkip: () => void;
}) {
  return (
    <section className="animate-fade-up">
      <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-ink-faint">
        Preparation · {formatClock(secondsLeft)}
      </p>
      <h1 className="mt-4 font-display text-3xl font-semibold leading-snug">{cue.topic}</h1>
      <p className="mt-3 text-ink-soft">You should say:</p>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-ink">
        {cue.bullets.map((bullet) => (
          <li key={bullet}>{bullet}</li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onSkip}
        className="mt-10 min-h-11 bg-ink px-5 py-3 font-mono text-[0.75rem] uppercase tracking-[0.18em] text-paper transition-colors hover:bg-vermilion"
      >
        Skip prep
      </button>
    </section>
  );
}

function RecordPhase({
  cue,
  durationMs,
  level,
  errorMessage,
  onStop,
}: {
  cue: { topic: string; bullets: string[] };
  durationMs: number;
  level: number;
  errorMessage: string | null;
  onStop: () => void;
}) {
  const seconds = Math.floor(durationMs / 1000);
  const meter = Math.min(1, level);

  return (
    <section className="animate-fade-up">
      <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-ink-faint">Recording</p>
      <p
        className="mt-4 font-display text-5xl tabular-nums tracking-tight"
        aria-label="Recording time"
      >
        {formatClock(seconds)}
      </p>
      <div className="mt-6 h-1.5 w-full bg-rule" aria-hidden="true">
        <div
          className="h-1.5 bg-vermilion transition-[width] duration-100"
          style={{ width: `${meter * 100}%` }}
        />
      </div>
      <p className="mt-8 font-display text-xl leading-snug text-ink-soft">{cue.topic}</p>
      {errorMessage ? (
        <p className="mt-6 text-sm text-vermilion">{errorMessage}</p>
      ) : (
        <button
          type="button"
          onClick={onStop}
          className="mt-10 min-h-11 bg-ink px-5 py-3 font-mono text-[0.75rem] uppercase tracking-[0.18em] text-paper transition-colors hover:bg-vermilion"
        >
          Stop recording
        </button>
      )}
    </section>
  );
}

function ReviewPhase({
  playbackUrl,
  durationMs,
  blockMessage,
  submitError,
  submitting,
  onRecordAgain,
  onSubmit,
}: {
  playbackUrl: string | null;
  durationMs: number;
  blockMessage: string | null;
  submitError: boolean;
  submitting: boolean;
  onRecordAgain: () => void;
  onSubmit: () => void;
}) {
  return (
    <section className="animate-fade-up">
      <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-ink-faint">Review</p>
      <p className="mt-4 font-display text-2xl">
        {formatClock(Math.floor(durationMs / 1000))} recorded
      </p>
      {playbackUrl ? (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <audio controls src={playbackUrl} className="mt-6 w-full" />
      ) : (
        <p className="mt-6 text-sm text-ink-soft">No audio to play back.</p>
      )}
      {blockMessage && <p className="mt-4 text-sm text-vermilion">{blockMessage}</p>}
      {submitError && (
        <p className="mt-4 text-sm text-vermilion">
          Marking failed. Your recording is still here — try submit again.
        </p>
      )}
      <div className="mt-10 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onRecordAgain}
          disabled={submitting}
          className="min-h-11 border border-rule px-5 py-3 font-mono text-[0.75rem] uppercase tracking-[0.18em] text-ink transition-colors hover:border-vermilion hover:text-vermilion disabled:opacity-60"
        >
          Record again
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting}
          className="min-h-11 bg-ink px-5 py-3 font-mono text-[0.75rem] uppercase tracking-[0.18em] text-paper transition-colors hover:bg-vermilion disabled:opacity-60"
        >
          {submitting ? "Marking…" : "Submit"}
        </button>
      </div>
    </section>
  );
}

function ResultView({ attempt }: { attempt: SpeakingAttemptDetail }) {
  const navigate = useNavigate();
  const [scoresOpen, setScoresOpen] = useState(true);
  const scoresTriggerRef = useRef<HTMLButtonElement>(null);
  const transcriptRef = useRef<HTMLParagraphElement>(null);

  const action = reviseAction({
    band: attempt.band,
    submittedAt: attempt.submittedAt,
    revisionRound: attempt.revisionRound,
    hasRevision: attempt.hasRevision,
    pendingRevisionId: attempt.pendingRevisionId,
  });

  const revise = useMutation({
    mutationFn: () => reviseSpeakingAttempt(attempt.id),
    onSuccess: (created) => {
      navigate(`/speaking/${created.id}`);
    },
  });

  useEffect(() => {
    const el = transcriptRef.current;
    if (!el) return;
    const marks = attempt.marks ?? [];
    paintSpeakingHighlights(el, marks);
    return () => clearSpeakingHighlights();
  }, [attempt.marks, attempt.transcript]);

  return (
    <div className="flex h-screen min-w-0 flex-col overflow-x-hidden">
      <header className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-rule px-3 py-3 sm:gap-x-4 sm:px-6">
        <BrandLockup to="/speaking" size="sm" />
        <span className="min-w-0 truncate font-mono text-[0.65rem] uppercase tracking-[0.15em] text-ink-faint sm:text-[0.7rem]">
          Part 2 · {attempt.level}
        </span>
        <button
          ref={scoresTriggerRef}
          type="button"
          onClick={() => setScoresOpen((current) => !current)}
          aria-expanded={scoresOpen}
          className="font-mono text-[0.65rem] uppercase tracking-[0.15em] text-ink-soft hover:text-vermilion sm:text-[0.7rem] lg:hidden"
        >
          Scores
        </button>
        {action.kind === "revise" && (
          <button
            type="button"
            onClick={() => revise.mutate()}
            disabled={revise.isPending}
            className="ml-auto bg-ink px-3 py-1.5 font-mono text-[0.65rem] uppercase tracking-[0.15em] text-paper transition-colors hover:bg-vermilion disabled:opacity-60 sm:px-4 sm:text-[0.7rem]"
          >
            Record again
          </button>
        )}
        {action.kind === "resume" && (
          <button
            type="button"
            onClick={() => navigate(`/speaking/${action.attemptId}`)}
            className="ml-auto bg-ink px-3 py-1.5 font-mono text-[0.65rem] uppercase tracking-[0.15em] text-paper transition-colors hover:bg-vermilion sm:px-4 sm:text-[0.7rem]"
          >
            Resume recording
          </button>
        )}
      </header>

      <div className="flex min-h-0 flex-1">
        <SidePanel
          open={scoresOpen}
          onOpenChange={setScoresOpen}
          title="Scores"
          triggerLabel="Scores"
          triggerRef={scoresTriggerRef}
          side="left"
          className="w-[22rem]"
        >
          <div className="px-6 py-8">
            {attempt.band !== null && (
              <div className="mb-8">
                <BandStamp band={attempt.band} />
                {attempt.parentBand != null && (
                  <p className="mt-3 font-mono text-sm tabular-nums text-ink-soft">
                    {formatBandDelta(attempt.parentBand, attempt.band)}
                  </p>
                )}
              </div>
            )}

            {attempt.scores && attempt.feedback && (
              <SpeakingCriteriaBars
                scores={attempt.scores as SpeakingScores}
                feedback={attempt.feedback as SpeakingFeedback}
              />
            )}

            {attempt.fluency && (
              <section className="mt-8 border-t border-rule pt-6">
                <h2 className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-ink-faint">
                  Fluency
                </h2>
                <p className="mt-3 font-mono text-sm tabular-nums text-ink-soft">
                  {attempt.fluency.wordsPerMinute} WPM · {attempt.fluency.fillerCount} fillers
                </p>
              </section>
            )}

            {attempt.feedback && (
              <section className="mt-8 border-t border-rule pt-6">
                <h2 className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-vermilion">
                  Next time
                </h2>
                <p className="mt-3 font-display text-lg leading-snug">{attempt.feedback.nextFocus}</p>
                <p className="mt-3 text-sm leading-relaxed text-ink-soft">{attempt.feedback.overview}</p>
              </section>
            )}
          </div>
        </SidePanel>

        <div className="flex min-w-0 flex-1 flex-col px-6 py-8 sm:px-10">
          <h2 className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-ink-faint">
            Transcript
          </h2>
          <p
            ref={transcriptRef}
            className="mt-4 whitespace-pre-wrap font-body text-lg leading-relaxed text-ink"
          >
            {attempt.transcript?.trim() ? attempt.transcript : "No transcript was returned."}
          </p>
          {attempt.marks && attempt.marks.length > 0 && (
            <MarkLegend marks={attempt.marks} />
          )}
        </div>
      </div>
    </div>
  );
}

function MarkLegend({ marks }: { marks: SpeakingMark[] }) {
  const kinds = Array.from(new Set(marks.map((m) => m.kind)));
  const labels: Record<SpeakingMark["kind"], string> = {
    pronunciation: "Pronunciation",
    hesitation: "Hesitation",
    grammar: "Grammar",
    filler: "Filler",
  };
  return (
    <ul className="mt-8 flex flex-wrap gap-3 border-t border-rule pt-6">
      {kinds.map((kind) => (
        <li
          key={kind}
          className="font-mono text-[0.65rem] uppercase tracking-[0.15em] text-ink-soft"
        >
          <span className={`speaking-mark-swatch speaking-mark-swatch--${kind}`} aria-hidden />{" "}
          {labels[kind]}
        </li>
      ))}
    </ul>
  );
}

function CenteredNote({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex h-screen items-center justify-center">
      <p className="text-ink-soft">{children}</p>
    </main>
  );
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
