import { createHash } from "node:crypto";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const { values } = parseArgs({
	options: {
		source: { type: "string" },
		output: { type: "string" },
	},
});
if (!values.source)
	throw new Error(
		"Usage: node scripts/mascot/prepare-elaina.mjs --source <LSS-directory> [--output <directory>]",
	);
const source = path.resolve(values.source);
const output = path.resolve(
	values.output ??
		fileURLToPath(new URL("../../public/live2d/elaina/", import.meta.url)),
);
const relativeOutput = path.relative(source, output);
if (
	!relativeOutput ||
	(!relativeOutput.startsWith("..") && !path.isAbsolute(relativeOutput))
) {
	throw new Error("The output must be outside the original model directory.");
}

const texturePath = "LSS.4096/texture_00.png";
const input = await readFile(path.join(source, texturePath));
const { data, info } = await sharp(input)
	.ensureAlpha()
	.raw()
	.toBuffer({ resolveWithObject: true });
if (info.width !== 4096 || info.height !== 2048 || info.channels !== 4) {
	throw new Error(
		"Expected the original LSS 4096 × 2048 RGBA atlas; refusing to apply coordinates to a different atlas.",
	);
}

// This rectangle contains only the table, including its antialiased edges.
// Coordinates belong to this exact LSS UV atlas. Never resize/repack it.
const region = { left: 2540, top: 1356, width: 1126, height: 674 };
const edited = Buffer.from(data);
let removedPixels = 0;
for (let y = region.top; y < region.top + region.height; y++) {
	for (let x = region.left; x < region.left + region.width; x++) {
		const alpha = (y * info.width + x) * 4 + 3;
		if (edited[alpha] !== 0) removedPixels++;
		edited[alpha] = 0;
	}
}
if (removedPixels !== 234729) {
	throw new Error(
		`Unexpected table pixel count (${removedPixels}); inspect the atlas before modifying it.`,
	);
}
const png = await sharp(edited, {
	raw: { width: info.width, height: info.height, channels: 4 },
})
	.png({ compressionLevel: 9, adaptiveFiltering: true })
	.toBuffer();
const decoded = await sharp(png).ensureAlpha().raw().toBuffer();
let changedOutsideRegion = 0;
let changedRgbChannels = 0;
let changedAlphaPixels = 0;
for (let y = 0; y < info.height; y++) {
	for (let x = 0; x < info.width; x++) {
		const offset = (y * info.width + x) * 4;
		const inside =
			x >= region.left &&
			x < region.left + region.width &&
			y >= region.top &&
			y < region.top + region.height;
		for (let c = 0; c < 4; c++) {
			if (data[offset + c] === decoded[offset + c]) continue;
			if (!inside) changedOutsideRegion++;
			if (c < 3) changedRgbChannels++;
			else changedAlphaPixels++;
		}
	}
}
if (
	changedOutsideRegion ||
	changedRgbChannels ||
	changedAlphaPixels !== removedPixels
) {
	throw new Error("Atlas verification failed: only table alpha may change.");
}

// Preserve every original file and attribution; only replace the copied atlas.
await mkdir(output, { recursive: true });
await cp(source, output, { recursive: true });
await writeFile(path.join(output, texturePath), png);
const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");
const report = {
	name: "伊蕾娜",
	model: "LSS.model3.json",
	texture: texturePath,
	operation:
		"Clear alpha of the isolated table region; keep all RGB channels, other pixels and UV coordinates unchanged.",
	width: info.width,
	height: info.height,
	region,
	removedPixels,
	changedOutsideRegion,
	changedRgbChannels,
	sourceTextureSha256: sha256(input),
	outputTextureSha256: sha256(png),
	note: "Visual removal only. The moc3 mesh is unchanged. Original attribution files are retained.",
};
await writeFile(
	path.join(output, "elaina-preparation.json"),
	`${JSON.stringify(report, null, 2)}\n`,
);
console.log(JSON.stringify({ output, ...report }, null, 2));
