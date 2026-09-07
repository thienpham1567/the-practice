import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { gradeLabelFor } from "@writing-helper/analysis";
import { Link } from "react-router-dom";
import { deleteDocument, listDocuments } from "../api/documents";
import { FolioEmpty } from "../folio/FolioEmpty";
import { FolioNav } from "../folio/FolioNav";
import { FolioSkeleton } from "../folio/FolioSkeleton";
import { Masthead } from "../folio/Masthead";
import { PageAtmosphere } from "../folio/PageAtmosphere";
import { GradeStamp } from "../sidebar/GradeStamp";

export function DocumentsPage() {
  const queryClient = useQueryClient();

  const documents = useQuery({ queryKey: ["documents"], queryFn: listDocuments });

  const remove = useMutation({
    mutationFn: deleteDocument,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["documents"] }),
  });


  return (
    <main className="relative mx-auto min-h-[100dvh] max-w-3xl px-6 py-14">
      <PageAtmosphere kind="drafts" />
      <Masthead lockupTo="/practice">
        <FolioNav current="/docs" />
      </Masthead>
      <h1 className="animate-fade-up mt-8 font-display text-3xl font-semibold">Drafts</h1>

      {documents.isLoading && <FolioSkeleton label="Fetching your drafts" />}

      {documents.isError && (
        <p className="animate-fade-up mt-8 text-ink-soft">
          Could not load your drafts.{" "}
          <Link to="/login" className="text-vermilion underline underline-offset-2">
            Sign in
          </Link>{" "}
          and try again.
        </p>
      )}

      {documents.data?.length === 0 && (
        <FolioEmpty
          message="Nothing here yet."
          actions={[{ to: "/", label: "Start writing" }]}
        />
      )}

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
