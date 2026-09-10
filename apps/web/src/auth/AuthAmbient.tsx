/**
 * Photographic desk plate behind login/register — day/night via theme.
 * Decorative only; never captures pointer or assistive focus.
 */
export function AuthAmbient() {
  return (
    <div
      className="auth-ambient pointer-events-none fixed inset-0 overflow-hidden"
      aria-hidden="true"
      data-ambient="desk"
    />
  );
}
