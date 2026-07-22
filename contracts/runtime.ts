import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { z } from "zod";

export function diagnostic(error: unknown): string {
	if (error instanceof z.ZodError) {
		return error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`).join("; ");
	}
	return error instanceof Error ? error.message : String(error);
}

export function parseJsonText<TSchema extends z.ZodType>(
	text: string,
	schema: TSchema,
	source = "JSON",
): z.output<TSchema> {
	let value: unknown;
	try {
		value = JSON.parse(text) as unknown;
	} catch (error) {
		throw new Error(`${source}: invalid JSON (${diagnostic(error)})`);
	}
	const result = schema.safeParse(value);
	if (!result.success) throw new Error(`${source}: ${diagnostic(result.error)}`);
	return result.data;
}

export async function parseJsonFile<TSchema extends z.ZodType>(
	path: string,
	schema: TSchema,
): Promise<z.output<TSchema>> {
	const resolved = resolve(process.cwd(), path);
	try {
		return parseJsonText(await readFile(resolved, "utf8"), schema, resolved);
	} catch (error) {
		throw new Error(`Cannot parse ${resolved}: ${diagnostic(error)}`);
	}
}

export function requiredEnv(name: string): string {
	const value = process.env[name];
	if (!value) throw new Error(`Missing required environment variable ${name}`);
	return value;
}

export async function writeJsonArtifact(path: string, value: unknown): Promise<string> {
	const resolved = resolve(process.cwd(), path);
	await mkdir(dirname(resolved), { recursive: true });
	await writeFile(resolved, `${JSON.stringify(value, null, 2)}\n`);
	return resolved;
}

export function emit(type: string, output: unknown): void {
	process.stdout.write(`${JSON.stringify({ type, output })}\n`);
}
