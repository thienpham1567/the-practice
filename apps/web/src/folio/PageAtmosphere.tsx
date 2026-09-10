import type { ReactNode } from "react";

export type AtmosphereKind =
  | "folio"
  | "manuscript"
  | "drafts"
  | "practice"
  | "exam"
  | "result"
  | "speaking"
  | "talk"
  | "progress"
  | "vocab";

/**
 * Per-page editorial backdrop. Decorative only — never captures pointer or AT focus.
 * Each kind is a different object on the writer's desk (script, booth, ledger…).
 */
export function PageAtmosphere({ kind }: { kind: AtmosphereKind }) {
  return (
    <div
      className="pointer-events-none fixed inset-0 overflow-hidden"
      aria-hidden="true"
      data-atmosphere={kind}
    >
      <div className={`page-atm page-atm--${kind}`} />
      <div className="page-atm-marks">{MARKS[kind]}</div>
    </div>
  );
}

const MARKS: Record<AtmosphereKind, ReactNode> = {
  folio: null,
  manuscript: null,
  drafts: (
    <>
      <span className="page-atm-sheet page-atm-sheet--a" />
      <span className="page-atm-sheet page-atm-sheet--b" />
      <span className="page-atm-sheet page-atm-sheet--c" />
    </>
  ),
  practice: null,
  exam: (
    <>
      <span className="page-atm-crop page-atm-crop--tl" />
      <span className="page-atm-crop page-atm-crop--tr" />
      <span className="page-atm-crop page-atm-crop--bl" />
      <span className="page-atm-crop page-atm-crop--br" />
    </>
  ),
  result: (
    <>
      <span className="page-atm-stamp" />
      <span className="page-atm-glyph page-atm-glyph--caret">^</span>
      <span className="page-atm-glyph page-atm-glyph--caret page-atm-glyph--caret-b">^</span>
    </>
  ),
  speaking: null,
  talk: (
    <>
      <span className="page-atm-rings page-atm-rings--booth" />
    </>
  ),
  progress: null,
  vocab: null,
};
