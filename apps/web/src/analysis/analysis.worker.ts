import { analyze } from "@writing-helper/analysis";

interface AnalyzeRequest {
  id: number;
  text: string;
}

self.onmessage = (event: MessageEvent<AnalyzeRequest>) => {
  const { id, text } = event.data;
  self.postMessage({ id, result: analyze(text) });
};
