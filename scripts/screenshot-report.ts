import { mkdir, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { ScreenshotManifest, type ScreenshotTile } from "../contracts/index.js";
import { requiredEnv } from "../contracts/runtime.js";
import { errorMessage } from "../guards/runtime.js";

type Target = { name: "desktop" | "mobile"; width: number; height: number; tileHeight: number; overlap: number };
type Segment = { sectionId: string; y: number; height: number };
const cwd = process.cwd();
const htmlPath = resolve(cwd, requiredEnv("HTML_FILE"));
const outputPath = resolve(cwd, process.env.OUTPUT_PATH ?? "artifacts/write/screenshots.json");
const outputDir = resolve(cwd, process.env.OUTPUT_DIR ?? "artifacts/write/screenshots");
const url = pathToFileURL(htmlPath).href;
const targets: Target[] = [
	{ name: "desktop", width: 1440, height: 1000, tileHeight: 2200, overlap: 200 },
	{ name: "mobile", width: 390, height: 900, tileHeight: 1800, overlap: 180 },
];
const browser = await chromium.launch({ headless: true });
const tiles: ScreenshotTile[] = [];
try {
	for (const target of targets) {
		const page = await browser.newPage({
			viewport: { width: target.width, height: target.tileHeight },
			deviceScaleFactor: 1,
		});
		await page.goto(url, { waitUntil: "networkidle" });
		await page.emulateMedia({ reducedMotion: "reduce" });
		await page.evaluate(() => {
			document.documentElement.style.setProperty("scroll-behavior", "auto", "important");
			for (const node of document.querySelectorAll<HTMLElement>("*")) {
				node.style.setProperty("animation", "none", "important");
				node.style.setProperty("transition", "none", "important");
			}
		});
		const pageHeight = await page.evaluate(() => Math.ceil(document.documentElement.scrollHeight));
		const segments: Segment[] = await page.evaluate(() => {
			const sections = [...document.querySelectorAll("main > section.re-section")];
			const result: Segment[] = [];
			if (sections[0]) {
				const first = sections[0].getBoundingClientRect().top + scrollY;
				if (first > 0) result.push({ sectionId: "frontmatter", y: 0, height: Math.ceil(first) });
			}
			for (const section of sections) {
				const rect = section.getBoundingClientRect();
				result.push({
					sectionId: section.id.replace(/^section-/, "") || "section",
					y: Math.max(0, Math.floor(rect.top + scrollY)),
					height: Math.ceil(rect.height),
				});
			}
			const sources = document.querySelector(".re-sources");
			if (sources) {
				const rect = sources.getBoundingClientRect();
				result.push({
					sectionId: "sources",
					y: Math.max(0, Math.floor(rect.top + scrollY)),
					height: Math.ceil(rect.height),
				});
			}
			return result;
		});
		const viewportDir = resolve(outputDir, target.name);
		await mkdir(viewportDir, { recursive: true });
		for (const segment of segments) {
			const boundedHeight = Math.max(1, Math.min(segment.height, pageHeight - segment.y));
			const step = Math.max(1, target.tileHeight - target.overlap);
			const starts: number[] = [];
			for (let offset = 0; offset < boundedHeight; offset += step) starts.push(offset);
			const selected =
				segment.sectionId === "sources" && starts.length > 3
					? [starts[0] ?? 0, starts[Math.floor(starts.length / 2)] ?? 0, starts.at(-1) ?? 0]
					: starts;
			for (const offset of selected) {
				const actualIndex = starts.indexOf(offset);
				const requestedY = Math.max(0, Math.min(segment.y + offset, Math.max(0, pageHeight - target.tileHeight)));
				const fileName = `${segment.sectionId}-${String(actualIndex + 1).padStart(2, "0")}-of-${String(starts.length).padStart(2, "0")}.png`;
				const filePath = resolve(viewportDir, fileName);
				await page.evaluate((scrollY) => window.scrollTo(0, scrollY), requestedY);
				await page.waitForTimeout(40);
				const y = await page.evaluate(() => Math.floor(window.scrollY));
				try {
					await page.screenshot({ path: filePath, animations: "disabled" });
				} catch (error) {
					throw new Error(
						`Tile screenshot failed for ${target.name}/${segment.sectionId} at y=${y}: ${errorMessage(error)}`,
					);
				}
				tiles.push({
					sectionId: segment.sectionId,
					viewport: target.name,
					index: actualIndex,
					total: starts.length,
					y,
					height: target.tileHeight,
					path: relative(cwd, filePath),
				});
			}
		}
		await page.close();
	}
} finally {
	await browser.close();
}
const manifest = ScreenshotManifest.parse({ htmlPath: relative(cwd, htmlPath), tiles });
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ type: "SCREENSHOTS_READY", output: manifest }));
