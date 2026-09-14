/**
 * Nút sinh bài mẫu ẩn đi ngay khi đã có kết quả — sinh một lần, không tái
 * sinh (khớp API: bấm lại chỉ trả về bài đã lưu, không gọi AI thêm).
 */
export function SampleEssays({
  sampleEssays,
  onGenerate,
  isPending,
}: {
  sampleEssays: string[] | null;
  onGenerate: () => void;
  isPending: boolean;
}) {
  return (
    <section className="mt-8 border-t border-rule pt-6">
      <h2 className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-ink-faint">
        Model answers
      </h2>
      {sampleEssays ? (
        <div className="mt-4 space-y-8">
          {sampleEssays.map((essay, index) => (
            <div key={index}>
              <h3 className="font-mono text-[0.65rem] uppercase tracking-[0.15em] text-ink-faint">
                Model answer {index + 1}
              </h3>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{essay}</p>
            </div>
          ))}
        </div>
      ) : (
        <button
          type="button"
          onClick={onGenerate}
          disabled={isPending}
          className="mt-3 bg-ink px-3 py-1.5 font-mono text-[0.65rem] uppercase tracking-[0.15em] text-paper transition-colors hover:bg-vermilion disabled:opacity-60 sm:px-4 sm:text-[0.7rem]"
        >
          {isPending ? "Generating…" : "See model answers"}
        </button>
      )}
    </section>
  );
}
