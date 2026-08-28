import { useCallback, useEffect, useRef, useState } from "react";

/** Hard stop for IELTS Part 2 long turn. */
export const MAX_RECORDING_MS = 120_000;

export type RecorderState = "idle" | "recording" | "done" | "error";

export type UseRecorderResult = {
  state: RecorderState;
  /** Collected mono Float32 PCM (empty until done / while recording grows). */
  pcm: Float32Array;
  sampleRate: number;
  /** Elapsed recording time in ms. */
  durationMs: number;
  /** Live peak |sample| in [0, 1] while recording. */
  level: number;
  errorMessage: string | null;
  start: () => Promise<void>;
  stop: () => void;
  /** Clear buffers and return to idle (keeps no audio). */
  reset: () => void;
};

type AudioContextCtor = typeof AudioContext;

function audioContextCtor(): AudioContextCtor | null {
  if (typeof window === "undefined") return null;
  return (
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext ??
    null
  );
}

/** Feature-detect mic + Web Audio before entering the Record phase. */
export function recordingSupported(): boolean {
  const media = typeof navigator !== "undefined" ? navigator.mediaDevices : undefined;
  return Boolean(media?.getUserMedia) && audioContextCtor() != null;
}

/**
 * Capture mic audio as Float32 PCM via ScriptProcessorNode.
 * Auto-stops at {@link MAX_RECORDING_MS}. Does not encode — callers use wav-encode.
 */
export function useRecorder(): UseRecorderResult {
  const [state, setState] = useState<RecorderState>("idle");
  const [pcm, setPcm] = useState(() => new Float32Array(0));
  const [sampleRate, setSampleRate] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [level, setLevel] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const chunksRef = useRef<Float32Array[]>([]);
  const lengthRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const startedAtRef = useRef(0);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stoppingRef = useRef(false);

  const clearTimers = () => {
    if (maxTimerRef.current != null) {
      clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
    if (tickTimerRef.current != null) {
      clearInterval(tickTimerRef.current);
      tickTimerRef.current = null;
    }
  };

  const teardownGraph = useCallback(() => {
    clearTimers();
    try {
      processorRef.current?.disconnect();
    } catch {
      /* already disconnected */
    }
    try {
      sourceRef.current?.disconnect();
    } catch {
      /* already disconnected */
    }
    processorRef.current = null;
    sourceRef.current = null;

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    const ctx = contextRef.current;
    contextRef.current = null;
    if (ctx && ctx.state !== "closed") {
      void ctx.close().catch(() => undefined);
    }
  }, []);

  const flattenChunks = (): Float32Array => {
    const total = lengthRef.current;
    const out = new Float32Array(total);
    let offset = 0;
    for (const chunk of chunksRef.current) {
      out.set(chunk, offset);
      offset += chunk.length;
    }
    return out;
  };

  const finish = useCallback(() => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    clearTimers();

    const elapsed = Math.max(0, Date.now() - startedAtRef.current);
    const flat = flattenChunks();
    teardownGraph();
    setPcm(flat);
    setDurationMs(elapsed);
    setLevel(0);
    setState("done");
  }, [teardownGraph]);

  const stop = useCallback(() => {
    if (startedAtRef.current === 0) return;
    finish();
  }, [finish]);

  const start = useCallback(async () => {
    if (!recordingSupported()) {
      setState("error");
      setErrorMessage("This browser cannot record audio. Try Chrome or Safari on a secure page.");
      return;
    }

    stoppingRef.current = false;
    chunksRef.current = [];
    lengthRef.current = 0;
    setPcm(new Float32Array(0));
    setDurationMs(0);
    setLevel(0);
    setErrorMessage(null);
    setState("idle");

    const Ctor = audioContextCtor()!;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
    } catch {
      setState("error");
      setErrorMessage("Microphone access was denied. Allow the mic and try again.");
      return;
    }

    const context = new Ctor();
    if (context.state === "suspended") {
      await context.resume().catch(() => undefined);
    }

    const source = context.createMediaStreamSource(stream);
    // ScriptProcessor is deprecated but widely available and easy to test without a worklet file.
    const processor = context.createScriptProcessor(4096, 1, 1);

    processor.onaudioprocess = (event) => {
      if (stoppingRef.current) return;
      const input = event.inputBuffer.getChannelData(0);
      const copy = new Float32Array(input.length);
      copy.set(input);
      chunksRef.current.push(copy);
      lengthRef.current += copy.length;

      let peak = 0;
      for (let i = 0; i < copy.length; i++) {
        const abs = Math.abs(copy[i]!);
        if (abs > peak) peak = abs;
      }
      setLevel(peak);
    };

    // Mute the processor output so the live mic is not played back through speakers.
    const mute = context.createGain();
    mute.gain.value = 0;
    source.connect(processor);
    processor.connect(mute);
    mute.connect(context.destination);

    streamRef.current = stream;
    contextRef.current = context;
    sourceRef.current = source;
    processorRef.current = processor;
    setSampleRate(context.sampleRate);
    startedAtRef.current = Date.now();
    setState("recording");

    maxTimerRef.current = setTimeout(() => {
      finish();
    }, MAX_RECORDING_MS);

    tickTimerRef.current = setInterval(() => {
      setDurationMs(Math.min(MAX_RECORDING_MS, Date.now() - startedAtRef.current));
    }, 200);
  }, [finish]);

  const reset = useCallback(() => {
    teardownGraph();
    stoppingRef.current = false;
    chunksRef.current = [];
    lengthRef.current = 0;
    startedAtRef.current = 0;
    setPcm(new Float32Array(0));
    setSampleRate(0);
    setDurationMs(0);
    setLevel(0);
    setErrorMessage(null);
    setState("idle");
  }, [teardownGraph]);

  useEffect(() => () => teardownGraph(), [teardownGraph]);

  return {
    state,
    pcm,
    sampleRate,
    durationMs,
    level,
    errorMessage,
    start,
    stop,
    reset,
  };
}
