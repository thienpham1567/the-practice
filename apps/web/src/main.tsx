import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { AppErrorBoundary } from "./folio/AppErrorBoundary";
import { startSentry } from "./sentry";
import "./index.css";

// Bắt lỗi ngay từ đầu; SDK thật nạp sau khi trang hiện — xem sentry.ts.
startSentry();

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>,
);
