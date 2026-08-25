import type { EditorThemeClasses } from "lexical";

/** Kiểu chữ của bản thảo: serif, dòng thưa, đo chữ hẹp cho dễ đọc. */
export const editorTheme: EditorThemeClasses = {
  paragraph: "mb-5 leading-[1.75]",
  heading: {
    h1: "font-display text-4xl font-semibold mb-6 mt-2 leading-tight",
    h2: "font-display text-2xl font-semibold mb-4 mt-8 leading-tight",
    h3: "font-display text-xl font-semibold mb-3 mt-6 leading-snug",
  },
  quote: "border-l-2 border-vermilion pl-5 my-6 italic text-ink-soft",
  list: {
    ul: "list-disc pl-6 mb-5 space-y-1",
    ol: "list-decimal pl-6 mb-5 space-y-1",
    listitem: "leading-[1.75]",
  },
  link: "text-vermilion underline underline-offset-2",
  text: {
    bold: "font-semibold",
    italic: "italic",
    underline: "underline underline-offset-2",
  },
};
