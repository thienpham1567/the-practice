import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { deleteAttempt } from "../api/practice";
import { deleteSpeakingAttempt } from "../api/speaking";
import { ConfirmDialog } from "./ConfirmDialog";

const COPY = {
  paper: {
    trigger: "Delete this paper",
    title: "Delete this paper?",
    body: "This will permanently delete this paper and any revisions. This cannot be undone.",
  },
  talk: {
    trigger: "Delete this talk",
    title: "Delete this talk?",
    body: "This will permanently delete this talk and any re-recordings. This cannot be undone.",
  },
} as const;

export function AttemptDeleteControl({
  kind,
  attemptId,
  after = "stay",
}: {
  kind: "paper" | "talk";
  attemptId: string;
  after?: "stay" | "list";
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const copy = COPY[kind];

  const remove = useMutation({
    mutationFn: () =>
      kind === "paper" ? deleteAttempt(attemptId) : deleteSpeakingAttempt(attemptId),
    onSuccess: async () => {
      setOpen(false);
      await queryClient.invalidateQueries({
        queryKey: kind === "paper" ? ["practice-attempts"] : ["speaking-attempts"],
      });
      await queryClient.invalidateQueries({ queryKey: ["practice-progress"] });
      if (after === "list") {
        navigate(kind === "paper" ? "/practice" : "/speaking");
      }
    },
  });

  return (
    <>
      <button
        type="button"
        aria-label={copy.trigger}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen(true);
        }}
        className="shrink-0 font-mono text-[0.65rem] uppercase tracking-[0.15em] text-ink-faint hover:text-vermilion sm:text-[0.7rem]"
      >
        Delete
      </button>
      <ConfirmDialog
        open={open}
        title={copy.title}
        body={copy.body}
        pending={remove.isPending}
        error={remove.isError}
        onCancel={() => {
          if (!remove.isPending) {
            setOpen(false);
            remove.reset();
          }
        }}
        onConfirm={() => remove.mutate()}
      />
    </>
  );
}
