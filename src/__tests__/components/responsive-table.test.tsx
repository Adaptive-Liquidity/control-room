/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { ResponsiveTable } from "@/components/ui/responsive-table";

interface Row {
  id: string;
  name: string;
  status: string;
  count: number;
}

const rows: Row[] = [
  { id: "1", name: "Alpha", status: "active", count: 3 },
  { id: "2", name: "Beta", status: "paused", count: 7 },
];

function renderTable() {
  return render(
    <ResponsiveTable<Row>
      rows={rows}
      rowKey={(r) => r.id}
      columns={[
        { key: "name", header: "Name", cell: (r) => r.name },
        { key: "count", header: "Count", cell: (r) => r.count },
      ]}
      card={{
        title: (r) => r.name,
        badge: (r) => <span data-testid={`badge-${r.id}`}>{r.status}</span>,
        fields: [{ label: "Count", value: (r) => r.count }],
      }}
    />
  );
}

describe("ResponsiveTable", () => {
  it("renders a desktop table with all columns and rows", () => {
    renderTable();
    expect(screen.getByRole("table")).toBeInTheDocument();
    for (const header of ["Name", "Count"]) {
      expect(
        screen.getByRole("columnheader", { name: header })
      ).toBeInTheDocument();
    }
    expect(screen.getAllByRole("row")).toHaveLength(3); // header + 2 body rows
  });

  it("renders a card per row with title, badge, and fields", () => {
    renderTable();
    expect(screen.getByTestId("responsive-table-cards")).toBeInTheDocument();
    expect(screen.getByTestId("badge-1")).toHaveTextContent("active");
    expect(screen.getByTestId("badge-2")).toHaveTextContent("paused");
    // "Count" appears once as column header and once per card field
    expect(screen.getAllByText("Count").length).toBeGreaterThanOrEqual(3);
  });

  it("renders actions when provided", () => {
    render(
      <ResponsiveTable<Row>
        rows={rows}
        rowKey={(r) => r.id}
        columns={[{ key: "name", header: "Name", cell: (r) => r.name }]}
        card={{
          title: (r) => r.name,
          fields: [],
          actions: (r) => <button>Pause {r.name}</button>,
        }}
      />
    );
    expect(
      screen.getByRole("button", { name: "Pause Alpha" })
    ).toBeInTheDocument();
  });
});
