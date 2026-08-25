/** Con dấu ¶ — mark của The Practice. currentColor để nhuộm vermilion hoặc rule. */
export function AppMark({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <g transform="rotate(-7 16 16)">
        <rect
          x="3.6"
          y="3.6"
          width="24.8"
          height="24.8"
          rx="1.5"
          stroke="currentColor"
          strokeWidth="1.55"
        />
        <rect
          x="6.3"
          y="6.3"
          width="19.4"
          height="19.4"
          rx="0.95"
          stroke="currentColor"
          strokeWidth="0.8"
        />
        {/* Pilcrow: tô trái + hai nét xuống, chừa giấy trong khung. */}
        <path
          fill="currentColor"
          d="M16.45 10.55a3.95 3.95 0 0 0 0 7.9V10.55Z"
        />
        <rect x="16.45" y="10.55" width="1.45" height="11.2" rx="0.2" fill="currentColor" />
        <rect x="18.45" y="10.55" width="1.45" height="11.2" rx="0.2" fill="currentColor" />
      </g>
    </svg>
  );
}
