import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../api/auth-store";
import { apiFetch } from "../api/client";
import { deleteDocument, listDocuments } from "../api/documents";

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
      <header className="flex items-baseline justify-between border-b border-rule pb-5">
        <h1 className="font-display text-3xl font-semibold">Drafts</h1>

        <div className="flex items-center gap-4 text-sm">
          <Link to="/" className="text-vermilion underline underline-offset-2">
            New draft
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
      </header>

      {documents.isLoading && <p className="mt-8 text-ink-soft">Fetching your drafts…</p>}

      {documents.isError && (
        <p className="mt-8 text-ink-soft">
          Could not load your drafts.{" "}
          <Link to="/login" className="text-vermilion underline underline-offset-2">
            Sign in
          </Link>{" "}
          and try again.
        </p>
      )}

      {documents.data?.length === 0 && (
        <p className="mt-8 text-ink-soft">
          Nothing here yet.{" "}
          <Link to="/" className="text-vermilion underline underline-offset-2">
            Start writing
          </Link>
          .
        </p>
      )}

      <ul className="divide-y divide-rule">
        {documents.data?.map((document) => (
          <li key={document.id} className="group flex items-baseline gap-4 py-4">
            <Link to={`/doc/${document.id}`} className="min-w-0 flex-1">
              <span className="font-display text-lg group-hover:text-vermilion">
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
              <span className="font-mono text-[0.7rem] uppercase tracking-[0.15em] text-ink-faint">
                Grade {document.grade}
              </span>
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
