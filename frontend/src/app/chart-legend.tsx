export type LegendItem = {
  name: string;
  color: string;
  mark?: "line" | "bar" | "area" | "dash";
};

export default function ChartLegend({ items }: { items: LegendItem[] }) {
  return <ul className="plot-legend" aria-label="Chart legend">
    {items.map(({ name, color, mark = "line" }) => <li key={name}>
      <i aria-hidden="true" data-mark={mark} style={{ color }} />{name}
    </li>)}
  </ul>;
}
