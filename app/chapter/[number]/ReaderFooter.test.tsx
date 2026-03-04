import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ReaderFooter } from "./ReaderFooter";

const LARGE_SCREEN_MQ = "(min-width: 768px)";

const defaultProps = {
  locationLabel: "On the deck of the Pharaon" as string | null,
  visibleCharacterIds: [] as string[],
  xrayData: {} as Record<string, { name: string }>,
  onOpenEntity: vi.fn(),
};

describe("app/chapter/[number]/ReaderFooter", () => {
  it("returns null when no location and no character ids", () => {
    const { container } = render(
      <ReaderFooter
        locationLabel={null}
        visibleCharacterIds={[]}
        xrayData={{}}
        onOpenEntity={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders location label when provided (large screen)", () => {
    render(
      <ReaderFooter
        locationLabel="On the deck of the Pharaon"
        visibleCharacterIds={[]}
        xrayData={{}}
        onOpenEntity={vi.fn()}
      />
    );
    expect(screen.getByText("On the deck of the Pharaon")).toBeInTheDocument();
  });

  describe("small screen viewport states", () => {
    beforeEach(() => {
      vi.stubGlobal(
        "matchMedia",
        (query: string) => {
          const isLargeQuery = query === LARGE_SCREEN_MQ;
          const listeners: Array<() => void> = [];
          const matches = false; // small by default
          return {
            get matches() {
              return isLargeQuery ? matches : false;
            },
            media: query,
            onchange: null,
            addListener: () => {},
            removeListener: () => {},
            addEventListener(...args: unknown[]) {
              const fn = args[1];
              if (typeof fn === "function") listeners.push(fn);
            },
            removeEventListener: () => {},
            dispatchEvent: () => false,
          };
        }
      );
    });

    it("view A: shows map button on the right and does not show location text", async () => {
      render(<ReaderFooter {...defaultProps} />);

      await vi.waitFor(() => {
        expect(screen.getByRole("button", { name: /show scene location/i })).toBeInTheDocument();
      });
      expect(screen.queryByText("On the deck of the Pharaon")).not.toBeInTheDocument();
    });

    it("view B: after clicking map button, shows location text and hides map button", async () => {
      render(<ReaderFooter {...defaultProps} />);

      const mapButton = await screen.findByRole("button", { name: /show scene location/i });
      fireEvent.click(mapButton);

      expect(screen.getByText("On the deck of the Pharaon")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /show scene location/i })).not.toBeInTheDocument();
    });

    it("scroll resets to view A: location hidden, map button visible again", async () => {
      render(<ReaderFooter {...defaultProps} />);

      const mapButton = await screen.findByRole("button", { name: /show scene location/i });
      fireEvent.click(mapButton);

      expect(screen.getByText("On the deck of the Pharaon")).toBeInTheDocument();

      act(() => {
        window.dispatchEvent(new Event("scroll"));
      });

      await vi.waitFor(() => {
        expect(screen.queryByText("On the deck of the Pharaon")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: /show scene location/i })).toBeInTheDocument();
      });
    });
  });

  describe("large screen", () => {
    beforeEach(() => {
      vi.stubGlobal("matchMedia", (query: string) => ({
        matches: query === LARGE_SCREEN_MQ,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }));
    });

    it("shows location text and no map button", () => {
      render(<ReaderFooter {...defaultProps} />);
      expect(screen.getByText("On the deck of the Pharaon")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /show scene location/i })).not.toBeInTheDocument();
    });
  });
});
