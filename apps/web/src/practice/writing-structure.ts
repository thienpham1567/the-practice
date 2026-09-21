import type { WritingTaskType } from "@writing-helper/practice";

/** TOEIC talking beats shown behind Show hints. Not IELTS Task 2 paragraphing. */
export function writingStructure(type: string): string[] {
  if (type === "email-request") {
    return ["Greeting", "Answer each request", "Close"];
  }
  if (type === "opinion-essay") {
    return ["Position", "Reasons", "Example", "Close"];
  }
  if (type === "picture-sentence") {
    return ["Look at the picture", "Write one sentence", "Use both given words"];
  }
  return [];
}

export function isPictureSentence(type: string): type is Extract<WritingTaskType, "picture-sentence"> {
  return type === "picture-sentence";
}
