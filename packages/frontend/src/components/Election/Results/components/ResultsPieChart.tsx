import { Cell, Legend, Pie, PieChart, ResponsiveContainer } from "recharts";
import { CHART_COLORS, truncName } from "~/components/util";

export default ({ data, colorOffset = 0, star = false }) => {
  const renderCustomizedLabel = ({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percent,
    index,
  }) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="black"
        style={{ fontWeight: "bold", textAlign: "center" }}
        textAnchor="middle"
        dominantBaseline="central"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  let pieColors = [
    CHART_COLORS[colorOffset % CHART_COLORS.length],
    CHART_COLORS[(colorOffset + 1) % CHART_COLORS.length],
    "var(--brand-gray-2)",
  ];

  const pieAngle = 90;

  let rawData = data;

  // Truncate names
  data = rawData.map((d, i) => ({
    ...d,
    name: (star && i == 0 ? "⭐" : "") + truncName(d["name"], 20),
  }));

  return (
    <ResponsiveContainer width="100%" height={250}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={renderCustomizedLabel}
          outerRadius={100}
          fill="#8884d8"
          dataKey="votes"
          startAngle={pieAngle}
          endAngle={pieAngle + 360}
        >
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={pieColors[index]}
              stroke="var(--brand-white)"
              strokeWidth={6}
            />
          ))}
        </Pie>
        <Legend
          layout="vertical"
          verticalAlign="top"
          align="right"
          formatter={(value) => (
            <span
              style={{ color: "black", fontWeight: "bold", fontSize: ".9rem" }}
            >
              {value}
            </span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
};