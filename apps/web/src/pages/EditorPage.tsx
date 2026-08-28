import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AnalysisResult } from "@writing-helper/analysis";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuthStore } from "../api/auth-store";
import { createDocument, getDocument, updateDocument, type DocumentInput } from "../api/documents";
import { BrandLockup } from "../BrandLockup";
import { PageAtmosphere } from "../folio/PageAtmosphere";
import { Editor, type EditorChange, type EditorMode } from "../editor/Editor";
import { SidePanel } from "../SidePanel";
import { analysisIssueCount, Sidebar } from "../sidebar/Sidebar";
import { stashDraft, takeStashedDraft } from "./draft-stash";

const AUTOSAVE_DELAY_MS = 2000;

type SaveStatus = "idle" | "saving" | "saved";

export function EditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const signedIn = useAuthStore((state) => state.accessToken !== null);

  // Bản nháp giữ lại từ lần bị chuyển sang trang đăng nhập, nếu có.
  const [restored] = useState(() => (id ? null : takeStashedDraft()));

  const [mode, setMode] = useState<EditorMode>("edit");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [title, setTitle] = useState(restored?.title ?? "Untitled");
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [panelOpen, setPanelOpen] = useState(false);

  const draftRef = useRef<EditorChange | null>(null);
  const gradeRef = useRef<number | undefined>(undefined);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const panelTriggerRef = useRef<HTMLButtonElement>(null);

  const document = useQuery({
    queryKey: ["document", id],
    queryFn: () => getDocument(id!),
    enabled: Boolean(id),
  });

  useEffect(() => {
    if (document.data) setTitle(document.data.title);
  }, [document.data]);

  const save = useMutation({
    mutationFn: (input: DocumentInput) =>
      id ? updateDocument(id, input) : createDocument(input),
    onMutate: () => setStatus("saving"),
    onSuccess: (saved) => {
      setStatus("saved");
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
      if (!id) void navigate(`/doc/${saved.id}`, { replace: true });
    },
    onError: () => setStatus("idle"),
  });

  const currentInput = useCallback(
    (): DocumentInput => ({
      title,
      ...(draftRef.current
        ? { content: draftRef.current.editorState, plainText: draftRef.current.plainText }
        : {}),
      ...(gradeRef.current === undefined ? {} : { grade: gradeRef.current }),
    }),
    [title],
  );

  const handleChange = useCallback(
    (change: EditorChange) => {
      draftRef.current = change;
      if (!id) return;

      // Chỉ document đã lưu mới autosave; bản nháp mới chờ người dùng bấm Save.
      clearTimeout(autosaveTimer.current);
      autosaveTimer.current = setTimeout(() => save.mutate(currentInput()), AUTOSAVE_DELAY_MS);
    },
    [id, save, currentInput],
  );

  const handleAnalysis = useCallback((analysis: AnalysisResult | null) => {
    setResult(analysis);
    if (analysis) gradeRef.current = analysis.grade;
  }, []);

  useEffect(() => () => clearTimeout(autosaveTimer.current), []);

  if (id && document.isLoading) {
    return <CenteredNote>Opening the draft…</CenteredNote>;
  }

  if (id && document.isError) {
    return <CenteredNote>That draft is not here. It may have been deleted.</CenteredNote>;
  }

  const analysis = mode === "edit" ? result : null;
  const issueCount = analysisIssueCount(analysis);
  const panelLabel =
    issueCount > 0 ? `${issueCount} ${issueCount === 1 ? "issue" : "issues"}` : "Analysis";

  return (
    <div className="flex h-screen flex-col">
      <PageAtmosphere kind="manuscript" />
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-rule px-3 py-3 sm:gap-x-4 sm:px-6">
        <BrandLockup to={signedIn ? "/practice" : "/"} size="sm" />
        <Link
          to="/practice"
          className="font-mono text-[0.65rem] uppercase tracking-[0.15em] text-ink-faint hover:text-vermilion sm:text-[0.7rem]"
        >
          Practice
        </Link>

        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          aria-label="Document title"
          className="min-w-[8rem] flex-1 basis-40 border-b border-transparent bg-transparent px-1 py-0.5 text-ink-soft outline-none transition-colors hover:border-rule focus:border-vermilion focus:text-ink"
        />

        <SaveState status={status} />

        <div className="flex border border-rule">
          {(["write", "edit"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setMode(option)}
              className={`px-2 py-1 font-mono text-[0.65rem] uppercase tracking-[0.15em] transition-colors sm:px-3 sm:text-[0.7rem] ${
                mode === option ? "bg-ink text-paper" : "text-ink-soft hover:text-vermilion"
              }`}
            >
              {option}
            </button>
          ))}
        </div>

        <button
          ref={panelTriggerRef}
          type="button"
          onClick={() => setPanelOpen((current) => !current)}
          aria-expanded={panelOpen}
          className="font-mono text-[0.65rem] uppercase tracking-[0.15em] text-ink-soft hover:text-vermilion sm:text-[0.7rem] lg:hidden"
        >
          {panelLabel}
        </button>

        {!id && (
          <button
            type="button"
            onClick={() => {
              if (!signedIn) {
                if (draftRef.current) {
                  stashDraft({ title, content: draftRef.current.editorState });
                }
                void navigate("/login");
                return;
              }
              save.mutate(currentInput());
            }}
            className="bg-ink px-3 py-1.5 font-mono text-[0.65rem] uppercase tracking-[0.15em] text-paper transition-colors hover:bg-vermilion sm:px-4 sm:text-[0.7rem]"
          >
            Save
          </button>
        )}
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <Editor
            key={id ?? "new"}
            mode={mode}
            initialEditorState={document.data?.content ?? restored?.content ?? null}
            onChange={handleChange}
            onAnalysis={handleAnalysis}
          />
        </div>

        <SidePanel
          open={panelOpen}
          onOpenChange={setPanelOpen}
          title="Analysis"
          triggerLabel={panelLabel}
          triggerRef={panelTriggerRef}
          side="right"
          className="w-80"
        >
          <Sidebar result={analysis} />
        </SidePanel>
      </div>
    </div>
  );
}

function SaveState({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;

  return (
    <span className="font-mono text-[0.7rem] uppercase tracking-[0.15em] text-ink-faint">
      {status === "saving" ? "Saving…" : "Saved"}
    </span>
  );
}

function CenteredNote({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex h-screen items-center justify-center">
      <p className="text-ink-soft">{children}</p>
    </main>
  );
}
