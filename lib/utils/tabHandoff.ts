/**
 * Sends a market-map click back to the tab it came from.
 *
 * The TradingView heatmap is a cross-origin iframe that opens every symbol in
 * a new tab, and nothing in its config or the iframe sandbox can change that.
 * But the new tab's `window.opener` is that iframe, and `opener.top` is the
 * original app tab — same origin as us. So the new tab posts the symbol back,
 * and closes itself once the original tab confirms it took over. With no
 * confirmation (the original tab is on another page, or gone) the new tab
 * simply loads the stock itself, as before.
 */
const OPEN = "stock-analyzer:open";
const ACK = "stock-analyzer:ack";
const ACK_TIMEOUT_MS = 800;

interface HandoffMessage {
  type: typeof OPEN | typeof ACK;
  id: string;
  symbol?: string;
}

const isHandoff = (data: unknown): data is HandoffMessage =>
  typeof data === "object" && data !== null && "type" in data && "id" in data;

/** The tab that opened this one, if it is one of ours and still open. */
function originTab(): Window | null {
  try {
    const top = window.opener?.top as Window | undefined;
    return top && top !== window && !top.closed ? top : null;
  } catch {
    return null;
  }
}

/**
 * Ask the originating tab to show `symbol`. Resolves true once it has taken
 * over, after which this tab closes itself; false means show it here.
 */
export function handOffToOpener(symbol: string): Promise<boolean> {
  const target = originTab();
  if (!target) return Promise.resolve(false);

  const id = Math.random().toString(36).slice(2);
  return new Promise((resolve) => {
    const finish = (handled: boolean) => {
      window.removeEventListener("message", onMessage);
      clearTimeout(timer);
      resolve(handled);
    };
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || !isHandoff(event.data)) return;
      if (event.data.type === ACK && event.data.id === id) {
        finish(true);
        window.close();
      }
    };
    const timer = setTimeout(() => finish(false), ACK_TIMEOUT_MS);
    window.addEventListener("message", onMessage);
    // targetOrigin pins delivery to our own origin: nothing leaks elsewhere.
    target.postMessage({ type: OPEN, id, symbol } satisfies HandoffMessage, window.location.origin);
  });
}

/** In the originating tab: take over symbols sent back by tabs we opened. Returns a cleanup. */
export function listenForHandoff(onOpen: (symbol: string) => void): () => void {
  const onMessage = (event: MessageEvent) => {
    if (event.origin !== window.location.origin || !isHandoff(event.data)) return;
    if (event.data.type !== OPEN || !event.data.symbol) return;
    (event.source as Window | null)?.postMessage({ type: ACK, id: event.data.id } satisfies HandoffMessage, event.origin);
    onOpen(event.data.symbol);
  };
  window.addEventListener("message", onMessage);
  return () => window.removeEventListener("message", onMessage);
}
