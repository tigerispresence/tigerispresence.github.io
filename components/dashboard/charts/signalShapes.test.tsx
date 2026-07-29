import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { DownTriangle, UpTriangle } from "./signalShapes";

/** Render a shape inside an <svg> and return the path it produced, if any. */
function draw(node: React.ReactElement) {
  const { container } = render(<svg>{node}</svg>);
  return container.querySelector("path");
}

/** Apex above the base means the triangle points up. */
function pointsUp(d: string): boolean {
  const n = (d.match(/-?\d+\.?\d*/g) ?? []).map(Number);
  return n[1] < n[3];
}

describe("signal marker shapes", () => {
  it("renders nothing when the row has no signal", () => {
    // Regression test: Recharts invokes a custom shape for every row, not just
    // rows with a value. Signals are sparse, so without this guard a triangle
    // was drawn on all 250 sessions instead of the 5 that actually crossed.
    expect(draw(<UpTriangle cx={10} cy={10} payload={{ buySignal: null }} />)).toBeNull();
    expect(draw(<DownTriangle cx={10} cy={10} payload={{ sellSignal: null }} />)).toBeNull();
  });

  it("renders nothing when the payload is missing entirely", () => {
    expect(draw(<UpTriangle cx={10} cy={10} />)).toBeNull();
    expect(draw(<DownTriangle cx={10} cy={10} />)).toBeNull();
  });

  it("renders nothing without coordinates", () => {
    expect(draw(<UpTriangle payload={{ buySignal: 100 }} />)).toBeNull();
  });

  it("ignores a non-numeric value", () => {
    expect(
      draw(<UpTriangle cx={10} cy={10} payload={{ buySignal: Number.NaN }} />),
    ).toBeNull();
  });

  it("draws an upward green triangle for a buy", () => {
    const path = draw(<UpTriangle cx={50} cy={100} payload={{ buySignal: 100 }} />);
    expect(path).not.toBeNull();
    expect(pointsUp(path!.getAttribute("d")!)).toBe(true);
    expect(path!.getAttribute("fill")).toBe("#22c55e");
  });

  it("draws a downward red triangle for a sell", () => {
    const path = draw(<DownTriangle cx={50} cy={100} payload={{ sellSignal: 100 }} />);
    expect(path).not.toBeNull();
    expect(pointsUp(path!.getAttribute("d")!)).toBe(false);
    expect(path!.getAttribute("fill")).toBe("#ef4444");
  });

  it("points each apex at the close with the body on the opposite side", () => {
    // Both apexes sit on the price point; the bodies extend away from it, so
    // a buy triangle hangs below the close and a sell triangle above. SVG y
    // grows downward, hence the direction of these comparisons.
    const cy = 100;
    const up = draw(<UpTriangle cx={50} cy={cy} payload={{ buySignal: 1 }} />)!;
    const down = draw(<DownTriangle cx={50} cy={cy} payload={{ sellSignal: 1 }} />)!;

    const coords = (d: string) => (d.match(/-?\d+\.?\d*/g) ?? []).map(Number);
    const [, upApexY, , upBaseY] = coords(up.getAttribute("d")!);
    const [, downApexY, , downBaseY] = coords(down.getAttribute("d")!);

    expect(upApexY).toBe(cy);
    expect(downApexY).toBe(cy);
    expect(upBaseY).toBeGreaterThan(cy); // body below the close
    expect(downBaseY).toBeLessThan(cy); // body above the close
  });
});
