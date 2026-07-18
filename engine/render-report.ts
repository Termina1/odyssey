import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as echarts from "echarts";
import {
  buildChartModel,
  escapeAttribute,
  escapeHtml,
  fieldMap,
  formatModelValue,
  imageMime,
  sameLabel,
  slug,
  sourceUrl,
  type ChartBlock,
  type ChartModel,
} from "./render-model.js";
import { ReportDocument, type Dataset, type RichBlock } from "../contracts/index.js";
import { parseJsonFile, requiredEnv } from "../contracts/runtime.js";

const here = dirname(fileURLToPath(import.meta.url));
const cwd = process.cwd();
const documentPath = resolve(cwd, requiredEnv("DOCUMENT_FILE"));
const outputPath = resolve(cwd, process.env.OUTPUT_PATH ?? "artifacts/report.html");
const document = await parseJsonFile(documentPath, ReportDocument);
const visualById = new Map(document.visualInputs.map((entry) => [entry.requestId, entry]));
const evidenceById = new Map(document.evidence.evidence.map((entry) => [entry.id, entry]));
const sourceById = new Map(document.evidence.sources.map((entry) => [entry.id, entry]));
const evidenceNumber = new Map(document.evidence.evidence.map((entry, index) => [entry.id, index + 1]));
const elementBySection = new Map(document.elements.map((entry) => [entry.sectionId, entry]));
const chartModels = new Map<string, ChartModel>();
const chartOptions: Record<string, ChartModel["options"]> = {};
const imageUris = new Map<string, string>();

function readRelative(path: string): string {
  return resolve(cwd, path);
}

async function loadImageUris(): Promise<void> {
  for (const visual of document.visualInputs) {
    if (visual.status !== "usable" || !visual.image?.localPath) continue;
    const path = readRelative(visual.image.localPath);
    const bytes = await readFile(path);
    imageUris.set(visual.requestId, `data:${imageMime(path, visual.image.mimeType)};base64,${bytes.toString("base64")}`);
  }
}

function paragraphs(body: string): string {
  return String(body ?? "").split(/\n\s*\n/).filter((text) => text.trim()).map((text) => `<p>${escapeHtml(text.trim())}</p>`).join("");
}

function citations(ids: string[] = []): string {
  const links = ids.map((id) => {
    const number = evidenceNumber.get(id);
    const evidence = evidenceById.get(id);
    if (!number) return `<span class="re-citation re-citation-missing" title="Unresolved evidence ${escapeAttribute(id)}">Evidence</span>`;
    return `<a class="re-citation" href="#evidence-${slug(id)}" title="${escapeAttribute(evidence?.claim ?? id)}" aria-label="Evidence ${number}">[${number}]</a>`;
  }).join("");
  return links ? `<div class="re-citations" aria-label="Evidence citations">${links}</div>` : "";
}

function sourceLinks(sourceIds: string[] = []): string {
  return sourceIds.map((sourceId) => {
    const source = sourceById.get(sourceId);
    if (!source) return `<span class="re-source-missing">${escapeHtml(sourceId)}</span>`;
    const href = sourceUrl(source.url);
    return `<a href="${escapeAttribute(href)}" target="_blank" rel="noreferrer">${escapeHtml(source.publisher || source.title)}</a>`;
  }).join("");
}

function fieldLabel(dataset: Dataset | null, key: string): string {
  return fieldMap(dataset).get(key)?.label ?? key;
}

function makeChartModel(block: ChartBlock): ChartModel {
  const visual = visualById.get(block.datasetRequestId);
  if (!visual || visual.status !== "usable" || !visual.dataset) throw new Error(`Chart ${block.id} has no usable dataset ${block.datasetRequestId}`);
  const model = buildChartModel(block, visual.dataset);
  const chartId = `chart-${slug(block.id)}`;
  model.chartId = chartId;
  chartModels.set(chartId, model);
  chartOptions[chartId] = model.options;
  return model;
}

function renderChartDataTable(model: ChartModel): string {
  const block = model.block;
  if (!model.tableRows?.length) return "";
  const series = model.seriesValues ?? [];
  const firstHeader = model.kind === "sankey" ? "Flow" : model.kind === "heatmap" ? (model.valueField?.label ?? "Value") : (model.xField?.label ?? "Category");
  const head = `<tr><th scope="col">${escapeHtml(firstHeader)}</th>${series.map((name) => `<th scope="col">${escapeHtml(name)}</th>`).join("")}</tr>`;
  const rows = model.tableRows.map((row) => `<tr><th scope="row">${escapeHtml(row.category)}</th>${(row.values ?? []).map((value) => {
    const raw = Array.isArray(value.value) ? value.value.join(", ") : value.value;
    const text = Array.isArray(value.value) ? raw : formatModelValue(raw, model.normalized ? { unit: "%" } : (model.yField ?? model.valueField));
    const forecast = value.forecast ? ` <span class="re-forecast-inline">forecast</span>` : "";
    return `<td data-value="${escapeAttribute(raw)}">${escapeHtml(text)}${forecast}</td>`;
  }).join("")}</tr>`).join("");
  return `<details class="re-chart-data"><summary>Data table</summary><div class="re-table-wrap"><table><thead>${head}</thead><tbody>${rows}</tbody></table></div></details>`;
}

function chartSummary(model: ChartModel): string {
  const block = model.block;
  const rows = (model.tableRows ?? []).slice(0, 12).map((row) => {
    const values = (row.values ?? []).filter((value) => !value.missing).map((value) => {
      const raw = Array.isArray(value.value) ? value.value.join(", ") : value.value;
      const formatted = Array.isArray(value.value) ? raw : formatModelValue(raw, model.normalized ? { unit: "%" } : (model.yField ?? model.valueField));
      return `${value.series}: ${formatted}${value.forecast ? " (forecast)" : ""}`;
    }).join("; ");
    return `${row.category}: ${values}`;
  });
  return `${escapeHtml(block.title ?? "Chart")} — ${escapeHtml(rows.join(". "))}`;
}

function renderChart(block: ChartBlock): string {
  const model = makeChartModel(block);
  const chartId = model.chartId ?? `chart-${slug(block.id)}`;
  const svgChart = echarts.init(null, null, { renderer: "svg", ssr: true, width: 960, height: 430 });
  svgChart.setOption(model.options as Parameters<typeof svgChart.setOption>[0]);
  const svg = svgChart.renderToSVGString();
  svgChart.dispose();
  const controls = [];
  if (block.interaction?.legendFilter && (model.seriesValues?.length ?? 0) > 1) {
    controls.push(`<div class="re-legend-controls" role="group" aria-label="Filter series">${model.seriesValues.map((series) => `<button type="button" class="re-series-toggle" data-series="${escapeAttribute(series)}" aria-pressed="true"><span aria-hidden="true" class="re-series-swatch"></span>${escapeHtml(series)}</button>`).join("")}</div>`);
  }
  if (block.interaction?.zoom) controls.push(`<div class="re-chart-actions" role="group" aria-label="Chart zoom"><button type="button" data-zoom="out">−</button><button type="button" data-zoom="reset">Reset</button><button type="button" data-zoom="in">+</button></div>`);
  const forecast = model.hasForecast ? `<span class="re-forecast-badge">Forecast / прогноз</span>` : "";
  const annotations = (block.annotations ?? []).map((annotation) => `<p class="re-annotation"><strong>${escapeHtml(annotation.label ?? "Annotation")}</strong>${annotation.x !== undefined ? ` · ${escapeHtml(annotation.x)}` : ""}${annotation.y !== undefined ? ` · ${escapeHtml(annotation.y)}` : ""}</p>`).join("");
  const excludedAnnotations = (model.excludedAnnotations ?? []).map((annotation) => `<p class="re-annotation re-annotation-excluded"><strong>Несопоставимый ориентир: ${escapeHtml(annotation.category)} — ${escapeHtml(formatModelValue(annotation.value, model.yField))}.</strong> ${escapeHtml(annotation.note)}</p>`).join("");
  const interactionText = [block.interaction?.tooltip ? "tooltip" : "", block.interaction?.zoom ? "zoom" : "", block.interaction?.legendFilter && (model.seriesValues?.length ?? 0) > 1 ? "legend filter" : ""].filter(Boolean).join(", ");
  return `<div class="re-chart-shell" data-chart="${escapeAttribute(chartId)}" data-chart-variant="${escapeAttribute(block.variant)}" aria-label="${escapeAttribute(block.title ?? "Chart")}">
    <div class="re-chart-meta">${forecast}${interactionText ? `<span class="re-interaction-hint">Interactive: ${escapeHtml(interactionText)}</span>` : ""}</div>
    ${controls.join("")}
    <div class="re-chart" id="${escapeAttribute(chartId)}" role="img" aria-label="${escapeAttribute(chartSummary(model))}">${svg}</div>
    <p class="re-chart-summary" data-chart-summary>${chartSummary(model)}</p>
    ${annotations}
    ${excludedAnnotations}
    ${renderChartDataTable(model)}
  </div>`;
}

function renderMetricStrip(block: Extract<RichBlock, { type: "metric-strip" }>): string {
  const visual = visualById.get(block.datasetRequestId);
  if (!visual?.dataset) throw new Error(`Metric block ${block.id} has no usable dataset`);
  const dataset = visual.dataset;
  const fields = fieldMap(dataset);
  const metrics = block.metrics.map((metric) => {
    const matches = dataset.rows.filter((row) => Object.entries(metric.where).every(([key, value]) => row[key] === value));
    if (matches.length !== 1) throw new Error(`Metric ${block.id}/${metric.label} resolved ${matches.length} rows`);
    const value = matches[0][metric.valueField];
    if (value === undefined || value === null || value === "") throw new Error(`Metric ${block.id}/${metric.label} has no value`);
    const field = fields.get(metric.valueField);
    return `<div class="re-metric"><strong data-metric-value="${escapeAttribute(value)}">${escapeHtml(value)}</strong>${field?.unit ? `<span class="re-metric-unit">${escapeHtml(field.unit)}</span>` : ""}<span>${escapeHtml(metric.label)}</span></div>`;
  }).join("");
  return `<div class="re-metrics">${metrics}</div>`;
}

function renderTable(block: Extract<RichBlock, { type: "table" }>): string {
  const visual = visualById.get(block.datasetRequestId);
  if (!visual?.dataset) throw new Error(`Table block ${block.id} has no usable dataset`);
  const dataset = visual.dataset; const fields = fieldMap(dataset); const columns = block.columns ?? dataset.fields.map((field) => field.key);
  const head = columns.map((key) => { const field = fields.get(key); return `<th scope="col">${escapeHtml(field?.label ?? key)}${field?.unit ? ` <span class="re-unit">(${escapeHtml(field.unit)})</span>` : ""}</th>`; }).join("");
  const body = dataset.rows.map((row) => `<tr>${columns.map((key) => `<td>${escapeHtml(row[key] === undefined || row[key] === null ? "" : row[key])}</td>`).join("")}</tr>`).join("");
  return `<div class="re-table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function renderBlock(block: RichBlock, moduleHeadline: string): string {
  const duplicateTitle = sameLabel(block.title, moduleHeadline);
  let body = "";
  if (block.type === "chart") body = renderChart(block);
  else if (block.type === "metric-strip") body = renderMetricStrip(block);
  else if (block.type === "table") body = renderTable(block);
  else if (block.type === "comparison") body = `<div class="re-comparison">${(block.columns ?? []).map((column) => `<article><h5>${escapeHtml(column.title)}</h5>${paragraphs(column.body)}</article>`).join("")}</div>`;
  else if (block.type === "timeline") body = `<ol class="re-timeline-items">${block.items.map((entry) => `<li><b>${escapeHtml(entry.label)}</b><span>${escapeHtml(entry.body)}</span></li>`).join("")}</ol>`;
  else if (block.type === "flow") body = `<ol class="re-flow-items">${block.steps.map((entry) => `<li><b>${escapeHtml(entry.label)}</b><span>${escapeHtml(entry.body)}</span></li>`).join("")}</ol>`;
  else if (block.type === "matrix") body = `<div class="re-matrix">${(block.cells ?? []).map((cell) => `<article><small>${escapeHtml(cell.x)} × ${escapeHtml(cell.y)}</small><h5>${escapeHtml(cell.title)}</h5><p>${escapeHtml(cell.body)}</p></article>`).join("")}</div>${block.annotations?.length ? `<ul class="re-matrix-notes">${block.annotations.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}</ul>` : ""}`;
  else if (block.type === "callout") body = `<div class="re-callout re-callout-${escapeAttribute(block.tone ?? "insight")}" role="note">${paragraphs(block.body)}${block.bullets?.length ? `<ul>${block.bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}</div>`;
  else if (block.type === "quote") body = `<blockquote><p>${escapeHtml(block.quote)}</p><cite>${escapeHtml(block.attribution)}</cite></blockquote>`;
  else if (block.type === "image") {
    const visual = visualById.get(block.imageRequestId);
    if (!visual?.image || !imageUris.has(block.imageRequestId)) throw new Error(`Image block ${block.id} has no usable local image`);
    body = `<figure><img src="${imageUris.get(block.imageRequestId)}" alt="${escapeAttribute(block.alt || visual.image.alt || "")}" loading="lazy"><figcaption>${escapeHtml(block.caption || visual.image.caption || "")}</figcaption></figure>`;
  } else { const unsupported: never = block; throw new Error(`Unsupported block type ${String(unsupported)}`); }
  return `<aside class="re-block re-block-${escapeAttribute(block.type)}" id="block-${escapeAttribute(slug(block.id))}"><header><span class="re-block-kind">${escapeHtml(block.type)}</span><h4${duplicateTitle ? " class=\"re-sr-only\"" : ""}>${escapeHtml(block.title)}</h4><p>${escapeHtml(block.purpose)}</p></header>${body}${citations(block.evidenceIds)}</aside>`;
}

function renderSources(): string {
  const evidenceEntries = (document.evidence?.evidence ?? []).map((entry) => `<article id="evidence-${escapeAttribute(slug(entry.id))}"><h3><span class="re-evidence-number">[${evidenceNumber.get(entry.id)}]</span> ${escapeHtml(entry.claim)}</h3>${entry.caveat ? `<p>${escapeHtml(entry.caveat)}</p>` : ""}<div class="re-source-links">${sourceLinks(entry.sourceIds)}</div></article>`).join("");
  const sourceEntries = (document.evidence?.sources ?? []).map((source) => `<article id="source-${escapeAttribute(slug(source.id))}"><h3>${escapeHtml(source.title)}</h3><p>${escapeHtml(source.publisher)}${source.date ? ` · ${escapeHtml(source.date)}` : ""}</p><a href="${escapeAttribute(sourceUrl(source.url))}" target="_blank" rel="noreferrer">${escapeHtml(source.url)}</a></article>`).join("");
  return `<section class="re-sources" id="sources"><div class="re-source-intro"><span class="re-kicker">Traceability</span><h2>Evidence and sources</h2><p>Every claim and visual is linked to its evidence record. Forecasts, proxies, and measurement limits remain visible rather than being smoothed into a single market number.</p></div><div class="re-evidence-list">${evidenceEntries}</div><h2 class="re-source-index-title">Source index</h2><div class="re-source-list">${sourceEntries}</div></section>`;
}

function renderDocument(): string {
  const metaText = (key: string): string | undefined => {
    const value = document.meta[key];
    return typeof value === "string" ? value : undefined;
  };
  const title = metaText("title") ?? document.plan.title ?? "Report";
  const thesis = metaText("thesis") ?? document.plan.thesis ?? "";
  const readerQuestion = metaText("readerQuestion") ?? document.plan.readerQuestion ?? "";
  const sections = (document.sections ?? []).map((section, sectionIndex) => {
    const blocks = new Map((elementBySection.get(section.sectionId)?.blocks ?? []).map((block) => [block.id, block]));
    const layout = document.experience?.sections?.[section.sectionId]?.layout ?? "essay";
    const modules = (section.modules ?? []).map((module) => `<article class="re-module re-${escapeAttribute(module.layout)}" id="beat-${escapeAttribute(slug(module.beatId))}"><div class="re-copy"><h3>${escapeHtml(module.headline)}</h3><div class="re-prose">${paragraphs(module.body)}</div>${module.caveat ? `<aside class="re-caveat" role="note"><strong>Caveat</strong>${escapeHtml(module.caveat)}</aside>` : ""}${citations(module.evidenceIds)}</div>${module.blockIds?.length ? `<div class="re-visuals">${module.blockIds.map((id) => blocks.get(id)).filter((block): block is RichBlock => block !== undefined).map((block) => renderBlock(block, module.headline)).join("")}</div>` : ""}</article>`).join("");
    return `<section class="re-section re-layout-${escapeAttribute(layout)}" id="section-${escapeAttribute(slug(section.sectionId))}"><header class="re-section-head"><span class="re-section-index">${String(sectionIndex + 1).padStart(2, "0")}</span><h2>${escapeHtml(section.title)}</h2><p>${escapeHtml(section.dek)}</p><strong>${escapeHtml(section.openingClaim)}</strong></header>${modules}${section.handoff ? `<p class="re-handoff"><span>Continue</span><strong>${escapeHtml(section.handoff)}</strong><i aria-hidden="true">→</i></p>` : ""}</section>`;
  }).join("");
  const sectionList = document.sections;
  const navLinks = sectionList.map((section, index) => `<a class="re-nav-link" data-section-index="${index}" data-section-title="${escapeAttribute(section.title)}" href="#section-${escapeAttribute(slug(section.sectionId))}"><span>${String(index + 1).padStart(2, "0")}</span>${escapeHtml(section.title)}</a>`).join("");
  const nav = sectionList.length > 5
    ? `<nav class="re-nav re-nav-compact" data-nav-mode="compact" data-section-count="${sectionList.length}" aria-label="Report sections"><div class="re-nav-compact-inner"><details class="re-toc"><summary>Содержание</summary><div class="re-toc-panel">${navLinks}</div></details><div class="re-current-section" aria-live="polite"><span data-current-index>01 / ${String(sectionList.length).padStart(2, "0")}</span><strong data-current-title>${escapeHtml(sectionList[0]?.title ?? "")}</strong></div><div class="re-nav-step"><a data-nav-prev aria-label="Previous chapter" aria-disabled="true">←</a><a data-nav-next href="#section-${escapeAttribute(slug(sectionList[1]?.sectionId ?? sectionList[0]?.sectionId ?? ""))}" aria-label="Next chapter">→</a></div></div><div class="re-reading-progress" aria-hidden="true"><i></i></div></nav>`
    : `<nav class="re-nav" data-nav-mode="tabs" data-section-count="${sectionList.length}" aria-label="Report sections"><div class="re-nav-inner">${navLinks}</div></nav>`;
  return `<div class="re-shell" data-odyssey="1"><header class="re-hero"><div class="re-hero-inner"><p class="re-eyebrow">Evidence-led report · typed renderer</p><h1>${escapeHtml(title)}</h1><p class="re-thesis">${escapeHtml(thesis)}</p><p class="re-question"><span>Reader question</span>${escapeHtml(readerQuestion)}</p></div></header>${nav}<main>${sections}</main>${renderSources()}</div>`;
}

const css = `
:root{--bg:#f4f0e7;--paper:#fffdf8;--ink:#17323a;--muted:#5d6d70;--accent:#d65b43;--teal:#2f6673;--line:#c8d2d0;--cream:#f3e7cb;--shadow:0 10px 28px rgba(23,50,58,.08);--radius:10px}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.65 Arial,Helvetica,sans-serif}a{color:var(--teal)}button{font:inherit}button:focus-visible,a:focus-visible,summary:focus-visible{outline:3px solid #e4a34b;outline-offset:3px}.re-sr-only{position:absolute!important;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}.re-shell{max-width:1500px;margin:0 auto;background:var(--paper);box-shadow:0 0 0 1px rgba(23,50,58,.08)}.re-hero{background:#17323a;color:#fff;padding:clamp(56px,9vw,124px) clamp(22px,7vw,116px) clamp(48px,7vw,92px)}.re-hero-inner{max-width:1180px;margin:auto}.re-eyebrow,.re-kicker,.re-block-kind{font-size:.72rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase}.re-eyebrow{color:#f2c286}.re-hero h1{font-size:clamp(2.7rem,6.7vw,6.5rem);line-height:.96;letter-spacing:-.045em;max-width:1150px;margin:.24em 0 .36em}.re-thesis{font-size:clamp(1.08rem,1.75vw,1.5rem);line-height:1.48;max-width:980px;color:#eaf0ed;margin:0}.re-question{display:flex;gap:12px;flex-wrap:wrap;max-width:900px;margin:28px 0 0;color:#f3d6ae}.re-question span{font-weight:700;text-transform:uppercase;letter-spacing:.1em;font-size:.72rem;padding-top:.35em}.re-nav{position:sticky;top:0;z-index:20;background:rgba(255,253,248,.96);border-bottom:1px solid var(--line);box-shadow:0 2px 12px rgba(23,50,58,.07);backdrop-filter:blur(12px)}.re-nav-inner{display:flex;gap:0;max-width:1320px;margin:auto;overflow-x:auto;scrollbar-width:thin}.re-nav a{display:block;white-space:nowrap;text-decoration:none;color:var(--ink);padding:14px 18px;border-right:1px solid var(--line);font-size:.9rem}.re-nav a:first-child{border-left:1px solid var(--line)}.re-nav a span{display:block;color:var(--accent);font-size:.72rem;letter-spacing:.1em;font-weight:700}.re-nav-link[aria-current=true]{background:#edf3f1;box-shadow:inset 0 -3px 0 var(--accent)}.re-nav-compact-inner{position:relative;display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:14px;max-width:1320px;margin:auto;padding:9px 18px}.re-toc{position:relative}.re-toc summary{list-style:none;cursor:pointer;border:1px solid var(--line);border-radius:5px;padding:7px 11px;font-size:.82rem;font-weight:700;color:var(--teal)}.re-toc summary::-webkit-details-marker{display:none}.re-toc-panel{position:absolute;z-index:30;top:calc(100% + 10px);left:0;width:min(760px,calc(100vw - 36px));max-height:min(70vh,620px);overflow:auto;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));background:var(--paper);border:1px solid var(--line);border-radius:8px;box-shadow:0 18px 50px rgba(23,50,58,.2)}.re-toc-panel .re-nav-link{white-space:normal;border:0;border-bottom:1px solid var(--line);padding:11px 13px;line-height:1.3}.re-toc-panel .re-nav-link:first-child{border-left:0}.re-current-section{min-width:0;display:flex;align-items:baseline;gap:12px}.re-current-section span{flex:0 0 auto;color:var(--accent);font-size:.72rem;letter-spacing:.08em;font-weight:700}.re-current-section strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.9rem}.re-nav-step{display:flex;gap:5px}.re-nav-step a{display:grid;place-items:center;width:34px;height:34px;padding:0;border:1px solid var(--line);border-radius:5px;font-size:1rem}.re-nav-step a:first-child{border-left:1px solid var(--line)}.re-nav-step a[aria-disabled=true]{opacity:.35;pointer-events:none}.re-reading-progress{position:absolute;left:0;right:0;bottom:-1px;height:3px;background:transparent}.re-reading-progress i{display:block;width:0;height:100%;background:var(--accent);transition:width .18s ease}.re-section{padding:clamp(52px,8vw,104px) clamp(20px,6vw,88px);border-bottom:1px solid var(--line)}.re-section-head{max-width:1000px;margin:0 auto clamp(36px,6vw,70px)}.re-section-index{font-size:.78rem;color:var(--accent);letter-spacing:.16em;font-weight:700}.re-section-head h2{font-size:clamp(2rem,4.1vw,4.35rem);letter-spacing:-.035em;line-height:1.03;margin:.2em 0 .28em}.re-section-head>p{color:var(--muted);font-size:clamp(1rem,1.5vw,1.25rem);max-width:850px;margin:0}.re-section-head>strong{display:block;font-size:clamp(1.03rem,1.7vw,1.35rem);line-height:1.45;max-width:920px;margin-top:24px}.re-module{display:grid;grid-template-columns:minmax(0,1fr);gap:32px;max-width:1240px;margin:0 auto 72px}.re-module.re-split,.re-module.re-visual-first{grid-template-columns:minmax(260px,.76fr) minmax(440px,1.24fr);align-items:start}.re-visual-first .re-copy{order:2}.re-copy h3{font-size:clamp(1.45rem,2.5vw,2.15rem);letter-spacing:-.02em;line-height:1.1;margin:0 0 20px}.re-prose{font-size:1.05rem;max-width:720px}.re-prose p{margin:0 0 1.15em}.re-caveat{margin-top:24px;padding:13px 0 13px 16px;border-left:3px solid #e4a34b;color:#5d6d70;font-size:.94rem}.re-caveat strong{display:block;color:var(--ink);font-size:.72rem;text-transform:uppercase;letter-spacing:.12em;margin-bottom:5px}.re-visuals{min-width:0}.re-block{background:var(--paper);border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--shadow);padding:clamp(18px,2.5vw,30px);overflow:hidden}.re-block header{margin-bottom:18px}.re-block-kind{color:var(--accent)}.re-block h4{font-size:clamp(1.2rem,2vw,1.65rem);line-height:1.15;margin:.28em 0 .3em}.re-block header p{margin:0;color:var(--muted);font-size:.92rem;line-height:1.45}.re-chart-shell{min-width:0}.re-chart-meta{display:flex;gap:10px;align-items:center;flex-wrap:wrap;min-height:27px;margin:2px 0 8px}.re-forecast-badge{background:var(--cream);color:#67481e;border:1px solid #dfbe82;border-radius:4px;font-size:.72rem;font-weight:700;letter-spacing:.06em;padding:4px 7px;text-transform:uppercase}.re-interaction-hint{color:var(--muted);font-size:.75rem}.re-chart{height:430px;width:100%;min-width:0}.re-chart>svg{width:100%;height:100%;display:block}.re-legend-controls{display:flex;gap:7px;flex-wrap:wrap;margin:0 0 8px}.re-series-toggle{border:1px solid var(--line);border-radius:99px;background:#fffdf8;color:var(--ink);padding:5px 9px;cursor:pointer;font-size:.78rem}.re-series-toggle[aria-pressed=false]{opacity:.5;text-decoration:line-through}.re-series-swatch{display:inline-block;width:10px;height:10px;border-radius:50%;background:var(--accent);margin-right:5px;vertical-align:-1px}.re-series-toggle:nth-child(2) .re-series-swatch{background:var(--teal)}.re-series-toggle:nth-child(3) .re-series-swatch{background:#e4a34b}.re-chart-actions{display:flex;gap:5px;justify-content:flex-end;margin:0 0 6px}.re-chart-actions button{border:1px solid var(--line);border-radius:4px;background:#fffdf8;color:var(--ink);padding:3px 9px;cursor:pointer}.re-chart-summary{margin:7px 0 0;color:var(--muted);font-size:.84rem;line-height:1.4}.re-annotation{margin:10px 0 0;padding:9px 11px;background:#f8f0df;border-left:3px solid #e4a34b;color:#67481e;font-size:.84rem}.re-chart-data{margin-top:12px;border-top:1px solid var(--line);padding-top:8px}.re-chart-data summary{cursor:pointer;color:var(--teal);font-size:.83rem;font-weight:700}.re-table-wrap{width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch}.re-table-wrap table{min-width:100%;width:max-content;border-collapse:collapse;font-size:.88rem}.re-table-wrap th,.re-table-wrap td{text-align:left;padding:9px 10px;border-bottom:1px solid var(--line);vertical-align:top}.re-table-wrap th{font-weight:700;color:var(--ink);background:#f3f6f3}.re-unit{font-weight:400;color:var(--muted);font-size:.74em}.re-forecast-inline{color:#8b5b20;font-size:.72em;font-weight:700;white-space:nowrap}.re-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:10px}.re-metric{padding:16px;border-top:4px solid var(--accent);background:#f3f6f3;min-width:0}.re-metric strong{font-size:clamp(1.35rem,3vw,2.1rem);line-height:1.1;display:inline-block;overflow-wrap:anywhere}.re-metric-unit{font-size:.85rem;color:var(--muted);margin-left:5px}.re-metric>span:last-child{display:block;color:var(--muted);font-size:.82rem;margin-top:7px}.re-comparison,.re-matrix{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px}.re-comparison article,.re-matrix article{padding:16px;border:1px solid var(--line);background:#f8f8f3}.re-comparison h5,.re-matrix h5{font-size:1rem;line-height:1.2;margin:0 0 7px}.re-matrix small{color:var(--accent);font-weight:700}.re-matrix p{font-size:.9rem;margin-bottom:0}.re-matrix-notes{padding-left:20px;color:var(--muted);font-size:.9rem}.re-timeline-items,.re-flow-items{margin:0;padding:0;list-style:none}.re-timeline-items li,.re-flow-items li{display:grid;grid-template-columns:minmax(90px,.35fr) 1fr;gap:16px;padding:14px 0;border-bottom:1px solid var(--line)}.re-timeline-items b,.re-flow-items b{color:var(--accent)}.re-callout{padding:18px 20px;border-left:4px solid var(--accent);background:#f8f0df}.re-callout-warning{border-color:#a86c2b}.re-callout-decision{border-color:var(--teal)}.re-callout-scope{border-color:#7b6c9a}.re-callout p{margin-top:0}.blockquote,blockquote{margin:0;padding:18px 20px;border-left:4px solid var(--teal);background:#edf3f1}.blockquote p,blockquote p{font-size:1.15rem;margin-top:0}.blockquote cite,blockquote cite{color:var(--muted)}figure{margin:0}figure img{display:block;width:100%;height:auto}figcaption{font-size:.83rem;color:var(--muted);margin-top:8px}.re-citations{display:flex;flex-wrap:wrap;gap:6px;margin-top:18px}.re-citation{font-size:.74rem;color:var(--teal);background:#e5f0ed;border-radius:4px;padding:4px 7px;text-decoration:none}.re-citation-missing,.re-source-missing{color:#8a4d36}.re-handoff{display:flex;align-items:center;gap:10px;max-width:1240px;margin:0 auto;padding:14px 0;color:var(--teal);border-top:1px solid var(--line)}.re-handoff span{font-size:.72rem;text-transform:uppercase;letter-spacing:.12em;font-weight:700;color:var(--accent)}.re-handoff strong{font-size:.97rem}.re-handoff i{font-style:normal;font-size:1.35rem}.re-sources{padding:clamp(48px,7vw,92px) clamp(20px,6vw,88px);background:#e8eeeb}.re-source-intro{max-width:900px;margin-bottom:38px}.re-source-intro h2,.re-source-index-title{font-size:clamp(2rem,3.6vw,3.5rem);line-height:1.05;letter-spacing:-.03em;margin:.25em 0}.re-source-intro p{color:var(--muted);max-width:760px}.re-evidence-list article,.re-source-list article{padding:16px 0;border-bottom:1px solid #bdccca}.re-evidence-list h3,.re-source-list h3{font-size:1rem;line-height:1.35;margin:0}.re-evidence-list p,.re-source-list p{color:var(--muted);font-size:.9rem;margin:7px 0}.re-evidence-number{color:var(--accent)}.re-source-links{display:flex;flex-wrap:wrap;gap:12px;font-size:.84rem}.re-source-list a{word-break:break-word}.re-source-index-title{font-size:1.65rem;margin-top:54px}@media(max-width:900px){.re-module.re-split,.re-module.re-visual-first{grid-template-columns:1fr}.re-visual-first .re-copy{order:0}.re-chart{height:350px}}@media(max-width:600px){body{font-size:15px}.re-nav-compact-inner{gap:8px;padding:7px 9px}.re-toc summary{font-size:0;width:38px;height:34px;padding:0;display:grid;place-items:center}.re-toc summary:after{content:'☰';font-size:1rem}.re-toc-panel{position:fixed;top:49px;left:8px;right:8px;width:auto;max-height:calc(100vh - 65px);grid-template-columns:1fr}.re-current-section{display:block}.re-current-section span{display:block;line-height:1.1}.re-current-section strong{display:block;font-size:.8rem}.re-nav-step a{width:31px;height:31px}.re-hero{padding:42px 18px 38px}.re-hero{padding:42px 18px 38px}.re-hero h1{font-size:clamp(2.35rem,12vw,4rem)}.re-thesis{font-size:1.03rem}.re-question{display:block}.re-question span{display:block;margin-bottom:4px}.re-nav a{padding:11px 14px;font-size:.82rem}.re-section{padding:44px 16px}.re-section-head{margin-bottom:34px}.re-section-head h2{font-size:clamp(1.9rem,10vw,3rem)}.re-module{gap:22px;margin-bottom:52px}.re-copy h3{font-size:1.55rem}.re-prose{font-size:1rem}.re-block{padding:16px}.re-chart{height:310px}.re-chart-summary{font-size:.8rem}.re-table-wrap table{font-size:.78rem}.re-timeline-items li,.re-flow-items li{grid-template-columns:1fr;gap:3px}.re-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.re-metric{padding:12px}.re-metric strong{font-size:1.3rem}.re-handoff{align-items:flex-start}.re-sources{padding:44px 16px}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
`;

await loadImageUris();
const body = renderDocument();
const echartsRuntime = await readFile(resolve(here, "../node_modules/echarts/dist/echarts.min.js"), "utf8");
const safeOptions = JSON.stringify(chartOptions).replace(/</g, "\\u003c");
const client = `(()=>{const options=${safeOptions};const charts=new Map();const hydrate=()=>{for(const [id,option] of Object.entries(options)){const node=document.getElementById(id);if(!node||!window.echarts||charts.has(id))continue;try{node.innerHTML='';const chart=window.echarts.init(node,null,{renderer:'svg'});chart.setOption(option);charts.set(id,chart);const ro=window.ResizeObserver?new ResizeObserver(()=>chart.resize()):null;if(ro)ro.observe(node);const shell=node.closest('[data-chart]');if(!shell)continue;shell.querySelectorAll('[data-series]').forEach(button=>button.addEventListener('click',()=>{const name=button.getAttribute('data-series');const pressed=button.getAttribute('aria-pressed')==='true';button.setAttribute('aria-pressed',String(!pressed));chart.dispatchAction({type:pressed?'legendUnSelect':'legendSelect',name});}));shell.querySelectorAll('[data-zoom]').forEach(button=>button.addEventListener('click',()=>{const action=button.getAttribute('data-zoom');const current=chart.getOption().dataZoom?.[0]||{start:0,end:100};if(action==='reset')chart.dispatchAction({type:'dataZoom',start:0,end:100});else{const span=Math.max(10,Number(current.end)-Number(current.start));const delta=span*.2;const start=action==='in'?Math.min(90,Number(current.start)+delta/2):Math.max(0,Number(current.start)-delta/2);const end=action==='in'?Math.max(start+10,Number(current.end)-delta/2):Math.min(100,Number(current.end)+delta/2);chart.dispatchAction({type:'dataZoom',start,end});}}));}catch(error){node.setAttribute('data-render-error',String(error));}}};const initNav=()=>{const nav=document.querySelector('.re-nav');if(!nav)return;const links=[...nav.querySelectorAll('.re-nav-link')];const sections=links.map(link=>document.querySelector(link.getAttribute('href')));const currentIndex=nav.querySelector('[data-current-index]');const currentTitle=nav.querySelector('[data-current-title]');const previous=nav.querySelector('[data-nav-prev]');const next=nav.querySelector('[data-nav-next]');const progress=nav.querySelector('.re-reading-progress i');let active=-1;const setActive=index=>{if(index===active||index<0)return;active=index;links.forEach((link,i)=>i===index?link.setAttribute('aria-current','true'):link.removeAttribute('aria-current'));if(currentIndex)currentIndex.textContent=String(index+1).padStart(2,'0')+' / '+String(links.length).padStart(2,'0');if(currentTitle)currentTitle.textContent=links[index]?.dataset.sectionTitle||'';for(const [control,target] of [[previous,links[index-1]],[next,links[index+1]]]){if(!control)continue;if(target){control.href=target.href;control.removeAttribute('aria-disabled')}else{control.removeAttribute('href');control.setAttribute('aria-disabled','true')}}if(progress)progress.style.width=((index+1)/Math.max(1,links.length)*100)+'%'};const update=()=>{const offset=nav.getBoundingClientRect().height+24;let index=0;sections.forEach((section,i)=>{if(section&&section.getBoundingClientRect().top<=offset)index=i});setActive(index)};links.forEach(link=>link.addEventListener('click',()=>{const toc=link.closest('details');if(toc)toc.open=false}));addEventListener('scroll',update,{passive:true});addEventListener('resize',update,{passive:true});update()};const init=()=>{hydrate();initNav()};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();})();`;
const metaTitle = typeof document.meta.title === "string" ? document.meta.title : "Report";
const metaThesis = typeof document.meta.thesis === "string" ? document.meta.thesis : "";
const lang = /[\u0400-\u04ff]/.test(`${metaTitle}${metaThesis}`) ? "ru" : "en";
const html = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(metaTitle)}</title><style>${css}</style></head><body>${body}<script>${echartsRuntime}</script><script>${client}</script></body></html>`;
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, html);
console.log(JSON.stringify({ type: "REPORT_RENDERED", output: { artifactPath: process.env.OUTPUT_PATH ?? "artifacts/report.html", bytes: Buffer.byteLength(html), charts: chartModels.size } }));
