const GSI_SRC = "https://accounts.google.com/gsi/client";

let loadPromise: Promise<void> | null = null;

export function loadGsi(): Promise<void> {
  if (typeof window !== "undefined" && window.google?.accounts?.id) {
    return Promise.resolve();
  }

  if (!loadPromise) {
    loadPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = GSI_SRC;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        loadPromise = null;
        script.remove();
        reject(new Error("Failed to load Google Sign-In"));
      };
      document.head.appendChild(script);
    });
  }

  return loadPromise;
}
