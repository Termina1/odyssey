import { extname } from "node:path";
import { ChartVariant, type Dataset, type DatasetField, type RichBlock } from "../contracts/index.js";

export type ChartBlock = Extract<RichBlock, { type: "chart" }>;
export type ChartDataset = Pick<Dataset, "id" | "title" | "fields" | "rows"> &
	Partial<Pick<Dataset, "description" | "provenance" | "limitations">>;
export type ChartRow = Dataset["rows"][number];
export type ChartDatum = {
	value: number | number[] | null;
	name?: string;
	symbolSize?: number;
	itemStyle: { color?: string; [key: string]: unknown };
	label?: Record<string, unknown>;
	[key: string]: unknown;
};
export type ChartSeries = { name?: string; type?: string; data: ChartDatum[]; [key: string]: unknown };
export type AxisOption = { data?: string[]; max?: number; min?: number; [key: string]: unknown };
export type ChartOption = {
	animation: boolean;
	color: string[];
	series: ChartSeries[];
	aria: { description: string; [key: string]: unknown };
	legend: { show: boolean; [key: string]: unknown };
	tooltip?: Record<string, unknown>;
	grid?: Record<string, unknown>;
	xAxis: AxisOption;
	yAxis: AxisOption;
	[key: string]: unknown;
};
export type TableValue = {
	series: string;
	value: number | number[] | string | boolean | null;
	missing?: boolean;
	forecast?: boolean;
};
export type TableRow = { category: string; values: TableValue[] };
export type ChartModel = {
	options: ChartOption;
	id?: string;
	title?: string;
	purpose?: string;
	block: ChartBlock;
	categories: string[];
	seriesValues: string[];
	tableRows: TableRow[];
	normalized: boolean;
	hasForecast: boolean;
	kind: string;
	xField?: DatasetField;
	yField?: DatasetField;
	valueField?: DatasetField;
	nameField?: DatasetField;
	sizeField?: DatasetField;
	forecastKey?: string;
	pointColorKey?: string;
	excludedAnnotations?: Array<{ category: string; value: number; note: string }>;
	chartId?: string;
};

export const CHART_VARIANTS = ChartVariant.options;

const PALETTE = ["#d65b43", "#2f6673", "#e4a34b", "#65767b", "#8b6fb1", "#3b8f72"];
const FORECAST_DECAL = Object.freeze({
	symbol: "rect",
	symbolSize: 1,
	color: "rgba(255,255,255,.5)",
	dashArrayX: [1, 0],
	dashArrayY: [1, 0],
	rotation: 0.785398,
});
const ALLOWED_ENCODINGS = new Set([
	"x",
	"y",
	"value",
	"series",
	"color",
	"size",
	"name",
	"source",
	"target",
	"forecast",
]);

export function escapeHtml(value: unknown): string {
	return String(value ?? "")
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}

export function escapeAttribute(value: unknown): string {
	return escapeHtml(value).replaceAll("`", "&#96;");
}

export function slug(value: unknown): string {
	return (
		String(value ?? "item")
			.normalize("NFKD")
			.toLowerCase()
			.replace(/[^a-z0-9\u0400-\u04ff_-]+/gi, "-")
			.replace(/^-+|-+$/g, "") || "item"
	);
}

export function sameLabel(a: unknown, b: unknown): boolean {
	return (
		String(a ?? "")
			.trim()
			.toLocaleLowerCase() ===
		String(b ?? "")
			.trim()
			.toLocaleLowerCase()
	);
}

export function fieldMap(dataset: ChartDataset | null | undefined): Map<string, DatasetField> {
	return new Map((dataset?.fields ?? []).map((field) => [field.key, field]));
}

export function canonical(value: unknown): string {
	if (value === null || value === undefined) return "";
	return typeof value === "boolean" ? (value ? "true" : "false") : String(value);
}

export function uniqueValues(rows: ChartRow[], key: string): string[] {
	const seen = new Set();
	const result = [];
	for (const row of rows) {
		const value = canonical(row[key]);
		if (!seen.has(value)) {
			seen.add(value);
			result.push(value);
		}
	}
	return result;
}

export function numeric(value: unknown, context: string): number {
	const result = typeof value === "number" ? value : Number(value);
	if (!Number.isFinite(result)) throw new Error(`${context} must be numeric; received ${String(value)}`);
	return result;
}

function isForecastField(field: DatasetField | undefined): boolean {
	return Boolean(
		field &&
			(field.type === "boolean" ||
				/forecast|estimate|projection|planned|actual/i.test(field.key) ||
				/forecast|estimate|projection|прогноз/i.test(field.label ?? "")),
	);
}

export function inferForecastKey(dataset: ChartDataset, block: ChartBlock): string | undefined {
	const enc = block.encoding ?? {};
	const explicit = block.forecast?.field ?? enc.forecast;
	if (explicit) return explicit;
	const fields = (dataset?.fields ?? []).filter((field) => isForecastField(field));
	return fields.length === 1 ? fields[0].key : undefined;
}

export function validateChartContract(
	block: ChartBlock,
	dataset: ChartDataset,
): { fields: Map<string, DatasetField>; forecastKey: string | undefined; seriesKey: string | undefined } {
	if (block?.type !== "chart") throw new Error("Chart block is required");
	if (!CHART_VARIANTS.includes(block.variant)) throw new Error(`Unsupported chart variant ${String(block.variant)}`);
	if (!dataset || !Array.isArray(dataset.fields) || !Array.isArray(dataset.rows) || dataset.rows.length === 0)
		throw new Error(`Chart ${block.id ?? "(unnamed)"} has no usable dataset`);
	const fields = fieldMap(dataset);
	const enc = block.encoding;
	if (!enc || typeof enc !== "object" || Array.isArray(enc))
		throw new Error(`Chart ${block.id ?? "(unnamed)"} encoding must be an object`);
	for (const key of Object.keys(enc))
		if (!ALLOWED_ENCODINGS.has(key))
			throw new Error(`Chart ${block.id ?? "(unnamed)"} declares unsupported encoding channel ${key}`);
	for (const key of Object.keys(enc))
		if (enc[key] !== undefined && (typeof enc[key] !== "string" || !fields.has(enc[key])))
			throw new Error(`Chart ${block.id ?? "(unnamed)"} encoding.${key} references unknown field ${String(enc[key])}`);
	const required = {
		line: ["x", "y"],
		area: ["x", "y"],
		bar: ["x", "y"],
		"stacked-bar": ["x", "y"],
		"grouped-bar": ["x", "y"],
		"100%-stacked-bar": ["x", "y"],
		scatter: ["x", "y"],
		bubble: ["x", "y"],
		heatmap: ["x", "y", "value"],
		treemap: [],
		sunburst: [],
		sankey: ["source", "target", "value"],
	}[block.variant];
	for (const key of required)
		if (typeof enc[key] !== "string") throw new Error(`Chart ${block.id ?? "(unnamed)"} requires encoding.${key}`);
	if (["treemap", "sunburst"].includes(block.variant)) {
		if (typeof (enc.value ?? enc.y) !== "string")
			throw new Error(`Chart ${block.id ?? "(unnamed)"} requires encoding.value or encoding.y`);
		if (typeof (enc.name ?? enc.x) !== "string")
			throw new Error(`Chart ${block.id ?? "(unnamed)"} requires encoding.name or encoding.x`);
	}
	const numericKeys = new Set(["value", "size"]);
	if (
		["line", "area", "bar", "stacked-bar", "grouped-bar", "100%-stacked-bar", "scatter", "bubble"].includes(
			block.variant,
		)
	)
		numericKeys.add("y");
	if (["scatter", "bubble"].includes(block.variant)) numericKeys.add("x");
	for (const key of numericKeys) {
		const field = enc[key];
		if (field && fields.get(field)?.type !== "number")
			throw new Error(`Chart ${block.id ?? "(unnamed)"} encoding.${key} must reference a number field`);
	}
	if (enc.forecast && !isForecastField(fields.get(enc.forecast)))
		throw new Error(`Chart ${block.id ?? "(unnamed)"} encoding.forecast must reference a forecast/boolean field`);
	const interaction = block.interaction ?? {};
	for (const key of ["tooltip", "zoom", "legendFilter"] as const)
		if (typeof interaction[key] !== "boolean")
			throw new Error(`Chart ${block.id ?? "(unnamed)"} interaction.${key} must be boolean`);
	const seriesKey = enc.series ?? enc.color;
	const seriesCount = seriesKey ? uniqueValues(dataset.rows, seriesKey).length : 1;
	if (interaction.legendFilter && seriesCount < 2)
		throw new Error(`Chart ${block.id ?? "(unnamed)"} requests legendFilter but has fewer than two series`);
	if (block.annotations !== undefined && !Array.isArray(block.annotations))
		throw new Error(`Chart ${block.id ?? "(unnamed)"} annotations must be an array`);
	return { fields, forecastKey: inferForecastKey(dataset, block), seriesKey };
}

function fieldTitle(field: DatasetField | undefined): string {
	if (!field) return "";
	return field.unit ? `${field.label} (${field.unit})` : field.label;
}

function chartValue(
	value: unknown,
	field: DatasetField | { unit?: string; label?: string } | undefined,
	normalized = false,
): string {
	if (value === null || value === undefined || value === "") return "—";
	const n = Number(value);
	const rounded = Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, "");
	if (
		normalized ||
		field?.unit === "%" ||
		/%|percent|дол/i.test(field?.unit ?? "") ||
		/%|percent|дол/i.test(field?.label ?? "")
	)
		return `${rounded}%`;
	return field?.unit ? `${rounded} ${field.unit}` : rounded;
}

function rowIsForecast(
	row: ChartRow | undefined,
	forecastKey: string | undefined,
	seriesKey: string | undefined,
): boolean {
	if (!row) return false;
	const forecastValue = forecastKey ? row[forecastKey] : undefined;
	if (forecastValue === true || /forecast|estimate|projection|прогноз/i.test(canonical(forecastValue))) return true;
	return Boolean(seriesKey && /forecast|estimate|projection|прогноз/i.test(canonical(row[seriesKey])));
}

function forecastDatum(_row: ChartRow, value: number, isForecast: boolean): ChartDatum {
	const datum: ChartDatum = { value, itemStyle: {} };
	if (isForecast)
		datum.itemStyle = {
			opacity: 0.72,
			decal: FORECAST_DECAL,
			borderColor: "#6d3b32",
			borderWidth: 1,
			borderType: "dashed",
		};
	return datum;
}

function annotationFor(
	_option: ChartOption,
	annotations: ChartBlock["annotations"] = [],
): Record<string, unknown> | undefined {
	const valid = annotations.filter(
		(annotation) =>
			annotation &&
			(annotation.x !== undefined || annotation.y !== undefined) &&
			String(annotation.label ?? "").length <= 48,
	);
	if (!valid.length) return undefined;
	return {
		symbol: "pin",
		symbolSize: 34,
		label: { show: true, color: "#17323a", backgroundColor: "#f3e7cb", padding: [5, 7], borderRadius: 3 },
		data: valid.map((annotation) => ({
			name: String(annotation.label ?? "Note"),
			xAxis: annotation.x,
			yAxis: annotation.y,
		})),
	};
}

function baseOption({
	title,
	interaction,
	legend,
	gridTop = 18,
	gridBottom = 68,
	ariaDescription,
}: {
	title?: string;
	interaction: ChartBlock["interaction"];
	legend: boolean;
	gridTop?: number;
	gridBottom?: number;
	ariaDescription: string;
}): ChartOption {
	return {
		animation: false,
		color: PALETTE,
		backgroundColor: "transparent",
		textStyle: { fontFamily: "Arial, Helvetica, sans-serif", color: "#17323a" },
		aria: { enabled: true, decal: { show: true }, description: ariaDescription },
		title: title ? { show: false, text: title } : undefined,
		legend: legend
			? {
					show: !interaction.legendFilter,
					type: "scroll",
					top: 0,
					left: 0,
					right: 0,
					itemWidth: 16,
					itemHeight: 10,
					textStyle: { color: "#17323a", fontSize: 13 },
				}
			: { show: false },
		tooltip: interaction.tooltip
			? {
					show: true,
					trigger: "axis",
					confine: true,
					backgroundColor: "#17323a",
					borderWidth: 0,
					textStyle: { color: "#fff", fontSize: 13 },
				}
			: { show: false },
		grid: { left: 70, right: 24, top: gridTop, bottom: gridBottom, containLabel: true },
		series: [],
		xAxis: {},
		yAxis: {},
	};
}

function transformCartesian(
	block: ChartBlock,
	dataset: ChartDataset,
	contract: ReturnType<typeof validateChartContract>,
): Omit<ChartModel, "block"> {
	const enc = block.encoding;
	const xKey = enc.x;
	const yKey = enc.y ?? enc.value;
	const xField = contract.fields.get(xKey);
	const yField = contract.fields.get(yKey);
	const declaredSeriesKey = contract.seriesKey;
	const isAnnotationOnly = (row: ChartRow): boolean =>
		Boolean(
			declaredSeriesKey && /^(annotation|note|callout)[-_ ]?only$/i.test(canonical(row[declaredSeriesKey]).trim()),
		);
	const annotationOnlyRows = dataset.rows.filter(isAnnotationOnly);
	const rows = dataset.rows.filter((row) => !isAnnotationOnly(row));
	if (!rows.length)
		throw new Error(`Chart ${block.id ?? "(unnamed)"} has no plottable rows after excluding annotation-only records`);
	const categories = uniqueValues(rows, xKey);
	const remainingSeriesValues = declaredSeriesKey ? uniqueValues(rows, declaredSeriesKey) : [];
	const effectiveSeriesKey = remainingSeriesValues.length > 1 ? declaredSeriesKey : undefined;
	const pointColorKey =
		["line", "area"].includes(block.variant) &&
		!enc.series &&
		enc.color &&
		rows.length === categories.length &&
		uniqueValues(rows, enc.color).length === rows.length
			? enc.color
			: undefined;
	const seriesKey = pointColorKey ? undefined : effectiveSeriesKey;
	const seriesValues = seriesKey ? uniqueValues(rows, seriesKey) : [yField?.label ?? "Value"];
	const pointColorValues = pointColorKey ? uniqueValues(rows, pointColorKey) : [];
	const byCell = new Map();
	for (const row of rows) {
		const cell = `${canonical(row[xKey])}\u0000${seriesKey ? canonical(row[seriesKey]) : "Series"}`;
		if (byCell.has(cell))
			throw new Error(`Chart ${block.id ?? "(unnamed)"} has duplicate x/series cell ${cell.replaceAll("\u0000", "/")}`);
		byCell.set(cell, { row, value: numeric(row[yKey], `Chart ${block.id ?? "(unnamed)"} ${yKey}`) });
	}
	const cellFor = (category: string, seriesName: string): { row: ChartRow; value: number } | undefined =>
		byCell.get(`${category}\u0000${seriesKey ? seriesName : "Series"}`);
	const totals = new Map(
		categories.map((category) => [
			category,
			seriesValues.reduce((sum, series) => sum + (cellFor(category, series)?.value ?? 0), 0),
		]),
	);
	const normalized = block.variant === "100%-stacked-bar";
	const series = seriesValues.map((seriesName, seriesIndex) => {
		const data = categories.map((category) => {
			const cell = cellFor(category, seriesName);
			if (!cell) return { value: null, itemStyle: {} };
			const total = totals.get(category) ?? 0;
			const normalizedValue = normalized ? (total ? (cell.value / total) * 100 : 0) : cell.value;
			const datum = forecastDatum(
				cell.row,
				normalizedValue,
				rowIsForecast(cell.row, contract.forecastKey, pointColorKey ?? seriesKey),
			);
			if (pointColorKey) {
				datum.name = canonical(cell.row[pointColorKey]);
				datum.itemStyle = {
					...datum.itemStyle,
					color: PALETTE[pointColorValues.indexOf(canonical(cell.row[pointColorKey])) % PALETTE.length],
				};
			}
			return datum;
		});
		const output: ChartSeries = {
			name: seriesName,
			type: block.variant.includes("bar") ? "bar" : "line",
			data,
			emphasis: { focus: "series" },
			label: {
				show: true,
				position: block.variant.includes("bar") ? (normalized ? "inside" : "top") : "top",
				color: "#17323a",
				fontSize: 12,
			},
		};
		if (block.variant === "area") output.areaStyle = { opacity: seriesIndex === 0 ? 0.2 : 0.12 };
		if (block.variant === "stacked-bar" || normalized) output.stack = "total";
		if (block.variant === "line" || block.variant === "area") output.symbolSize = 8;
		return output;
	});
	const hasForecast = rows.some((row) => rowIsForecast(row, contract.forecastKey, pointColorKey ?? seriesKey));
	const options = baseOption({
		interaction: block.interaction,
		legend: seriesValues.length > 1,
		gridTop: seriesValues.length > 1 && !block.interaction.legendFilter ? 42 : 18,
		ariaDescription: `${block.title ?? "Chart"}. ${categories
			.map((category) => {
				const values = seriesValues.flatMap((seriesName) => {
					const cell = cellFor(category, seriesName);
					const label = pointColorKey && cell ? canonical(cell.row[pointColorKey]) : seriesName;
					return cell ? [`${label} ${chartValue(cell.value, yField, normalized)}`] : [];
				});
				return `${category}: ${values.join(", ")}`;
			})
			.join("; ")}`,
	});
	options.xAxis = {
		type: "category",
		data: categories,
		name: xField?.label ?? xKey,
		nameLocation: "middle",
		nameGap: 40,
		axisLabel: { color: "#42565b", fontSize: 12, hideOverlap: true, interval: categories.length > 12 ? 1 : 0 },
	};
	options.yAxis = {
		type: "value",
		name: normalized ? "Доля (%)" : fieldTitle(yField),
		nameLocation: "middle",
		nameGap: 52,
		min: normalized ? 0 : undefined,
		max: normalized ? 100 : undefined,
		axisLabel: { color: "#42565b", fontSize: 12, formatter: normalized ? "{value}%" : undefined },
		splitLine: { lineStyle: { color: "#d6dfdf", type: "dashed" } },
	};
	options.series = series;
	if (hasForecast && categories.length) {
		const forecastCategories = categories.filter((category) =>
			rows.some(
				(row) =>
					canonical(row[xKey]) === category && rowIsForecast(row, contract.forecastKey, pointColorKey ?? seriesKey),
			),
		);
		const first = forecastCategories[0];
		const last = forecastCategories.at(-1);
		options.series[0].markArea = {
			silent: true,
			itemStyle: { color: "rgba(228,163,75,.12)" },
			data: [[{ xAxis: first }, { xAxis: last }]],
		};
	}
	const annotation = annotationFor(options, block.annotations);
	if (annotation) options.series[0].markPoint = annotation;
	const tableRows = categories.map((category) => ({
		category,
		values: seriesValues.map((seriesName) => {
			const cell = cellFor(category, seriesName);
			return {
				series: pointColorKey && cell ? canonical(cell.row[pointColorKey]) : seriesName,
				value: cell?.value ?? null,
				missing: !cell,
				forecast: rowIsForecast(cell?.row, contract.forecastKey, pointColorKey ?? seriesKey),
			};
		}),
	}));
	const noteKey = dataset.fields.find((field) => /annotation|note|comment/i.test(field.key))?.key;
	const excludedAnnotations = annotationOnlyRows.map((row) => ({
		category: canonical(row[xKey]),
		value: numeric(row[yKey], `Chart ${block.id ?? "(unnamed)"} ${yKey}`),
		note: noteKey ? canonical(row[noteKey]) : "Excluded from the plotted series because it is not comparable.",
	}));
	return {
		options,
		categories,
		seriesValues,
		tableRows,
		excludedAnnotations,
		xField,
		yField,
		normalized,
		hasForecast,
		forecastKey: contract.forecastKey,
		pointColorKey,
		kind: "cartesian",
	};
}

function transformScatter(
	block: ChartBlock,
	dataset: ChartDataset,
	contract: ReturnType<typeof validateChartContract>,
): Omit<ChartModel, "block"> {
	const enc = block.encoding;
	const xField = contract.fields.get(enc.x);
	const yField = contract.fields.get(enc.y);
	const seriesKey = contract.seriesKey;
	const seriesValues = seriesKey ? uniqueValues(dataset.rows, seriesKey) : ["Series"];
	const sizeField = enc.size ? contract.fields.get(enc.size) : undefined;
	const sizeValues = enc.size
		? dataset.rows.map((row) => numeric(row[enc.size], `Chart ${block.id ?? "(unnamed)"} ${enc.size}`))
		: [1];
	const minSize = Math.min(...sizeValues);
	const maxSize = Math.max(...sizeValues);
	const sizeOf = (value: number): number =>
		block.variant === "bubble" ? (minSize === maxSize ? 20 : 10 + ((value - minSize) / (maxSize - minSize)) * 28) : 12;
	const series = seriesValues.map((seriesName) => ({
		name: seriesName,
		type: "scatter",
		data: dataset.rows
			.filter((row) => !seriesKey || canonical(row[seriesKey]) === seriesName)
			.map((row) => {
				const x = numeric(row[enc.x], `Chart ${block.id ?? "(unnamed)"} ${enc.x}`);
				const y = numeric(row[enc.y], `Chart ${block.id ?? "(unnamed)"} ${enc.y}`);
				const size = enc.size ? sizeOf(numeric(row[enc.size], `Chart ${block.id ?? "(unnamed)"} ${enc.size}`)) : 12;
				return {
					name: enc.name ? canonical(row[enc.name]) : `${x}, ${y}`,
					value: [x, y],
					symbolSize: size,
					itemStyle: {},
					label: { show: true, formatter: enc.name ? canonical(row[enc.name]) : "{b}", position: "top" },
				};
			}),
	}));
	const options = baseOption({
		interaction: block.interaction,
		legend: seriesValues.length > 1,
		gridTop: seriesValues.length > 1 ? 42 : 18,
		ariaDescription: `${block.title ?? "Scatter chart"}. ${dataset.rows.length} observations.`,
	});
	options.xAxis = {
		type: "value",
		name: xField?.label ?? enc.x,
		nameLocation: "middle",
		nameGap: 34,
		axisLabel: { color: "#42565b" },
		splitLine: { lineStyle: { color: "#d6dfdf", type: "dashed" } },
	};
	options.yAxis = {
		type: "value",
		name: fieldTitle(yField),
		nameLocation: "middle",
		nameGap: 50,
		axisLabel: { color: "#42565b" },
		splitLine: { lineStyle: { color: "#d6dfdf", type: "dashed" } },
	};
	if (block.interaction.zoom) options.dataZoom = [{ type: "inside" }, { type: "slider", bottom: 12 }];
	options.series = series;
	const rows = dataset.rows.map((row) => ({
		category: enc.name ? canonical(row[enc.name]) : "Observation",
		values: [
			{
				series: seriesKey ? canonical(row[seriesKey]) : "Series",
				value: [numeric(row[enc.x], enc.x), numeric(row[enc.y], enc.y)],
			},
		],
	}));
	return {
		options,
		categories: rows.map((row) => row.category),
		seriesValues,
		tableRows: rows,
		xField,
		yField,
		normalized: false,
		hasForecast: false,
		kind: "scatter",
		sizeField,
	};
}

function _heatColor(value: number, min: number, max: number): string {
	const ratio = max === min ? 0.5 : Math.max(0, Math.min(1, (value - min) / (max - min)));
	const start = [223, 236, 235];
	const end = [47, 102, 115];
	return `rgb(${start.map((channel, index) => Math.round(channel + (end[index] - channel) * ratio)).join(",")})`;
}

function transformHeatmap(
	block: ChartBlock,
	dataset: ChartDataset,
	contract: ReturnType<typeof validateChartContract>,
): Omit<ChartModel, "block"> {
	const enc = block.encoding;
	const xField = contract.fields.get(enc.x);
	const yField = contract.fields.get(enc.y);
	const valueField = contract.fields.get(enc.value);
	const xs = uniqueValues(dataset.rows, enc.x);
	const ys = uniqueValues(dataset.rows, enc.y);
	const byCell = new Map();
	for (const row of dataset.rows) {
		const key = `${canonical(row[enc.x])}\u0000${canonical(row[enc.y])}`;
		if (byCell.has(key)) throw new Error(`Chart ${block.id ?? "(unnamed)"} has duplicate heatmap cell ${key}`);
		byCell.set(key, numeric(row[enc.value], enc.value));
	}
	const values = [...byCell.values()];
	const min = Math.min(...values);
	const max = Math.max(...values);
	const options = baseOption({
		interaction: block.interaction,
		legend: false,
		gridBottom: 56,
		ariaDescription: `${block.title ?? "Heatmap"}. ${xs.length} by ${ys.length} matrix.`,
	});
	options.xAxis = {
		type: "category",
		data: xs,
		name: xField?.label ?? enc.x,
		nameLocation: "middle",
		nameGap: 36,
		axisLabel: { color: "#42565b" },
	};
	options.yAxis = { type: "category", data: ys, name: yField?.label ?? enc.y, axisLabel: { color: "#42565b" } };
	options.visualMap = { min, max, show: false, calculable: false, inRange: { color: ["#dfeceb", "#2f6673"] } };
	options.series = [
		{
			type: "heatmap",
			data: ys.flatMap((y, yi) =>
				xs.map((x, xi) => ({ value: [xi, yi, byCell.get(`${x}\u0000${y}`) ?? 0], itemStyle: {} })),
			),
			label: { show: true, color: "#17323a" },
			emphasis: { itemStyle: { shadowBlur: 8, shadowColor: "rgba(23,50,58,.3)" } },
		},
	];
	return {
		options,
		categories: xs,
		seriesValues: [valueField?.label ?? enc.value],
		tableRows: ys.map((y) => ({
			category: y,
			values: xs.map((x) => ({ series: x, value: byCell.get(`${x}\u0000${y}`) ?? 0 })),
		})),
		xField,
		yField,
		valueField,
		normalized: false,
		hasForecast: false,
		kind: "heatmap",
	};
}

function transformHierarchy(
	block: ChartBlock,
	dataset: ChartDataset,
	contract: ReturnType<typeof validateChartContract>,
): Omit<ChartModel, "block"> {
	const enc = block.encoding;
	const nameKey = enc.name ?? enc.x;
	const valueKey = enc.value ?? enc.y;
	const nameField = contract.fields.get(nameKey);
	const valueField = contract.fields.get(valueKey);
	const totals = new Map();
	for (const row of dataset.rows)
		totals.set(canonical(row[nameKey]), (totals.get(canonical(row[nameKey])) ?? 0) + numeric(row[valueKey], valueKey));
	const data = [...totals.entries()].map(([name, value]) => ({ name, value }));
	const options = baseOption({
		interaction: block.interaction,
		legend: false,
		gridTop: 8,
		gridBottom: 8,
		ariaDescription: `${block.title ?? block.variant}. ${data.map((entry) => `${entry.name}: ${chartValue(entry.value, valueField)}`).join(", ")}`,
	});
	options.tooltip = block.interaction.tooltip
		? {
				show: true,
				trigger: "item",
				confine: true,
				backgroundColor: "#17323a",
				borderWidth: 0,
				textStyle: { color: "#fff" },
			}
		: { show: false };
	options.series = [
		{
			type: block.variant,
			data: data.map((entry) => ({ value: entry.value, name: entry.name, itemStyle: {} })),
			label: { show: true, color: "#17323a", fontSize: 12 },
			...(block.variant === "sunburst" ? { radius: ["15%", "86%"] } : {}),
		},
	];
	return {
		options,
		categories: data.map((entry) => entry.name),
		seriesValues: [nameField?.label ?? nameKey],
		tableRows: data.map((entry) => ({
			category: entry.name,
			values: [{ series: valueField?.label ?? valueKey, value: entry.value }],
		})),
		nameField,
		valueField,
		normalized: false,
		hasForecast: false,
		kind: "hierarchy",
	};
}

function transformSankey(
	block: ChartBlock,
	dataset: ChartDataset,
	contract: ReturnType<typeof validateChartContract>,
): Omit<ChartModel, "block"> {
	const enc = block.encoding;
	const valueField = contract.fields.get(enc.value);
	const nodeNames = [];
	const nodeSet = new Set();
	const linkTotals = new Map();
	for (const row of dataset.rows) {
		const source = canonical(row[enc.source]);
		const target = canonical(row[enc.target]);
		const value = numeric(row[enc.value], enc.value);
		for (const name of [source, target])
			if (!nodeSet.has(name)) {
				nodeSet.add(name);
				nodeNames.push(name);
			}
		const key = `${source}\u0000${target}`;
		linkTotals.set(key, (linkTotals.get(key) ?? 0) + value);
	}
	const links = [...linkTotals.entries()].map(([key, value]) => {
		const [source, target] = key.split("\u0000");
		return { source, target, value };
	});
	const options = baseOption({
		interaction: block.interaction,
		legend: false,
		gridTop: 8,
		gridBottom: 8,
		ariaDescription: `${block.title ?? "Flow chart"}. ${links.length} flows between ${nodeNames.length} nodes.`,
	});
	options.tooltip = block.interaction.tooltip
		? {
				show: true,
				trigger: "item",
				confine: true,
				backgroundColor: "#17323a",
				borderWidth: 0,
				textStyle: { color: "#fff" },
			}
		: { show: false };
	options.series = [
		{
			type: "sankey",
			data: nodeNames.map((name) => ({ name, value: null, itemStyle: {} })),
			links,
			nodeAlign: "justify",
			draggable: false,
			emphasis: { focus: "adjacency" },
			lineStyle: { color: "#7e9b9f", curveness: 0.45 },
			label: { color: "#17323a", fontSize: 12 },
		},
	];
	return {
		options,
		categories: nodeNames,
		seriesValues: [valueField?.label ?? enc.value],
		tableRows: links.map((link) => ({
			category: `${link.source} → ${link.target}`,
			values: [{ series: valueField?.label ?? enc.value, value: link.value }],
		})),
		valueField,
		normalized: false,
		hasForecast: false,
		kind: "sankey",
	};
}

export function buildChartModel(block: ChartBlock, dataset: ChartDataset): ChartModel {
	const contract = validateChartContract(block, dataset);
	let model: Omit<ChartModel, "block" | "id" | "title" | "purpose" | "chartId">;
	if (["line", "area", "bar", "stacked-bar", "grouped-bar", "100%-stacked-bar"].includes(block.variant))
		model = transformCartesian(block, dataset, contract);
	else if (["scatter", "bubble"].includes(block.variant)) model = transformScatter(block, dataset, contract);
	else if (block.variant === "heatmap") model = transformHeatmap(block, dataset, contract);
	else if (["treemap", "sunburst"].includes(block.variant)) model = transformHierarchy(block, dataset, contract);
	else if (block.variant === "sankey") model = transformSankey(block, dataset, contract);
	else throw new Error(`Unsupported chart variant ${block.variant}`);
	if (block.interaction?.zoom && !["cartesian", "scatter", "heatmap"].includes(model.kind))
		throw new Error(`Chart ${block.id ?? "(unnamed)"} requests zoom for unsupported ${model.kind} chart`);
	if (block.interaction?.zoom && !model.options.dataZoom)
		model.options.dataZoom = [{ type: "inside" }, { type: "slider", bottom: 12 }];
	return { ...model, id: block.id, title: block.title, purpose: block.purpose, block };
}

export function formatModelValue(
	value: unknown,
	field: DatasetField | { unit?: string; label?: string } | undefined,
	normalized = false,
): string {
	return chartValue(value, field, normalized);
}

export function imageMime(path: string, hint: string | undefined): string {
	if (hint) return hint;
	return (
		{
			".png": "image/png",
			".jpg": "image/jpeg",
			".jpeg": "image/jpeg",
			".webp": "image/webp",
			".gif": "image/gif",
			".svg": "image/svg+xml",
		}[extname(path).toLowerCase()] ?? "application/octet-stream"
	);
}

export function sourceUrl(value: unknown): string {
	try {
		const url = new URL(String(value));
		return /^https?:$/.test(url.protocol) ? url.href : "#";
	} catch {
		return "#";
	}
}
