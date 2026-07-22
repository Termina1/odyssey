export const reject = (reason: string): never => {
	process.stderr.write(`${reason}\n`);
	process.exit(1);
};

export const accept = (type: string): void => {
	process.stdout.write(`${JSON.stringify({ type, output: { reason: "", instructions: [] } })}\n`);
};

export const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));
