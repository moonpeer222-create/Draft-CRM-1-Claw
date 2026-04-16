// Custom SVG chart components to avoid recharts duplicate key warnings

interface LineChartProps {
  data: { [key: string]: any }[];
  xKey: string;
  yKey: string;
  color?: string;
  height?: number;
  darkMode?: boolean;
}

export function SimpleLineChart({ data, xKey, yKey, color = "#3B82F6", height = 250, darkMode = false }: LineChartProps) {
  if (!data.length) return null;
  const values = data.map(d => d[yKey] as number);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const padding = { top: 30, right: 20, bottom: 40, left: 45 };
  const w = 100; // percentage-based
  
  return (
    <div style={{ width: "100%", height }} className="relative">
      <svg viewBox={`0 0 500 ${height}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
          const y = padding.top + (1 - pct) * (height - padding.top - padding.bottom);
          const val = Math.round(min + pct * range);
          return (
            <g key={`grid-${i}`}>
              <line x1={padding.left} y1={y} x2={500 - padding.right} y2={y} stroke={darkMode ? "#374151" : "#dbeafe"} strokeDasharray="3 3" />
              <text x={padding.left - 8} y={y + 4} textAnchor="end" fill={darkMode ? "#9CA3AF" : "#6b7280"} fontSize="11">{val}</text>
            </g>
          );
        })}
        {/* Line path */}
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={data.map((d, i) => {
            const x = padding.left + (i / (data.length - 1)) * (500 - padding.left - padding.right);
            const y = padding.top + (1 - (d[yKey] - min) / range) * (height - padding.top - padding.bottom);
            return `${x},${y}`;
          }).join(" ")}
        />
        {/* Dots */}
        {data.map((d, i) => {
          const x = padding.left + (i / (data.length - 1)) * (500 - padding.left - padding.right);
          const y = padding.top + (1 - (d[yKey] - min) / range) * (height - padding.top - padding.bottom);
          return (
            <g key={`dot-${i}`}>
              <circle cx={x} cy={y} r="4" fill={color} />
              <text x={x} y={height - 10} textAnchor="middle" fill={darkMode ? "#9CA3AF" : "#6b7280"} fontSize="11">{d[xKey]}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

interface BarChartProps {
  data: { [key: string]: any }[];
  xKey: string;
  yKey: string;
  color?: string;
  height?: number;
  darkMode?: boolean;
}

export function SimpleBarChart({ data, xKey, yKey, color = "#6366F1", height = 250, darkMode = false }: BarChartProps) {
  if (!data.length) return null;
  const values = data.map(d => d[yKey] as number);
  const max = Math.max(...values, 1);
  const padding = { top: 20, right: 20, bottom: 40, left: 45 };
  const chartW = 500 - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const barW = chartW / data.length * 0.6;
  const gap = chartW / data.length;

  return (
    <div style={{ width: "100%", height }} className="relative">
      <svg viewBox={`0 0 500 ${height}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
        {/* Grid */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
          const y = padding.top + (1 - pct) * chartH;
          const val = Math.round(pct * max);
          return (
            <g key={`grid-${i}`}>
              <line x1={padding.left} y1={y} x2={500 - padding.right} y2={y} stroke={darkMode ? "#374151" : "#e5e7eb"} strokeDasharray="3 3" />
              <text x={padding.left - 8} y={y + 4} textAnchor="end" fill={darkMode ? "#9CA3AF" : "#6b7280"} fontSize="11">{val}</text>
            </g>
          );
        })}
        {/* Bars */}
        {data.map((d, i) => {
          const barH = (d[yKey] / max) * chartH;
          const x = padding.left + i * gap + (gap - barW) / 2;
          const y = padding.top + chartH - barH;
          return (
            <g key={`bar-${i}`}>
              <rect x={x} y={y} width={barW} height={barH} fill={color} rx="4" ry="4" />
              <text x={x + barW / 2} y={height - 10} textAnchor="middle" fill={darkMode ? "#9CA3AF" : "#6b7280"} fontSize="11">{d[xKey]}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

interface PieChartEntry {
  name: string;
  fullName?: string;
  displayName?: string;
  value: number;
  color: string;
}

interface PieChartProps {
  data: PieChartEntry[];
  height?: number;
  darkMode?: boolean;
}

export function SimplePieChart({ data, height = 250, darkMode = false }: PieChartProps) {
  if (!data.length) return null;
  const total = data.reduce((s, d) => s + d.value, 0);
  const cx = 150, cy = height / 2, r = 80;
  
  let cumAngle = -Math.PI / 2;
  const slices = data.map((d) => {
    const angle = (d.value / total) * 2 * Math.PI;
    const startAngle = cumAngle;
    cumAngle += angle;
    const endAngle = cumAngle;
    const largeArc = angle > Math.PI ? 1 : 0;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const midAngle = startAngle + angle / 2;
    const labelR = r + 20;
    const lx = cx + labelR * Math.cos(midAngle);
    const ly = cy + labelR * Math.sin(midAngle);
    return { ...d, x1, y1, x2, y2, largeArc, lx, ly, midAngle };
  });

  return (
    <div style={{ width: "100%", height }} className="relative">
      <svg viewBox={`0 0 400 ${height}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
        {slices.map((s, i) => {
          const path = data.length === 1
            ? `M ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx + r - 0.001} ${cy}`
            : `M ${cx} ${cy} L ${s.x1} ${s.y1} A ${r} ${r} 0 ${s.largeArc} 1 ${s.x2} ${s.y2} Z`;
          return (
            <g key={`slice-${i}`}>
              <path d={path} fill={s.color} stroke={darkMode ? "#1f2937" : "#fff"} strokeWidth="2" />
              <text
                x={s.lx}
                y={s.ly}
                textAnchor={s.midAngle > Math.PI / 2 && s.midAngle < 3 * Math.PI / 2 ? "end" : "start"}
                fill={darkMode ? "#D1D5DB" : "#374151"}
                fontSize="10"
                dominantBaseline="middle"
              >
                {(s.fullName || s.name)}: {s.value}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// Donut chart variant
interface DonutChartProps {
  data: PieChartEntry[];
  height?: number;
  darkMode?: boolean;
  innerRadius?: number;
  outerRadius?: number;
}

export function SimpleDonutChart({ data, height = 200, darkMode = false, innerRadius = 45, outerRadius = 75 }: DonutChartProps) {
  if (!data.length) return null;
  const total = data.reduce((s, d) => s + d.value, 0);
  const cx = 200, cy = height / 2;

  let cumAngle = -Math.PI / 2;
  const slices = data.map((d) => {
    const angle = (d.value / total) * 2 * Math.PI;
    const startAngle = cumAngle;
    cumAngle += angle;
    const endAngle = cumAngle;
    const largeArc = angle > Math.PI ? 1 : 0;
    const ox1 = cx + outerRadius * Math.cos(startAngle);
    const oy1 = cy + outerRadius * Math.sin(startAngle);
    const ox2 = cx + outerRadius * Math.cos(endAngle);
    const oy2 = cy + outerRadius * Math.sin(endAngle);
    const ix1 = cx + innerRadius * Math.cos(endAngle);
    const iy1 = cy + innerRadius * Math.sin(endAngle);
    const ix2 = cx + innerRadius * Math.cos(startAngle);
    const iy2 = cy + innerRadius * Math.sin(startAngle);
    return { ...d, ox1, oy1, ox2, oy2, ix1, iy1, ix2, iy2, largeArc };
  });

  return (
    <div style={{ width: "100%", height }} className="relative">
      <svg viewBox={`0 0 400 ${height}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
        {slices.map((s, i) => {
          const path = data.length === 1
            ? `M ${cx + outerRadius} ${cy} A ${outerRadius} ${outerRadius} 0 1 1 ${cx + outerRadius - 0.001} ${cy} M ${cx + innerRadius} ${cy} A ${innerRadius} ${innerRadius} 0 1 0 ${cx + innerRadius - 0.001} ${cy}`
            : `M ${s.ox1} ${s.oy1} A ${outerRadius} ${outerRadius} 0 ${s.largeArc} 1 ${s.ox2} ${s.oy2} L ${s.ix1} ${s.iy1} A ${innerRadius} ${innerRadius} 0 ${s.largeArc} 0 ${s.ix2} ${s.iy2} Z`;
          return <path key={`donut-${i}`} d={path} fill={s.color} stroke={darkMode ? "#1f2937" : "#fff"} strokeWidth="2" />;
        })}
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fill={darkMode ? "#D1D5DB" : "#374151"} fontSize="16" fontWeight="bold">{total}</text>
      </svg>
    </div>
  );
}

// Horizontal bar chart
interface HBarChartProps {
  data: { [key: string]: any }[];
  labelKey: string;
  valueKey: string;
  color?: string;
  height?: number;
  darkMode?: boolean;
}

export function SimpleHBarChart({ data, labelKey, valueKey, color = "#EF4444", height = 250, darkMode = false }: HBarChartProps) {
  if (!data.length) return null;
  const values = data.map(d => d[valueKey] as number);
  const max = Math.max(...values, 1);
  const padding = { top: 10, right: 30, bottom: 10, left: 100 };
  const chartW = 500 - padding.left - padding.right;
  const barGap = height / data.length;
  const barH = barGap * 0.6;

  return (
    <div style={{ width: "100%", height }} className="relative">
      <svg viewBox={`0 0 500 ${height}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
        {data.map((d, i) => {
          const w = (d[valueKey] / max) * chartW;
          const y = padding.top + i * barGap + (barGap - barH) / 2;
          return (
            <g key={`hbar-${i}`}>
              <text x={padding.left - 8} y={y + barH / 2 + 1} textAnchor="end" dominantBaseline="middle" fill={darkMode ? "#9CA3AF" : "#6b7280"} fontSize="10">{d[labelKey]}</text>
              <rect x={padding.left} y={y} width={w} height={barH} fill={color} rx="6" ry="6" />
              <text x={padding.left + w + 6} y={y + barH / 2 + 1} dominantBaseline="middle" fill={darkMode ? "#D1D5DB" : "#374151"} fontSize="11" fontWeight="bold">{d[valueKey]}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// Area chart
interface AreaChartProps {
  data: { [key: string]: any }[];
  xKey: string;
  yKey: string;
  y2Key?: string;
  color?: string;
  color2?: string;
  height?: number;
  darkMode?: boolean;
  xInterval?: number;
}

export function SimpleAreaChart({ data, xKey, yKey, y2Key, color = "#EF4444", color2 = "#F59E0B", height = 200, darkMode = false, xInterval = 4 }: AreaChartProps) {
  if (!data.length) return null;
  const values = data.map(d => d[yKey] as number);
  const values2 = y2Key ? data.map(d => d[y2Key] as number) : [];
  const allValues = [...values, ...values2];
  const max = Math.max(...allValues, 1);
  const min = Math.min(...allValues, 0);
  const range = max - min || 1;
  const padding = { top: 20, right: 20, bottom: 35, left: 40 };
  const chartW = 500 - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const getX = (i: number) => padding.left + (i / (data.length - 1)) * chartW;
  const getY = (v: number) => padding.top + (1 - (v - min) / range) * chartH;

  const areaPoints = data.map((d, i) => `${getX(i)},${getY(d[yKey])}`).join(" ");
  const areaPath = `M ${getX(0)},${getY(data[0][yKey])} ${data.slice(1).map((d, i) => `L ${getX(i + 1)},${getY(d[yKey])}`).join(" ")} L ${getX(data.length - 1)},${padding.top + chartH} L ${getX(0)},${padding.top + chartH} Z`;

  return (
    <div style={{ width: "100%", height }} className="relative">
      <svg viewBox={`0 0 500 ${height}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        {/* Grid */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
          const y = padding.top + (1 - pct) * chartH;
          const val = Math.round(min + pct * range);
          return (
            <g key={`grid-${i}`}>
              <line x1={padding.left} y1={y} x2={500 - padding.right} y2={y} stroke={darkMode ? "#374151" : "#e5e7eb"} strokeDasharray="3 3" />
              <text x={padding.left - 8} y={y + 4} textAnchor="end" fill={darkMode ? "#9CA3AF" : "#6b7280"} fontSize="10">{val}</text>
            </g>
          );
        })}
        {/* Area fill */}
        <path d={areaPath} fill="url(#areaGrad)" />
        {/* Area line */}
        <polyline fill="none" stroke={color} strokeWidth="2.5" points={areaPoints} />
        {/* Second line if provided */}
        {y2Key && (
          <polyline
            fill="none"
            stroke={color2}
            strokeWidth="1.5"
            strokeDasharray="5 5"
            points={data.map((d, i) => `${getX(i)},${getY(d[y2Key])}`).join(" ")}
          />
        )}
        {/* X labels */}
        {data.map((d, i) => {
          if (i % xInterval !== 0 && i !== data.length - 1) return null;
          return <text key={`xl-${i}`} x={getX(i)} y={height - 8} textAnchor="middle" fill={darkMode ? "#9CA3AF" : "#6b7280"} fontSize="10">{d[xKey]}</text>;
        })}
      </svg>
    </div>
  );
}