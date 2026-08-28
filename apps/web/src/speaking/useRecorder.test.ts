import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_RECORDING_MS, recordingSupported, useRecorder } from "./useRecorder";

type ProcessorHandler = ((event: { inputBuffer: { getChannelData: (ch: number) => Float32Array } }) => void) | null;

function makeAudioMocks() {
  const processors: Array<{
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    set onaudioprocess(handler: ProcessorHandler);
    get onaudioprocess(): ProcessorHandler;
  }> = [];

  let processHandler: ProcessorHandler = null;

  const source = {
    connect: vi.fn(),
    disconnect: vi.fn(),
  };

  const context = {
    sampleRate: 48_000,
    state: "running" as string,
    createMediaStreamSource: vi.fn(() => source),
    createGain: vi.fn(() => ({
      gain: { value: 1 },
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    createScriptProcessor: vi.fn((_bufferSize: number, _in: number, _out: number) => {
      const node = {
        connect: vi.fn(),
        disconnect: vi.fn(),
        _handler: null as ProcessorHandler,
        set onaudioprocess(handler: ProcessorHandler) {
          this._handler = handler;
          processHandler = handler;
        },
        get onaudioprocess() {
          return this._handler;
        },
      };
      processors.push(node);
      return node;
    }),
    destination: {},
    close: vi.fn(async () => {
      context.state = "closed";
    }),
    resume: vi.fn(async () => {
      context.state = "running";
    }),
  };

  const track = { stop: vi.fn() };
  const stream = { getTracks: () => [track] };

  const getUserMedia = vi.fn(async () => stream);

  return { context, source, processors, getProcessHandler: () => processHandler, getUserMedia, track, stream };
}

describe("recordingSupported", () => {
  it("is false when getUserMedia is missing", () => {
    const original = navigator.mediaDevices;
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: undefined,
    });
    expect(recordingSupported()).toBe(false);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: original,
    });
  });
});

describe("useRecorder", () => {
  let mocks: ReturnType<typeof makeAudioMocks>;
  let OriginalAudioContext: typeof AudioContext;

  beforeEach(() => {
    mocks = makeAudioMocks();
    OriginalAudioContext = window.AudioContext;
    // @ts-expect-error test stub
    window.AudioContext = vi.fn(() => mocks.context);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: mocks.getUserMedia },
    });
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    window.AudioContext = OriginalAudioContext;
    vi.restoreAllMocks();
  });

  it("starts idle and can record until stop", async () => {
    const { result } = renderHook(() => useRecorder());
    expect(result.current.state).toBe("idle");

    await act(async () => {
      await result.current.start();
    });
    expect(result.current.state).toBe("recording");
    expect(mocks.getUserMedia).toHaveBeenCalled();

    const chunk = new Float32Array([0.5, -0.5, 0.25, -0.25]);
    act(() => {
      mocks.getProcessHandler()?.({
        inputBuffer: { getChannelData: () => chunk },
      });
    });

    await act(async () => {
      result.current.stop();
    });

    expect(result.current.state).toBe("done");
    expect(result.current.pcm.length).toBeGreaterThan(0);
    expect(result.current.sampleRate).toBe(48_000);
    expect(mocks.track.stop).toHaveBeenCalled();
  });

  it("auto-stops at the max duration", async () => {
    const { result } = renderHook(() => useRecorder());

    await act(async () => {
      await result.current.start();
    });
    expect(result.current.state).toBe("recording");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(MAX_RECORDING_MS);
    });

    await waitFor(() => {
      expect(result.current.state).toBe("done");
    });
  });

  it("enters error when the mic is denied", async () => {
    mocks.getUserMedia.mockRejectedValueOnce(new DOMException("Denied", "NotAllowedError"));
    const { result } = renderHook(() => useRecorder());

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.state).toBe("error");
    expect(result.current.errorMessage).toMatch(/microphone/i);
  });

  it("refuses to start when recording is unsupported", async () => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: undefined,
    });
    const { result } = renderHook(() => useRecorder());

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.state).toBe("error");
  });
});
