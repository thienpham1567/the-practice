import { lazy } from "react";

/**
 * Mỗi trang là một chunk riêng: landing chỉ tải phần của nó, còn Lexical và các
 * phòng thi chỉ về khi người dùng thật sự mở tới.
 */
export const AuthPage = lazy(() =>
  import("./auth/AuthPage").then((m) => ({ default: m.AuthPage })),
);
export const DocumentsPage = lazy(() =>
  import("./pages/DocumentsPage").then((m) => ({ default: m.DocumentsPage })),
);
export const EditorPage = lazy(() =>
  import("./pages/EditorPage").then((m) => ({ default: m.EditorPage })),
);
export const PracticeAttemptPage = lazy(() =>
  import("./pages/PracticeAttemptPage").then((m) => ({ default: m.PracticeAttemptPage })),
);
export const PracticePage = lazy(() =>
  import("./pages/PracticePage").then((m) => ({ default: m.PracticePage })),
);
export const ProgressPage = lazy(() =>
  import("./pages/ProgressPage").then((m) => ({ default: m.ProgressPage })),
);
export const SpeakingAttemptPage = lazy(() =>
  import("./pages/SpeakingAttemptPage").then((m) => ({ default: m.SpeakingAttemptPage })),
);
export const SpeakingPage = lazy(() =>
  import("./pages/SpeakingPage").then((m) => ({ default: m.SpeakingPage })),
);
export const VocabPage = lazy(() =>
  import("./pages/VocabPage").then((m) => ({ default: m.VocabPage })),
);
