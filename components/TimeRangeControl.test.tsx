import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TimeRangeControl, { monthsAgo, monthsSince } from "./TimeRangeControl";

describe("monthsAgo / monthsSince", () => {
  it("round-trips every slider value, including month-end and year boundaries", () => {
    for (const now of [new Date(2026, 4, 31), new Date(2026, 2, 31), new Date(2026, 0, 1, 0, 30), new Date(2024, 1, 29)]) {
      for (let m = 1; m <= 120; m++) expect(monthsSince(monthsAgo(m, now), now)).toBe(m);
    }
  });

  it("clamps the day to the target month", () => {
    expect(monthsAgo(3, new Date(2026, 4, 31))).toBe("2026-02-28");
  });
});

describe("TimeRangeControl", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  const slider = () => screen.getByLabelText("Custom range in months") as HTMLInputElement;

  it("shows the loaded range, for presets and custom ranges alike", () => {
    const { rerender } = render(<TimeRangeControl timeRange="5y" onChange={() => {}} />);
    expect(slider().value).toBe("60");
    rerender(<TimeRangeControl timeRange="custom" from={monthsAgo(36)} onChange={() => {}} />);
    expect(slider().value).toBe("36");
  });

  it("commits once the slider settles, however it was moved", () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    render(<TimeRangeControl timeRange="1y" onChange={onChange} />);

    fireEvent.change(slider(), { target: { value: "30" } });
    fireEvent.change(slider(), { target: { value: "36" } });
    expect(onChange).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(500));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("custom", monthsAgo(36));
  });
});
