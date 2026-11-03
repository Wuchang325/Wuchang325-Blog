import { access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = fileURLToPath(
	new URL("../../.zcode/elaina-prototype/", import.meta.url),
);
const repo = fileURLToPath(new URL("../../", import.meta.url));
// This resumes the workspace-local validation artifact. It is deliberately
// separate from Astro routes and is not a production theme feature.
for (const file of [
	"index.html",
	"main.js",
	"original/LSS.model3.json",
	"vendor/live2dcubismcore.min.js",
]) {
	try {
		await access(`${root}/${file}`);
	} catch {
		throw new Error(
			`The local Elaina prototype is missing ${file}. See docs/elaina-mascot-model-validation.md for its scope and preparation.`,
		);
	}
}
const server = await createServer({
	configFile: false,
	root,
	publicDir: `${repo}/public`,
	server: {
		host: "127.0.0.1",
		port: 4418,
		strictPort: true,
		fs: { allow: [repo] },
	},
	optimizeDeps: { include: ["pixi.js", "untitled-pixi-live2d-engine/cubism"] },
});
await server.listen();
server.printUrls();
