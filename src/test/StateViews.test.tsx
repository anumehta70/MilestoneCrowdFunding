import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LoadingState, ErrorState, EmptyState } from "@/components/StateViews";

describe("LoadingState", () => {
  it("renders the default loading label", () => {
    render(<LoadingState />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("renders a custom label when provided", () => {
    render(<LoadingState label="Fetching campaigns…" />);
    expect(screen.getByText("Fetching campaigns…")).toBeInTheDocument();
  });
});

describe("ErrorState", () => {
  it("renders the error message", () => {
    render(<ErrorState message="The network request failed." />);
    expect(screen.getByText("The network request failed.")).toBeInTheDocument();
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("calls onRetry when the retry button is clicked", () => {
    const onRetry = vi.fn();
    render(<ErrorState message="Failed" onRetry={onRetry} />);
    fireEvent.click(screen.getByText("Try again"));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("does not render a retry button when onRetry is omitted", () => {
    render(<ErrorState message="Failed" />);
    expect(screen.queryByText("Try again")).not.toBeInTheDocument();
  });
});

describe("EmptyState", () => {
  it("renders title, message, and optional action", () => {
    render(
      <EmptyState
        title="No campaigns yet"
        message="Be the first to launch one."
        action={<button>Start a campaign</button>}
      />
    );
    expect(screen.getByText("No campaigns yet")).toBeInTheDocument();
    expect(screen.getByText("Start a campaign")).toBeInTheDocument();
  });
});
