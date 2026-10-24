import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/client", () => ({ fetchStock: vi.fn(), fetchSearch: vi.fn() }));
import { useStockQuery } from "./useStockQuery";
import { fetchStock } from "@/lib/api/client";
import type { StockData } from "@/lib/types/stock";

const mockFetch = vi.mocked(fetchStock);

/** A promise the test resolves by hand, to control response order. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

const stock = (symbol: string) => ({ symbol, name: symbol, history: [] }) as unknown as StockData;

describe("useStockQuery", () => {
  beforeEach(() => mockFetch.mockReset());

  it("reset clears the stock and drops a load still in flight", async () => {
    const pending = deferred<StockData>();
    mockFetch.mockReturnValueOnce(pending.promise);
    const { result } = renderHook(() => useStockQuery());

    act(() => void result.current.load("NVDA"));
    expect(result.current.loading).toBe(true);
    act(() => result.current.reset());
    await act(async () => pending.resolve(stock("NVDA")));

    expect(result.current.stockData).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("a background refresh does not cancel a load the user started", async () => {
    mockFetch.mockResolvedValueOnce(stock("AAPL"));
    const { result } = renderHook(() => useStockQuery());
    await act(() => result.current.load("AAPL"));

    const userLoad = deferred<StockData>();
    const refresh = deferred<StockData>();
    mockFetch.mockReturnValueOnce(userLoad.promise).mockReturnValueOnce(refresh.promise);

    act(() => void result.current.load("MSFT"));
    act(() => void result.current.load("AAPL", { silent: true }));
    await act(async () => userLoad.resolve(stock("MSFT")));
    await act(async () => refresh.resolve(stock("AAPL")));

    expect(result.current.stockData?.symbol).toBe("MSFT");
  });

  it("keeps a custom range for background refreshes and the next stock", async () => {
    mockFetch.mockResolvedValue(stock("AAPL"));
    const { result } = renderHook(() => useStockQuery());
    await act(() => result.current.load("AAPL"));
    await act(() => result.current.changeRange("custom", "2023-10-24"));

    await act(() => result.current.load("AAPL", { silent: true }));
    expect(mockFetch).toHaveBeenLastCalledWith("AAPL", { range: "custom", from: "2023-10-24" });

    mockFetch.mockResolvedValue(stock("MSFT"));
    await act(() => result.current.load("MSFT"));
    expect(mockFetch).toHaveBeenLastCalledWith("MSFT", { range: "custom", from: "2023-10-24" });
    expect(result.current.rangeFrom).toBe("2023-10-24");
  });
});
