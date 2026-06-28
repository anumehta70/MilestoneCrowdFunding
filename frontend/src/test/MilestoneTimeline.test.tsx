import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MilestoneTimeline } from "@/components/MilestoneTimeline";
import type { Milestone } from "@/types/domain";

const milestones: Milestone[] = [
  { description: "Prototype complete", releaseBps: 4000, approved: false, released: false },
  { description: "Beta launch", releaseBps: 3000, approved: true, released: false },
  { description: "Public release", releaseBps: 3000, approved: true, released: true },
];

describe("MilestoneTimeline", () => {
  it("renders every milestone with its computed release amount", () => {
    render(
      <MilestoneTimeline
        milestones={milestones}
        goal="1000000000"
        canManage={false}
        busyIndex={null}
      />
    );
    expect(screen.getByText("Prototype complete")).toBeInTheDocument();
    expect(screen.getByText("Beta launch")).toBeInTheDocument();
    expect(screen.getByText("Public release")).toBeInTheDocument();
    // 4000 bps of 1_000_000_000 stroops = 400_000_000 stroops = 40 XLM
    expect(screen.getByText("40 XLM")).toBeInTheDocument();
  });

  it("shows an Approve button only for pending milestones when canManage is true", () => {
    render(
      <MilestoneTimeline
        milestones={milestones}
        goal="1000000000"
        canManage={true}
        busyIndex={null}
        onApprove={vi.fn()}
        onRelease={vi.fn()}
      />
    );
    expect(screen.getAllByText("Approve")).toHaveLength(1);
  });

  it("shows a Release funds button for approved-but-unreleased milestones", () => {
    render(
      <MilestoneTimeline
        milestones={milestones}
        goal="1000000000"
        canManage={true}
        busyIndex={null}
        onApprove={vi.fn()}
        onRelease={vi.fn()}
      />
    );
    expect(screen.getAllByText("Release funds")).toHaveLength(1);
  });

  it("calls onApprove with the correct index when clicked", () => {
    const onApprove = vi.fn();
    render(
      <MilestoneTimeline
        milestones={milestones}
        goal="1000000000"
        canManage={true}
        busyIndex={null}
        onApprove={onApprove}
        onRelease={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText("Approve"));
    expect(onApprove).toHaveBeenCalledWith(0);
  });

  it("hides action buttons entirely when canManage is false", () => {
    render(
      <MilestoneTimeline
        milestones={milestones}
        goal="1000000000"
        canManage={false}
        busyIndex={null}
      />
    );
    expect(screen.queryByText("Approve")).not.toBeInTheDocument();
    expect(screen.queryByText("Release funds")).not.toBeInTheDocument();
  });
});
