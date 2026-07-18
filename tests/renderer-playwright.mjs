import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const cwd = process.cwd();
const htmlPath = resolve(cwd, process.env.HTML_FILE ?? "artifacts/report.html");
const outputDir = resolve(cwd, process.env.OUTPUT_DIR ?? "artifacts/report-renderer-playwright");
await mkdir(outputDir, { recursive: true });
const targetUrl = pathToFileURL(htmlPath).href;
const targets = [{ name: "desktop", width: 1440, height: 1000 }, { name: "mobile", width: 390, height: 844 }];
const browser = await chromium.launch({ headless: true });
const result = { htmlPath: relative(cwd, htmlPath), screenshots: [], checks: [] };
try {
  for (const target of targets) {
    const page = await browser.newPage({ viewport: { width: target.width, height: target.height }, deviceScaleFactor: 1 });
    const consoleErrors = [];
    page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
    page.on("pageerror", (error) => consoleErrors.push(error.message));
    await page.goto(targetUrl, { waitUntil: "networkidle" });
    await page.waitForTimeout(250);
    assert.equal(await page.locator("[data-render-error]").count(), 0, `${target.name}: chart runtime error`);
    assert.equal(consoleErrors.length, 0, `${target.name}: console errors: ${consoleErrors.join(" | ")}`);
    const chartCount = await page.locator(".re-chart-shell").count();
    assert.ok(chartCount > 0, `${target.name}: no chart shells`);
    assert.equal(await page.locator('.re-chart[role="img"][aria-label]').count(), chartCount, `${target.name}: chart accessibility labels`);
    const layout = await page.evaluate(() => {
      const viewport = window.innerWidth;
      const overflow = document.documentElement.scrollWidth - viewport;
      const blocks = [...document.querySelectorAll(".re-block")].map((node) => { const rect = node.getBoundingClientRect(); return { left: rect.left, right: rect.right, width: rect.width, top: rect.top, bottom: rect.bottom }; });
      const ids = [...document.querySelectorAll("[id]")].map((node) => node.id).filter(Boolean);
      const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
      return { overflow, blocks, duplicateIds, emptyAlt: [...document.images].filter((image) => !image.alt).length, chartSummaries: [...document.querySelectorAll("[data-chart-summary]")].filter((node) => !node.textContent?.trim()).length };
    });
    assert.ok(layout.overflow <= 1, `${target.name}: horizontal document overflow ${layout.overflow}px`);
    assert.equal(layout.duplicateIds.length, 0, `${target.name}: duplicate ids ${layout.duplicateIds.join(",")}`);
    assert.equal(layout.emptyAlt, 0, `${target.name}: image without alt`);
    assert.equal(layout.chartSummaries, 0, `${target.name}: empty chart summary`);
    assert.ok(layout.blocks.every((block) => block.width > 0 && block.left >= -1 && block.right <= target.width + 1), `${target.name}: clipped block`);
    const sparseChart = page.locator(".re-block-chart").filter({ hasText: "Отгрузки ESL-модулей" }).first();
    assert.equal(await sparseChart.count(), 1, "sparse actual/forecast chart should be present");
    assert.equal(await sparseChart.locator(".re-legend-controls").count(), 1, "chart must expose exactly one legend control group");
    assert.doesNotMatch(await sparseChart.locator("[data-chart-summary]").innerText(), /:\s*0(?:\s|$)/, "missing sparse cells must not be summarized as zero");
    const sparseOption = await sparseChart.locator(".re-chart").evaluate((node) => {
      const option = window.echarts.getInstanceByDom(node).getOption();
      return { legendVisible: option.legend?.some((legend) => legend.show), values: option.series.map((series) => series.data.map((datum) => datum?.value ?? null)) };
    });
    assert.equal(sparseOption.legendVisible, false, "custom legend controls must not be duplicated by ECharts");
    assert.deepEqual(sparseOption.values, [[370, null], [null, 500]], "sparse series must preserve missing cells");
    const revenueChart = page.locator(".re-block-chart").filter({ hasText: "Консолидированная выручка" }).first();
    assert.equal(await revenueChart.count(), 1, "revenue trend chart should be present");
    assert.equal(await revenueChart.locator(".re-legend-controls").count(), 0, "point-level status must not fragment the trend into filterable one-point series");
    const revenueOption = await revenueChart.locator(".re-chart").evaluate((node) => {
      const option = window.echarts.getInstanceByDom(node).getOption();
      return option.series.map((series) => ({ type: series.type, values: series.data.map((datum) => datum?.value ?? null) }));
    });
    assert.deepEqual(revenueOption, [{ type: "line", values: [27.12, 32.163, 36.116] }], "revenue values must form one connected line");
    const ownershipChart = page.locator(".re-block-chart").filter({ hasText: "Владение e-reader" }).first();
    assert.equal(await ownershipChart.count(), 1, "ownership chart should be present");
    assert.equal(await ownershipChart.locator(".re-legend-controls").count(), 0, "display roles must not leak into chart legend controls");
    assert.doesNotMatch(await ownershipChart.innerText(), /annotation-only|^bar$/m, "internal display roles must not leak into visible UI");
    assert.match(await ownershipChart.innerText(), /Несопоставимый ориентир/, "non-comparable record must remain visible as a note");
    const ownershipOption = await ownershipChart.locator(".re-chart").evaluate((node) => {
      const option = window.echarts.getInstanceByDom(node).getOption();
      return { categories: option.xAxis[0].data, series: option.series.map((series) => series.data.map((datum) => datum?.value ?? null)) };
    });
    assert.equal(ownershipOption.categories.some((category) => String(category).includes("2023")), false, "annotation-only category must stay outside the plot");
    assert.deepEqual(ownershipOption.series, [[6, 12, 19, 32, 19, 19]]);
    if (target.name === "desktop") {
      const netronix = page.locator(".re-block-chart").filter({ hasText: "Netronix" }).first();
      assert.equal(await netronix.count(), 1, "Netronix chart should be present");
      const filter = netronix.locator(".re-series-toggle").first();
      assert.equal(await filter.getAttribute("aria-pressed"), "true");
      await filter.click();
      assert.equal(await filter.getAttribute("aria-pressed"), "false", "legend filter interaction");
    }
    await page.screenshot({ path: resolve(outputDir, `${target.name}.png`), fullPage: true });
    result.screenshots.push(relative(cwd, resolve(outputDir, `${target.name}.png`)));
    result.checks.push({ viewport: target.name, chartCount, overflow: layout.overflow, duplicateIds: layout.duplicateIds.length });
    await page.close();
  }
} finally {
  await browser.close();
}
await writeFile(resolve(outputDir, "report.json"), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ type: "RENDERER_PLAYWRIGHT_PASS", output: result }));
