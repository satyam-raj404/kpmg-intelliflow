import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis,
} from "recharts";
import { chartPalette } from "@/lib/brand";
import { formatINR, formatPercent } from "@/lib/format";

export interface ChartSpec {
  chart_type: "bar" | "hbar" | "line" | "pie" | "donut" | "scatter";
  title: string;
  x: string;
  y: string;
  unit: "inr" | "pct" | "number";
  points: { x: string | number; y: number }[];
  total_points: number;
}

const fmt = (v: number, unit: ChartSpec["unit"]) =>
  unit === "inr" ? formatINR(v) : unit === "pct" ? formatPercent(v) : v.toLocaleString("en-IN");

const truncate = (s: string | number, n = 14) => {
  const t = String(s);
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
};

export function ChatChart({ spec }: { spec: ChartSpec }) {
  const { chart_type: type, unit, points } = spec;
  const tick = { fontSize: 10 };
  const tooltip = (
    <Tooltip formatter={(v: number) => [fmt(v, unit), spec.y]} labelFormatter={(l) => String(l)} />
  );

  let chart;
  if (type === "pie" || type === "donut") {
    chart = (
      <PieChart>
        <Pie data={points} dataKey="y" nameKey="x" innerRadius={type === "donut" ? "55%" : 0} outerRadius="85%">
          {points.map((_, i) => (
            <Cell key={i} fill={chartPalette[i % chartPalette.length]} />
          ))}
        </Pie>
        {tooltip}
        <Legend wrapperStyle={{ fontSize: 10 }} />
      </PieChart>
    );
  } else if (type === "scatter") {
    chart = (
      <ScatterChart margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
        <XAxis type="number" dataKey="x" name={spec.x} tick={tick} tickFormatter={(v) => v.toLocaleString("en-IN")} />
        <YAxis type="number" dataKey="y" name={spec.y} tick={tick} tickFormatter={(v) => fmt(v, unit)} width={64} />
        <Tooltip cursor={{ strokeDasharray: "3 3" }} />
        <Scatter data={points} fill={chartPalette[0]} />
      </ScatterChart>
    );
  } else if (type === "line") {
    chart = (
      <LineChart data={points} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
        <XAxis dataKey="x" tick={tick} tickFormatter={(v) => truncate(v)} />
        <YAxis tick={tick} tickFormatter={(v) => fmt(v, unit)} width={64} />
        {tooltip}
        <Line type="monotone" dataKey="y" stroke={chartPalette[0]} strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    );
  } else {
    const horizontal = type === "hbar";
    chart = (
      <BarChart
        data={points}
        layout={horizontal ? "vertical" : "horizontal"}
        margin={{ top: 8, right: 16, left: horizontal ? 70 : 0, bottom: 8 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#eee" horizontal={!horizontal} vertical={horizontal} />
        {horizontal ? (
          <>
            <XAxis type="number" tick={tick} tickFormatter={(v) => fmt(v, unit)} />
            <YAxis type="category" dataKey="x" tick={tick} width={90} tickFormatter={(v) => truncate(v, 16)} />
          </>
        ) : (
          <>
            <XAxis dataKey="x" tick={tick} interval={0} angle={-30} textAnchor="end" height={56} tickFormatter={(v) => truncate(v)} />
            <YAxis tick={tick} tickFormatter={(v) => fmt(v, unit)} width={64} />
          </>
        )}
        {tooltip}
        <Bar dataKey="y" radius={horizontal ? [0, 3, 3, 0] : [3, 3, 0, 0]}>
          {points.map((_, i) => (
            <Cell key={i} fill={chartPalette[i % chartPalette.length]} />
          ))}
        </Bar>
      </BarChart>
    );
  }

  return (
    <div>
      <div className="px-3 pt-2 text-[11px] font-semibold text-foreground">{spec.title}</div>
      <div className={type === "hbar" && points.length > 8 ? "h-96" : "h-64"}>
        <ResponsiveContainer>{chart}</ResponsiveContainer>
      </div>
      {spec.total_points > points.length && (
        <div className="px-3 pb-2 text-[9px] text-muted-foreground">
          Showing first {points.length} of {spec.total_points} rows
        </div>
      )}
    </div>
  );
}
