import { Link } from "react-router-dom";

interface FolioEmptyProps {
  message: string;
  actions?: readonly { to: string; label: string }[];
}

/** Composed empty sheet: pilcrow, one sentence, optional way forward. */
export function FolioEmpty({ message, actions }: FolioEmptyProps) {
  return (
    <div className="animate-fade-up mt-14 flex flex-col items-center text-center">
      <span aria-hidden="true" className="font-display text-6xl leading-none text-rule">
        ¶
      </span>
      <p className="mt-4 max-w-[40ch] text-ink-soft">{message}</p>
      {actions && actions.length > 0 ? (
        <div className="mt-1 flex flex-wrap justify-center gap-x-4 gap-y-1">
          {actions.map((action) => (
            <Link
              key={action.to}
              to={action.to}
              className="text-vermilion decoration-vermilion/40 underline-offset-4 hover:underline"
            >
              {action.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
