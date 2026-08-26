import type { SerializedEditorState } from "lexical";
import { apiFetch, apiJson } from "./client";

export interface DocumentSummary {
  id: string;
  title: string;
  grade: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentDetail extends DocumentSummary {
  content: SerializedEditorState;
  plainText: string;
}

export interface DocumentInput {
  title?: string;
  content?: SerializedEditorState;
  plainText?: string;
  grade?: number;
}

export const listDocuments = async () => {
  const page = await apiFetch<{ items: DocumentSummary[]; nextCursor: string | null }>(
    "/documents",
  );
  return page.items;
};

export const getDocument = (id: string) => apiFetch<DocumentDetail>(`/documents/${id}`);

export const createDocument = (input: DocumentInput) =>
  apiJson<DocumentDetail>("/documents", "POST", input);

export const updateDocument = (id: string, input: DocumentInput) =>
  apiJson<DocumentDetail>(`/documents/${id}`, "PATCH", input);

export const deleteDocument = (id: string) =>
  apiFetch<void>(`/documents/${id}`, { method: "DELETE" });
