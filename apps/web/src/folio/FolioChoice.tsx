interface FolioChoiceOption<T extends string> {
  id: T;
  label: string;
}

interface FolioChoiceProps<T extends string> {
  label: string;
  value: T;
  options: readonly FolioChoiceOption<T>[];
  onChange: (id: T) => void;
}

/** Single-select strip: ink fill for the current choice, vermilion on hover. */
export function FolioChoice<T extends string>({
  label,
  value,
  options,
  onChange,
}: FolioChoiceProps<T>) {
  return (
    <div className="flex border border-rule" role="group" aria-label={label}>
      {options.map((option) => {
        const selected = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.id)}
            className={`flex-1 py-2 font-mono text-[0.75rem] uppercase tracking-[0.15em] transition-colors ${
              selected ? "bg-ink text-paper" : "text-ink-soft hover:text-vermilion"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
