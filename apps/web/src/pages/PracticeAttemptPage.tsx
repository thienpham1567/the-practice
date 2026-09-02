import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { analyze } from "@writing-helper/analysis";
import { MARK_LABELS, TASK_CATALOG, type MarkCategory, type TaskSpec } from "@writing-helper/practice";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { BrandLockup } from "../BrandLockup";
import {
  getAttempt,
  getMistakeProfile,
  reviseAttempt,
  submitAttempt,
  updateAttempt,
  type PracticeAttemptDetail,
} from "../api/practice";
import { Editor, type EditorChange } from "../editor/Editor";
import { BandStamp } from "../practice/BandStamp";
import { AttemptDeleteControl } from "../folio/AttemptDeleteControl";
import { PageAtmosphere } from "../folio/PageAtmosphere";
import { CriteriaBars } from "../practice/CriteriaBars";
import {
  countWords,
  formatClock,
  remainingSeconds,
  wordCountTone,
} from "../practice/exam-math";
import { FeedbackAuditList } from "../practice/FeedbackAuditList";
import { FixTheseFirst } from "../practice/FixTheseFirst";
import { promptBody } from "../practice/prompt-body";
import { formatBandDelta, reviseAction } from "../practice/revise-availability";
import { StyleProfile } from "../practice/StyleProfile";
import { SidePanel } from "../SidePanel";

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

  if (attempt.data.submittedAt) {
    return <ResultView attempt={attempt.data} spec={spec} />;
  }

  if (!spec) {
    return <CenteredNote>This task type is no longer in the catalog.</CenteredNote>;
  }

  return <ExamRoom attempt={attempt.data} spec={spec} />;
}

function ExamRoom({ attempt, spec }: { attempt: PracticeAttemptDetail; spec: TaskSpec }) {
  const queryClient = useQueryClient();
  const isRevision = attempt.revisionRound > 0 || Boolean(attempt.parentAttemptId);
  const [hintsOpen, setHintsOpen] = useState(attempt.hintsOpened);
  const [wordCount, setWordCount] = useState(attempt.wordCount);
  const [remaining, setRemaining] = useState(() =>
    isRevision ? 0 : remainingSeconds(new Date(attempt.startedAt), spec.timeMinutes),
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  // Chữ đang có trong editor, để đối chiếu với bài gốc — xem `carriedMarks`.
  const [liveText, setLiveText] = useState(attempt.plainText);

  const draftRef = useRef<EditorChange | null>(null);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const promptTriggerRef = useRef<HTMLButtonElement>(null);

  const parent = useQuery({
    queryKey: ["practice-attempt", attempt.parentAttemptId],
    queryFn: () => getAttempt(attempt.parentAttemptId!),
    enabled: Boolean(attempt.parentAttemptId),
  });

  const mistakes = useQuery({ queryKey: ["practice-mistakes"], queryFn: getMistakeProfile });

  const save = useMutation({
    mutationFn: (input: Parameters<typeof updateAttempt>[1]) => updateAttempt(attempt.id, input),
  });

  useEffect(() => {
    if (isRevision) return;
    const tick = () =>
      setRemaining(remainingSeconds(new Date(attempt.startedAt), spec.timeMinutes));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [attempt.startedAt, isRevision, spec.timeMinutes]);

  useEffect(() => () => clearTimeout(autosaveTimer.current), []);

  const handleChange = useCallback(
    (change: EditorChange) => {
      draftRef.current = change;
      setLiveText(change.plainText);
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
  const timedOut = !isRevision && remaining === 0;

  /*
    Mark của bài gốc là offset trên *chữ của bài gốc*. Còn nguyên chữ đó thì
    gạch đúng chỗ; gõ một phím là mọi offset phía sau lệch, và cái thẻ lỗi mở
    ra sẽ nói về một đoạn không liên quan. Nên chỉ hiện khi hai bài còn giống
    hệt nhau — kể cả lúc mở lại bản nháp đã sửa dở từ phiên trước.
  */
  const parentPaper = parent.data;
  const carriedMarks =
    isRevision && parentPaper && liveText === parentPaper.plainText
      ? (parentPaper.marks ?? null)
      : null;

  return (
    <div className="flex h-screen flex-col">
      <PageAtmosphere kind="exam" />
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-rule px-3 py-3 sm:gap-x-4 sm:px-6">
        <BrandLockup to="/practice" size="sm" />
        {isRevision ? (
          <span className="font-mono text-[0.65rem] uppercase tracking-[0.15em] text-vermilion sm:text-[0.7rem]">
            Revision {attempt.revisionRound}/2
          </span>
        ) : (
          <span
            className={`font-mono text-sm tabular-nums ${timedOut ? "text-vermilion" : "text-ink"}`}
            aria-label="Time remaining"
          >
            {formatClock(remaining)}
          </span>
        )}
        <span
          className={`font-mono text-[0.65rem] uppercase tracking-[0.15em] sm:text-[0.7rem] ${
            tone === "under" ? "text-vermilion" : "text-ink-soft"
          }`}
        >
          {wordCount}/{spec.minWords}–{spec.maxWords}
          <span className="hidden sm:inline"> words</span>
        </span>
        <button
          ref={promptTriggerRef}
          type="button"
          onClick={() => setPromptOpen((current) => !current)}
          aria-expanded={promptOpen}
          className="font-mono text-[0.65rem] uppercase tracking-[0.15em] text-ink-soft hover:text-vermilion sm:text-[0.7rem] lg:hidden"
        >
          Prompt
        </button>
        <span className="ml-auto font-mono text-[0.65rem] uppercase tracking-[0.15em] text-ink-faint sm:text-[0.7rem]">
          {save.isPending ? "Saving…" : save.isSuccess ? "Saved" : null}
        </span>
        <AttemptDeleteControl kind="paper" attemptId={attempt.id} after="list" />
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={submitting}
          className="bg-ink px-3 py-1.5 font-mono text-[0.65rem] uppercase tracking-[0.15em] text-paper transition-colors hover:bg-vermilion disabled:opacity-60 sm:px-4 sm:text-[0.7rem]"
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
        <SidePanel
          open={promptOpen}
          onOpenChange={setPromptOpen}
          title="Prompt"
          triggerLabel="Prompt"
          triggerRef={promptTriggerRef}
          side="left"
          className="w-96"
        >
          <PromptPane
            attempt={attempt}
            spec={spec}
            hintsOpen={hintsOpen}
            onOpenHints={openHints}
            parentFeedback={parent.data?.feedback ?? null}
            watchFor={(mistakes.data?.tallies ?? []).slice(0, 3).map((tally) => tally.category)}
          />
        </SidePanel>
        <div className="flex min-w-0 flex-1 flex-col">
          {/*
            Bản sửa nạp luôn mark của bài gốc: không có thì người học phải nhớ
            lỗi từ màn kết quả rồi lật qua lại giữa hai trang.
          */}
          <Editor
            key={attempt.id}
            mode="write"
            initialEditorState={attempt.content}
            savedMarks={carriedMarks}
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
  parentFeedback,
  watchFor,
}: {
  attempt: PracticeAttemptDetail;
  spec: TaskSpec;
  hintsOpen: boolean;
  onOpenHints: () => void;
  parentFeedback: PracticeAttemptDetail["feedback"];
  watchFor: MarkCategory[];
}) {
  const feedbackPoints = parentFeedback
    ? [
        parentFeedback.taskResponse,
        parentFeedback.coherenceCohesion,
        parentFeedback.lexicalResource,
        parentFeedback.grammaticalRange,
        parentFeedback.overview,
        parentFeedback.nextFocus,
      ].filter(Boolean)
    : [];

  return (
    <div className="prompt-scroll px-6 py-8">
      <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-ink-faint">{spec.label}</p>
      <p className="mt-3 text-sm leading-relaxed">{promptBody(attempt.prompt, spec.instruction)}</p>
      <p className="mt-3 text-sm italic leading-relaxed text-ink-soft">{spec.instruction}</p>
      <p className="mt-4 font-mono text-[0.7rem] uppercase tracking-[0.15em] text-ink-faint">
        {spec.minWords}–{spec.maxWords} words · {spec.timeMinutes} min
      </p>

      {feedbackPoints.length > 0 && (
        <div className="mt-8 border-t border-rule pt-6">
          <h2 className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-vermilion">
            Previous feedback
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-4 text-sm leading-relaxed text-ink-soft">
            {feedbackPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </div>
      )}

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
                    {item.review && (
                      <span className="ml-2 inline-block border border-vermilion px-1.5 py-px font-mono text-[0.6rem] uppercase tracking-[0.12em] text-vermilion">
                        review
                      </span>
                    )}
                    <span className="text-ink-soft"> — {item.meaning}</span>
                    <span className="mt-0.5 block italic text-ink-faint">{item.example}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {watchFor.length > 0 && (
        <p className="mt-8 border-t border-rule pt-6 font-mono text-[0.7rem] uppercase tracking-[0.15em] text-ink-faint">
          Watch for: {watchFor.map((category) => MARK_LABELS[category]).join(", ")}
        </p>
      )}
    </div>
  );
}

function ResultView({
  attempt,
  spec,
}: {
  attempt: PracticeAttemptDetail;
  spec?: TaskSpec;
}) {
  const navigate = useNavigate();
  const snapshot = attempt.styleSnapshot;
  // Mặc định lăng kính lỗi — đó là thứ người học sửa được ngay. Bóc lỗi hỏng
  // (`marks === null`) thì không có gì để xem ở đó, lùi về Style.
  const [lens, setLens] = useState<"mistakes" | "style">(
    attempt.marks ? "mistakes" : "style",
  );
  const [scoresOpen, setScoresOpen] = useState(true);
  const scoresTriggerRef = useRef<HTMLButtonElement>(null);
  const action = reviseAction({
    band: attempt.band,
    submittedAt: attempt.submittedAt,
    revisionRound: attempt.revisionRound,
    hasRevision: attempt.hasRevision,
    pendingRevisionId: attempt.pendingRevisionId,
  });

  const revise = useMutation({
    mutationFn: () => reviseAttempt(attempt.id),
    onSuccess: (created) => {
      navigate(`/practice/${created.id}`);
    },
  });

  return (
    <div className="flex h-screen flex-col">
      <PageAtmosphere kind="result" />
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-rule px-3 py-3 sm:gap-x-4 sm:px-6">
        <BrandLockup to="/practice" size="sm" />
        <span className="min-w-0 truncate font-mono text-[0.65rem] uppercase tracking-[0.15em] text-ink-faint sm:text-[0.7rem]">
          {spec?.label ?? attempt.taskType}
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
        <span className="ml-auto" />
        <AttemptDeleteControl kind="paper" attemptId={attempt.id} after="list" />
        {action.kind === "revise" && (
          <button
            type="button"
            onClick={() => revise.mutate()}
            disabled={revise.isPending}
            className="bg-ink px-3 py-1.5 font-mono text-[0.65rem] uppercase tracking-[0.15em] text-paper transition-colors hover:bg-vermilion disabled:opacity-60 sm:px-4 sm:text-[0.7rem]"
          >
            Revise this paper
          </button>
        )}
        {action.kind === "resume" && (
          <button
            type="button"
            onClick={() => navigate(`/practice/${action.attemptId}`)}
            className="bg-ink px-3 py-1.5 font-mono text-[0.65rem] uppercase tracking-[0.15em] text-paper transition-colors hover:bg-vermilion sm:px-4 sm:text-[0.7rem]"
          >
            Resume revision
          </button>
        )}
        {attempt.marks && (
          <div className="flex border border-rule font-mono text-[0.65rem] uppercase tracking-[0.15em]">
            {(["mistakes", "style"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setLens(option)}
                aria-pressed={lens === option}
                className={`px-3 py-1 ${
                  lens === option ? "bg-ink text-paper" : "text-ink-soft hover:text-vermilion"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
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

            {attempt.feedbackAudit && attempt.feedbackAudit.length > 0 && (
              <section className="mb-8 border-t border-rule pt-6">
                <h2 className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-ink-faint">
                  Feedback audit
                </h2>
                <FeedbackAuditList items={attempt.feedbackAudit} />
              </section>
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

            <FixTheseFirst marks={attempt.marks} />

            {snapshot && (
              <div className="mt-8 border-t border-rule pt-6">
                <StyleProfile snapshot={snapshot} level={attempt.level} />
              </div>
            )}
          </div>
        </SidePanel>

        <div className="flex min-w-0 flex-1 flex-col">
          {/*
            Hai lăng kính loại trừ nhau: vẽ cả gạch lỗi lẫn nền văn phong lên
            cùng một bài thì vừa rối vừa mâu thuẫn — Hemingway thưởng câu ngắn,
            IELTS thưởng câu phức.
          */}
          <Editor
            key={`${attempt.id}-result-${lens}`}
            mode="edit"
            readOnly
            savedResult={lens === "style" ? snapshot : null}
            savedMarks={lens === "mistakes" ? attempt.marks : null}
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
