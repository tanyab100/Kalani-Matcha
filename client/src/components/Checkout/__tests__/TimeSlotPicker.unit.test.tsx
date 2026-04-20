import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TimeSlotPicker } from "../TimeSlotPicker";
import * as api from "../../../services/api";
import type { PickupSlot } from "../../../types/menu";

vi.mock("../../../services/api", () => ({
  getPickupSlots: vi.fn(),
}));

const mockGetPickupSlots = vi.mocked(api.getPickupSlots);

function makeSlot(overrides: Partial<PickupSlot> = {}): PickupSlot {
  return {
    id: "slot-1",
    time: "2024-12-20T10:00:00.000Z",
    capacity: 5,
    usedCapacity: 1,
    available: true,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── staleSlotError prop ───────────────────────────────────────────────────────

describe("staleSlotError prop", () => {
  it("shows stale slot warning when staleSlotError={true}", async () => {
    mockGetPickupSlots.mockResolvedValue([makeSlot()]);

    render(
      <TimeSlotPicker
        selectedSlotId={null}
        onSelect={vi.fn()}
        staleSlotError={true}
      />
    );

    await waitFor(() => {
      expect(
        screen.getByText(/previously selected time is no longer available/i)
      ).toBeInTheDocument();
    });
  });

  it("does NOT show stale slot warning when staleSlotError={false}", async () => {
    mockGetPickupSlots.mockResolvedValue([makeSlot()]);

    render(
      <TimeSlotPicker
        selectedSlotId={null}
        onSelect={vi.fn()}
        staleSlotError={false}
      />
    );

    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  it("does NOT show stale slot warning when staleSlotError is not passed", async () => {
    mockGetPickupSlots.mockResolvedValue([makeSlot()]);

    render(
      <TimeSlotPicker selectedSlotId={null} onSelect={vi.fn()} />
    );

    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });
});

// ── slot rendering ────────────────────────────────────────────────────────────

describe("slot rendering", () => {
  it("renders available slots as selectable buttons", async () => {
    const slots = [
      makeSlot({ id: "slot-1", time: "2024-12-20T10:00:00.000Z" }),
      makeSlot({ id: "slot-2", time: "2024-12-20T11:00:00.000Z" }),
    ];
    mockGetPickupSlots.mockResolvedValue(slots);

    render(
      <TimeSlotPicker selectedSlotId={null} onSelect={vi.fn()} />
    );

    await waitFor(() => {
      const buttons = screen.getAllByRole("button");
      expect(buttons).toHaveLength(2);
    });
  });

  it("does not render unavailable slots", async () => {
    const slots = [
      makeSlot({ id: "slot-1", available: true }),
      makeSlot({ id: "slot-2", available: false }),
    ];
    mockGetPickupSlots.mockResolvedValue(slots);

    render(
      <TimeSlotPicker selectedSlotId={null} onSelect={vi.fn()} />
    );

    await waitFor(() => {
      const buttons = screen.getAllByRole("button");
      expect(buttons).toHaveLength(1);
    });
  });

  it("calls onSelect with the correct slot when a slot button is clicked", async () => {
    const slot = makeSlot({ id: "slot-1" });
    mockGetPickupSlots.mockResolvedValue([slot]);
    const onSelect = vi.fn();

    render(
      <TimeSlotPicker selectedSlotId={null} onSelect={onSelect} />
    );

    await waitFor(() => {
      expect(screen.getAllByRole("button")).toHaveLength(1);
    });

    await userEvent.click(screen.getAllByRole("button")[0]);
    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith(slot);
  });
});

// ── loading state ─────────────────────────────────────────────────────────────

describe("loading state", () => {
  it("shows loading indicator while fetching slots", () => {
    // Never resolves during this test
    mockGetPickupSlots.mockReturnValue(new Promise(() => {}));

    render(
      <TimeSlotPicker selectedSlotId={null} onSelect={vi.fn()} />
    );

    expect(screen.getByText(/loading available times/i)).toBeInTheDocument();
  });
});

// ── error state ───────────────────────────────────────────────────────────────

describe("error state", () => {
  it("shows error message when getPickupSlots rejects", async () => {
    mockGetPickupSlots.mockRejectedValue(new Error("Network error"));

    render(
      <TimeSlotPicker selectedSlotId={null} onSelect={vi.fn()} />
    );

    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });
  });

  it("shows fallback error message when error has no message", async () => {
    mockGetPickupSlots.mockRejectedValue({});

    render(
      <TimeSlotPicker selectedSlotId={null} onSelect={vi.fn()} />
    );

    await waitFor(() => {
      expect(screen.getByText(/failed to load pickup slots/i)).toBeInTheDocument();
    });
  });
});
