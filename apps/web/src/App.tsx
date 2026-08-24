import { analyze } from "@writing-helper/analysis";

/** Scaffold placeholder — editor thật được xây ở milestone 4. */
export function App() {
  const result = analyze("The cat sat on the mat.");

  return (
    <main className="mx-auto max-w-2xl p-12">
      <h1 className="text-3xl">Writing Helper</h1>
      <p className="mt-4 text-sm">
        Scaffold đang chạy. Analysis package đã kết nối:{" "}
        <code>grade {result.grade}</code>, <code>{result.highlights.length} highlights</code>.
      </p>
    </main>
  );
}
