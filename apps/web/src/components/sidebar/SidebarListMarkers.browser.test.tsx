import { DndContext, useSensor, useSensors, type DragStartEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "react";
import { describe, expect, it } from "vite-plus/test";

import { render } from "../../../test/render";
import { sidebarMarkerId } from "../Sidebar.logic";
import { SidebarPointerSensor } from "../Sidebar.pointer";
import { SidebarSectionPlaceholder } from "./SidebarListMarkers";

const ROW_IDS = Array.from({ length: 20 }, (_, index) => `thread-${index}`);
const SORTABLE_IDS = [...ROW_IDS, sidebarMarkerId("settled-placeholder")];
const SENSOR_OPTIONS = { distance: 6, onAttach: () => {}, onFinish: () => {} };

function Row(props: { id: string }) {
  const { listeners, setNodeRef, transform, transition } = useSortable({ id: props.id });
  return (
    <li
      ref={setNodeRef}
      data-testid={props.id}
      style={{ height: 36, transform: CSS.Translate.toString(transform), transition }}
      {...listeners}
    >
      {props.id}
    </li>
  );
}

function ActiveListWithCollapsedSettled() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(SidebarPointerSensor, SENSOR_OPTIONS));
  return (
    <div data-testid="scroller" style={{ height: 400, overflowY: "auto" }}>
      <DndContext
        sensors={sensors}
        onDragStart={(event: DragStartEvent) => setActiveId(String(event.active.id))}
        onDragEnd={() => setActiveId(null)}
        onDragCancel={() => setActiveId(null)}
      >
        <SortableContext items={SORTABLE_IDS} strategy={verticalListSortingStrategy}>
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {ROW_IDS.map((id) => (
              <Row key={id} id={id} />
            ))}
            {/* Settled has no rendered rows, so Sidebar shows the hint on every drag. */}
            <SidebarSectionPlaceholder
              marker="settled-placeholder"
              label="Settled"
              showHint={activeId !== null}
              isDropTarget={false}
            />
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function pointer(type: string, clientX: number, clientY: number) {
  return new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    isPrimary: true,
    pointerId: 1,
    button: 0,
    buttons: 1,
    clientX,
    clientY,
  });
}

describe("SidebarSectionPlaceholder", () => {
  // regression: #27586 picking up an Active row scrolled the sidebar to the Settled hint
  it("does not scroll the sidebar when a drag from outside Settled starts", async () => {
    await using screen = await render(<ActiveListWithCollapsedSettled />, {
      // Plain dnd-kit list; nothing here links or navigates.
      router: false,
    });
    const scroller = screen.getByTestId("scroller").element();
    const row = screen.getByTestId("thread-5").element();
    expect(scroller.scrollHeight).toBeGreaterThan(scroller.clientHeight);
    expect(scroller.scrollTop).toBe(0);

    const { left, top } = row.getBoundingClientRect();
    row.dispatchEvent(pointer("pointerdown", left + 10, top + 18));
    document.dispatchEvent(pointer("pointermove", left + 10, top + 30));
    await expect.element(screen.getByText("Settled")).toBeInTheDocument();
    const scrollTopAfterPickup = scroller.scrollTop;
    document.dispatchEvent(pointer("pointerup", left + 10, top + 30));

    expect(scrollTopAfterPickup, "picking up an Active row scrolled the sidebar").toBe(0);
  });
});
