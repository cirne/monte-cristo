import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import { HeaderProgressBar } from "./HeaderProgressBar";

let mockedPathname = "/";

vi.mock("next/navigation", () => ({
  usePathname: () => mockedPathname,
}));

type TriggerEntry = { target: Element; isIntersecting: boolean };

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];
  root: Element | Document | null = null;
  rootMargin = "0px";
  thresholds = [0.1];
  private callback: IntersectionObserverCallback;

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    MockIntersectionObserver.instances.push(this);
  }

  observe = () => null;
  unobserve = () => null;
  disconnect = () => null;
  takeRecords = (): IntersectionObserverEntry[] => [];

  trigger(entries: TriggerEntry[]) {
    const payload = entries.map(({ target, isIntersecting }) => {
      const rect = target.getBoundingClientRect();
      return {
        time: Date.now(),
        target,
        isIntersecting,
        intersectionRatio: isIntersecting ? 1 : 0,
        boundingClientRect: rect,
        intersectionRect: isIntersecting ? rect : ({ ...rect, width: 0, height: 0 } as DOMRectReadOnly),
        rootBounds: null,
      } as IntersectionObserverEntry;
    });
    this.callback(payload, this as unknown as IntersectionObserver);
  }
}

function mockRect(
  top: number,
  bottom: number,
  height = Math.max(1, bottom - top),
  width = 500
): DOMRect {
  return {
    x: 0,
    y: top,
    top,
    bottom,
    left: 0,
    right: width,
    width,
    height,
    toJSON: () => ({}),
  } as DOMRect;
}

describe("app/components/HeaderProgressBar", () => {
  beforeEach(() => {
    mockedPathname = "/";
    MockIntersectionObserver.instances = [];
    vi.stubGlobal(
      "IntersectionObserver",
      MockIntersectionObserver as unknown as typeof IntersectionObserver
    );
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      writable: true,
      value: 800,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders progress bar container", () => {
    const { container } = render(<HeaderProgressBar />);
    expect(container.querySelector(".bg-stone-200")).toBeInTheDocument();
  });

  it("hides progress fill outside chapter pages", () => {
    mockedPathname = "/search";
    const { container } = render(<HeaderProgressBar />);
    expect(container.querySelector(".bg-amber-500")).not.toBeInTheDocument();
  });

  it("uses largest visible paragraph index within the chapter", () => {
    mockedPathname = "/chapter/10";

    const { container } = render(
      <>
        <HeaderProgressBar />
        <div>
          <p data-paragraph-index="0">Paragraph 0</p>
          <p data-paragraph-index="1">Paragraph 1</p>
          <p data-paragraph-index="2">Paragraph 2</p>
          <p data-paragraph-index="3">Paragraph 3</p>
        </div>
      </>
    );

    const paragraphs = Array.from(
      document.querySelectorAll<HTMLElement>("[data-paragraph-index]")
    );

    vi.spyOn(paragraphs[0], "getBoundingClientRect").mockReturnValue(mockRect(50, 120));
    vi.spyOn(paragraphs[1], "getBoundingClientRect").mockReturnValue(mockRect(150, 220));
    vi.spyOn(paragraphs[2], "getBoundingClientRect").mockReturnValue(mockRect(250, 320));
    vi.spyOn(paragraphs[3], "getBoundingClientRect").mockReturnValue(mockRect(1200, 1280));

    const observer = MockIntersectionObserver.instances[0];
    expect(observer).toBeDefined();

    act(() => {
      observer.trigger([
        { target: paragraphs[1], isIntersecting: true },
        { target: paragraphs[2], isIntersecting: true },
      ]);
    });

    const fill = container.querySelector(".bg-amber-500");
    expect(fill).toHaveStyle({ width: "75%" });
  });

  it("forces 100% once chapter end is reached", () => {
    mockedPathname = "/chapter/10";

    const { container } = render(
      <>
        <HeaderProgressBar />
        <div>
          <p data-paragraph-index="0">Paragraph 0</p>
          <p data-paragraph-index="1">Paragraph 1</p>
          <p data-paragraph-index="2">Paragraph 2</p>
          <p data-paragraph-index="3">Paragraph 3</p>
        </div>
      </>
    );

    const paragraphs = Array.from(
      document.querySelectorAll<HTMLElement>("[data-paragraph-index]")
    );

    vi.spyOn(paragraphs[3], "getBoundingClientRect").mockReturnValue(mockRect(760, 790, 30));

    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });

    const fill = container.querySelector(".bg-amber-500");
    expect(fill).toHaveStyle({ width: "100%" });
  });
});
