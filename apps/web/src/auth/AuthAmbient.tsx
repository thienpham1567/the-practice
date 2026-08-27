/**
 * Decorative editorial backdrop for AuthPage — ink wash, ruled paper, sparse marks.
 * Purely visual; never captures pointer or assistive focus.
 */
export function AuthAmbient() {
  return (
    <div
      className="pointer-events-none fixed inset-0 overflow-hidden"
      aria-hidden="true"
    >
      <div data-ambient="ink" className="auth-ambient-ink absolute inset-0" />
      <div data-ambient="rules" className="auth-ambient-rules absolute inset-0" />
      <div data-ambient="marks" className="auth-ambient-marks absolute inset-0">
        <span className="auth-ambient-mark auth-ambient-mark--pilcrow">¶</span>
        <span className="auth-ambient-mark auth-ambient-mark--dash">—</span>
        <span className="auth-ambient-mark auth-ambient-mark--stamp" />
      </div>
    </div>
  );
}
