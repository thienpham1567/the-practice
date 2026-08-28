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
  folio: (
    <>
      <span className="page-atm-kicker page-atm-kicker--folio">Vol. I</span>
      <span className="page-atm-glyph page-atm-glyph--pilcrow">¶</span>
    </>
  ),
  manuscript: (
    <>
      <span className="page-atm-spine">Galley</span>
      <span className="page-atm-glyph page-atm-glyph--caret">^</span>
    </>
  ),
  drafts: (
    <>
      <span className="page-atm-sheet page-atm-sheet--a" />
      <span className="page-atm-sheet page-atm-sheet--b" />
      <span className="page-atm-sheet page-atm-sheet--c" />
    </>
  ),
  practice: (
    <>
      <span className="page-atm-spine">Script</span>
      <span className="page-atm-glyph page-atm-glyph--box">Task</span>
    </>
  ),
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
  speaking: (
    <>
      <span className="page-atm-rings" />
      <span className="page-atm-glyph page-atm-glyph--quote">“</span>
    </>
  ),
  talk: (
    <>
      <span className="page-atm-rings page-atm-rings--booth" />
    </>
  ),
  progress: (
    <svg className="page-atm-chart" viewBox="0 0 100 36" preserveAspectRatio="none">
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="0.6"
        points="0,30 14,27 28,22 42,24 56,16 70,18 86,10 100,8"
      />
    </svg>
  ),
  vocab: <span className="page-atm-index">ABCDEFGHIJKLMNOPQRSTUVWXYZ</span>,
};
