// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { handOffToOpener, listenForHandoff } from "./tabHandoff";

const ORIGIN = window.location.origin;

/** Deliver a message to this window as if posted from `source`. */
function deliver(data: unknown, source: unknown, origin = ORIGIN) {
  window.dispatchEvent(new MessageEvent("message", { data, origin, source: source as Window }));
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  Object.defineProperty(window, "opener", { value: null, configurable: true });
});

describe("listenForHandoff", () => {
  it("acknowledges and opens a symbol sent by a tab we opened", () => {
    const onOpen = vi.fn();
    const stop = listenForHandoff(onOpen);
    const source = { postMessage: vi.fn() };

    deliver({ type: "stock-analyzer:open", id: "abc", symbol: "NVDA" }, source);

    expect(onOpen).toHaveBeenCalledWith("NVDA");
    expect(source.postMessage).toHaveBeenCalledWith({ type: "stock-analyzer:ack", id: "abc" }, ORIGIN);
    stop();
  });

  it("ignores messages from other origins", () => {
    const onOpen = vi.fn();
    const stop = listenForHandoff(onOpen);
    deliver({ type: "stock-analyzer:open", id: "abc", symbol: "NVDA" }, { postMessage: vi.fn() }, "https://evil.example");
    expect(onOpen).not.toHaveBeenCalled();
    stop();
  });
});

describe("handOffToOpener", () => {
  it("shows the stock here when there is no originating tab", async () => {
    expect(await handOffToOpener("NVDA")).toBe(false);
  });

  it("closes this tab once the originating tab confirms", async () => {
    const close = vi.spyOn(window, "close").mockImplementation(() => {});
    const originTab = {
      closed: false,
      // The originating tab answers with an ack carrying the same id.
      postMessage: (msg: { id: string }) => queueMicrotask(() => deliver({ type: "stock-analyzer:ack", id: msg.id }, originTab)),
    };
    Object.defineProperty(window, "opener", { value: { top: originTab }, configurable: true });

    expect(await handOffToOpener("NVDA")).toBe(true);
    expect(close).toHaveBeenCalled();
  });

  it("falls back to showing it here when no confirmation arrives", async () => {
    vi.useFakeTimers();
    const close = vi.spyOn(window, "close").mockImplementation(() => {});
    Object.defineProperty(window, "opener", { value: { top: { closed: false, postMessage: vi.fn() } }, configurable: true });

    const result = handOffToOpener("NVDA");
    await vi.advanceTimersByTimeAsync(1000);
    expect(await result).toBe(false);
    expect(close).not.toHaveBeenCalled();
  });
});
