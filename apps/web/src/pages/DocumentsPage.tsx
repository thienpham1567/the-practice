import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { gradeLabelFor } from "@writing-helper/analysis";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../api/auth-store";
import { apiFetch } from "../api/client";
import { deleteDocument, listDocuments } from "../api/documents";
import { Masthead } from "../folio/Masthead";
import { GradeStamp } from "../sidebar/GradeStamp";

export function DocumentsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, clearSession } = useAuthStore();

  const documents = useQuery({ queryKey: ["documents"], queryFn: listDocuments });

  const remove = useMutation({
    mutationFn: deleteDocument,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["documents"] }),
  });

  const signOut = async () => {
    await apiFetch<void>("/auth/logout", { method: "POST" }).catch(() => undefined);
    clearSession();
    void navigate("/");
  };

  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      <Masthead lockupTo="/practice">
        <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2 text-sm">
          <Link
            to="/"
            className="text-vermilion decoration-vermilion/40 underline-offset-4 hover:underline"
          >
            New draft
          </Link>
          <Link
            to="/practice"
            className="text-ink-faint decoration-vermilion/40 underline-offset-4 hover:text-vermilion hover:underline"
          >
            Practice
          </Link>
          {user && (
            <button
              type="button"
              onClick={() => void signOut()}
              className="text-ink-faint hover:text-vermilion"
            >
              Sign out
            </button>
          )}
        </div>
      </Masthead>
      <h1 className="animate-fade-up mt-8 font-display text-3xl font-semibold">Drafts</h1>

      {documents.isLoading && (
        <p className="animate-fade-up mt-8 font-mono text-xs uppercase tracking-[0.18em] text-ink-faint">
          Fetching your drafts…
        </p>
      )}

      {documents.isError && (
        <p className="animate-fade-up mt-8 text-ink-soft">
          Could not load your drafts.{" "}
          <Link to="/login" className="text-vermilion underline underline-offset-2">
            Sign in
          </Link>{" "}
          and try again.
        </p>
      )}

      {documents.data?.length === 0 && <EmptyState />}

      <ul className="divide-y divide-rule">
        {documents.data?.map((document, index) => (
          <li
            key={document.id}
            className="animate-fade-up group flex flex-wrap items-center gap-x-4 gap-y-2 py-4 transition-colors"
            style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
          >
            <Link to={`/doc/${document.id}`} className="min-w-0 flex-1">
              <span className="font-display text-lg transition-colors group-hover:text-vermilion">
                {document.title}
              </span>
              <span className="ml-3 font-mono text-[0.7rem] uppercase tracking-[0.15em] text-ink-faint">
                {new Date(document.updatedAt).toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </Link>

            {document.grade !== null && (
              <GradeStamp grade={document.grade} label={gradeLabelFor(document.grade)} size="sm" />
            )}

            <button
              type="button"
              onClick={() => remove.mutate(document.id)}
              className="font-mono text-[0.7rem] uppercase tracking-[0.15em] text-ink-faint opacity-0 transition-opacity hover:text-vermilion group-hover:opacity-100"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}

function EmptyState() {
  return (
    <div className="animate-fade-up mt-14 flex flex-col items-center text-center">
      <span className="font-display text-6xl leading-none text-rule">¶</span>
      <p className="mt-4 text-ink-soft">Nothing here yet.</p>
      <Link
        to="/"
        className="mt-1 text-vermilion decoration-vermilion/40 underline-offset-4 hover:underline"
      >
        Start writing
      </Link>
    </div>
  );
}
