import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { analyze } from "@writing-helper/analysis";
import { TASK_CATALOG, type TaskSpec } from "@writing-helper/practice";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getAttempt, submitAttempt, updateAttempt, type PracticeAttemptDetail } from "../api/practice";
import { Editor, type EditorChange } from "../editor/Editor";
import { BandStamp } from "../practice/BandStamp";
import { CriteriaBars } from "../practice/CriteriaBars";
import {
  countWords,
  formatClock,
  remainingSeconds,
  wordCountTone,
} from "../practice/exam-math";
import { StyleProfile } from "../practice/StyleProfile";

const AUTOSAVE_DELAY_MS = 2000;

export function PracticeAttemptPage() {
  const { id } = useParams<{ id: string }>();
  const attempt = useQuery({
    queryKey: ["practice-attempt", id],
    queryFn: () => getAttempt(id!),
    enabled: Boolean(id),
  });

  if (!id || attempt.isLoading) {
    return <CenteredNote>Opening the paper…</CenteredNote>;
  }

  if (attempt.isError || !attempt.data) {
    return <CenteredNote>That paper is not here.</CenteredNote>;
  }

  const spec = TASK_CATALOG.find((task) => task.type === attempt.data.taskType);
  if (!spec) {
    return <CenteredNote>This task type is no longer in the catalog.</CenteredNote>;
  }

  if (attempt.data.submittedAt) {
    return <ResultView attempt={attempt.data} spec={spec} />;
  }

  return <ExamRoom attempt={attempt.data} spec={spec} />;
}

function ExamRoom({ attempt, spec }: { attempt: PracticeAttemptDetail; spec: TaskSpec }) {
  const queryClient = useQueryClient();
  const [hintsOpen, setHintsOpen] = useState(attempt.hintsOpened);
  const [wordCount, setWordCount] = useState(attempt.wordCount);
  const [remaining, setRemaining] = useState(() =>
    remainingSeconds(new Date(attempt.startedAt), spec.timeMinutes),
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);

  const draftRef = useRef<EditorChange | null>(null);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const save = useMutation({
    mutationFn: (input: Parameters<typeof updateAttempt>[1]) => updateAttempt(attempt.id, input),
  });

  useEffect(() => {
    const tick = () =>
      setRemaining(remainingSeconds(new Date(attempt.startedAt), spec.timeMinutes));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [attempt.startedAt, spec.timeMinutes]);

  useEffect(() => () => clearTimeout(autosaveTimer.current), []);

  const handleChange = useCallback(
    (change: EditorChange) => {
      draftRef.current = change;
      setWordCount(countWords(change.plainText));
      clearTimeout(autosaveTimer.current);
      autosaveTimer.current = setTimeout(() => {
        save.mutate({
          content: change.editorState,
          plainText: change.plainText,
          wordCount: countWords(change.plainText),
        });
      }, AUTOSAVE_DELAY_MS);
    },
    [save],
  );

  const openHints = () => {
    setHintsOpen(true);
    if (!attempt.hintsOpened) {
      save.mutate({ hintsOpened: true });
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError(false);
    const draft = draftRef.current;
    const plainText = draft?.plainText ?? attempt.plainText;
    try {
      const snapshot = analyze(plainText);
      await submitAttempt(attempt.id, {
        styleSnapshot: snapshot,
        ...(draft
          ? { content: draft.editorState, plainText: draft.plainText, wordCount: countWords(draft.plainText) }
          : {}),
      });
      await queryClient.invalidateQueries({ queryKey: ["practice-attempt", attempt.id] });
      await queryClient.invalidateQueries({ queryKey: ["practice-attempts"] });
    } catch {
      setSubmitError(true);
      setSubmitting(false);
    }
  };

  const tone = wordCountTone(wordCount, spec.minWords);
  const timedOut = remaining === 0;

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-4 border-b border-rule px-6 py-3">
        <Link to="/practice" className="font-display text-lg font-semibold tracking-tight hover:text-vermilion">
          Practice
        </Link>
        <span
          className={`font-mono text-sm tabular-nums ${timedOut ? "text-vermilion" : "text-ink"}`}
          aria-label="Time remaining"
        >
          {formatClock(remaining)}
        </span>
        <span
          className={`font-mono text-[0.7rem] uppercase tracking-[0.15em] ${
            tone === "under" ? "text-vermilion" : "text-ink-soft"
          }`}
        >
          {wordCount} / {spec.minWords}–{spec.maxWords} words
        </span>
        <span className="ml-auto font-mono text-[0.7rem] uppercase tracking-[0.15em] text-ink-faint">
          {save.isPending ? "Saving…" : save.isSuccess ? "Saved" : null}
        </span>
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={submitting}
          className="bg-ink px-4 py-1.5 font-mono text-[0.7rem] uppercase tracking-[0.15em] text-paper transition-colors hover:bg-vermilion disabled:opacity-60"
        >
          {submitting ? "Marking…" : "Submit"}
        </button>
      </header>

      {timedOut && (
        <p className="border-b border-vermilion/40 bg-vermilion-soft px-6 py-2 text-sm text-vermilion">
          Time is up. You can still submit — the paper will not send itself.
        </p>
      )}
      {submitError && (
        <p className="border-b border-vermilion/40 px-6 py-2 text-sm text-vermilion">
          Marking failed. Try submit again.
        </p>
      )}

      <div className="flex min-h-0 flex-1">
        <PromptPane attempt={attempt} spec={spec} hintsOpen={hintsOpen} onOpenHints={openHints} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Editor
            key={attempt.id}
            mode="write"
            initialEditorState={attempt.content}
            onChange={handleChange}
            onAnalysis={() => undefined}
            placeholder="Write from the prompt. Marks stay hidden until you submit."
          />
        </div>
      </div>
    </div>
  );
}

function PromptPane({
  attempt,
  spec,
  hintsOpen,
  onOpenHints,
}: {
  attempt: PracticeAttemptDetail;
  spec: TaskSpec;
  hintsOpen: boolean;
  onOpenHints: () => void;
}) {
  return (
    <aside className="w-80 shrink-0 overflow-y-auto border-r border-rule bg-paper-deep px-6 py-8">
      <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-ink-faint">{spec.label}</p>
      <p className="mt-3 text-sm leading-relaxed">{attempt.prompt}</p>
      <p className="mt-4 font-mono text-[0.7rem] uppercase tracking-[0.15em] text-ink-faint">
        {spec.minWords}–{spec.maxWords} words · {spec.timeMinutes} min
      </p>

      <div className="mt-8 border-t border-rule pt-6">
        <button
          type="button"
          onClick={onOpenHints}
          className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-ink-soft hover:text-vermilion"
          aria-expanded={hintsOpen}
        >
          {hintsOpen ? "Hints" : "Show hints"}
        </button>
        {hintsOpen && (
          <div className="mt-4 space-y-5 text-sm">
            <div>
              <h3 className="font-mono text-[0.65rem] uppercase tracking-[0.15em] text-ink-faint">
                Ideas
              </h3>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-ink-soft">
                {attempt.ideas.map((idea) => (
                  <li key={idea}>{idea}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="font-mono text-[0.65rem] uppercase tracking-[0.15em] text-ink-faint">
                Vocabulary
              </h3>
              <ul className="mt-2 space-y-2">
                {attempt.vocabulary.map((item) => (
                  <li key={item.word}>
                    <span className="font-display">{item.word}</span>
                    <span className="text-ink-soft"> — {item.meaning}</span>
                    <span className="mt-0.5 block italic text-ink-faint">{item.example}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

function ResultView({ attempt, spec }: { attempt: PracticeAttemptDetail; spec: TaskSpec }) {
  const snapshot = attempt.styleSnapshot;

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-4 border-b border-rule px-6 py-3">
        <Link to="/practice" className="font-display text-lg font-semibold tracking-tight hover:text-vermilion">
          Practice
        </Link>
        <span className="font-mono text-[0.7rem] uppercase tracking-[0.15em] text-ink-faint">
          {spec.label}
        </span>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="w-[22rem] shrink-0 overflow-y-auto border-r border-rule bg-paper-deep px-6 py-8">
          {attempt.band !== null && (
            <div className="mb-8">
              <BandStamp band={attempt.band} />
            </div>
          )}

          {attempt.scores && attempt.feedback && (
            <CriteriaBars scores={attempt.scores} feedback={attempt.feedback} />
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

          {snapshot && (
            <div className="mt-8 border-t border-rule pt-6">
              <StyleProfile snapshot={snapshot} level={attempt.level} />
            </div>
          )}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <Editor
            key={`${attempt.id}-result`}
            mode="edit"
            readOnly
            savedResult={snapshot}
            initialEditorState={attempt.content}
            onChange={() => undefined}
            onAnalysis={() => undefined}
          />
        </div>
      </div>
    </div>
  );
}

function CenteredNote({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex h-screen items-center justify-center">
      <p className="text-ink-soft">{children}</p>
    </main>
  );
}
