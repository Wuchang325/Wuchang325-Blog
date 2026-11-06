import type { CubismInternalModel } from "untitled-pixi-live2d-engine/cubism";

type Drawables = ReturnType<
	CubismInternalModel["coreModel"]["getModel"]
>["drawables"];
type Point = readonly [number, number];

const cupMs = 260;
const liftMs = 440;
const waveMs = 710;
const lowerMs = 410;
export const elainaGreetingMs: number = cupMs * 2 + liftMs + waveMs + lowerMs;

// Coordinates are calibrated against the painting's original 925 × 1701
// canvas. The wrist slices overlap so the skin stays joined when it rotates.
const artwork = `
<defs>
  <clipPath id="elaina-forearm-crop"><rect y="500" width="925" height="1201"/></clipPath>
  <clipPath id="elaina-palm-crop"><path d="M0 0H925V523H634L610 572H455L462 523H0Z"/></clipPath>
  <linearGradient id="elaina-wrist-fade" gradientUnits="userSpaceOnUse" x1="0" y1="545" x2="0" y2="568">
    <stop stop-color="white"/><stop offset="1" stop-color="black"/>
  </linearGradient>
  <mask id="elaina-palm-seam" maskUnits="userSpaceOnUse" x="0" y="0" width="925" height="572">
    <rect width="925" height="572" fill="url(#elaina-wrist-fade)"/>
  </mask>
</defs>
<g data-part="anchor">
  <g data-part="forearm"><image width="925" height="1701" preserveAspectRatio="none" clip-path="url(#elaina-forearm-crop)"/></g>
  <g data-part="palm"><image width="925" height="1701" preserveAspectRatio="none" clip-path="url(#elaina-palm-crop)" mask="url(#elaina-palm-seam)"/></g>
</g>`;

function ease(t: number): number {
	return t * t * (3 - 2 * t);
}

function curve(
	start: Point,
	first: Point,
	second: Point,
	end: Point,
	t: number,
): Point {
	const s = 1 - t;
	return [
		s ** 3 * start[0] +
			3 * s ** 2 * t * first[0] +
			3 * s * t ** 2 * second[0] +
			t ** 3 * end[0],
		s ** 3 * start[1] +
			3 * s ** 2 * t * first[1] +
			3 * s * t ** 2 * second[1] +
			t ** 3 * end[1],
	];
}

interface GreetingArt {
	resize(size: number): void;
	draw(elapsed: number, renderModel: () => void): void;
	destroy(): void;
}

/** LSS model-space artwork. The only altered Cubism drawable is the idle cup arm. */
export function createElainaGreeting(
	canvas: HTMLCanvasElement,
	drawables: Drawables,
	paintingUrl: string,
): GreetingArt | undefined {
	const arm = drawables.ids.indexOf("ArtMesh5");
	const vertices = drawables.vertexPositions[arm];
	const shoulderIndex = 45 * 2;
	if (!paintingUrl || !vertices || vertices.length <= shoulderIndex + 1)
		return undefined;
	const baseline = new Float32Array(vertices.length);
	const originX = vertices[shoulderIndex];
	const originY = vertices[shoulderIndex + 1];
	const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	svg.setAttribute("viewBox", "0 0 700 900");
	svg.setAttribute("aria-hidden", "true");
	svg.setAttribute("data-mascot-greeting", "");
	svg.style.cssText =
		"position:absolute;left:12px;top:16px;pointer-events:none;display:none;";
	svg.innerHTML = artwork;
	for (const image of svg.querySelectorAll("image"))
		image.setAttribute("href", paintingUrl);
	canvas.after(svg);
	const anchor = svg.querySelector('[data-part="anchor"]');
	const forearm = svg.querySelector('[data-part="forearm"]');
	const palm = svg.querySelector('[data-part="palm"]');

	function paint(lift: number, sway: number) {
		const [x, y] = curve([172, 1052], [98, 931], [96, 777], [148, 646], lift);
		const wristX = x + sway * 4;
		const armAngle = 59 - 70 * lift + sway * 3;
		const transform = (angle: number) =>
			`translate(${wristX} ${y}) rotate(${angle}) scale(.286 .302) translate(-538 -531)`;
		forearm?.setAttribute("transform", transform(armAngle));
		palm?.setAttribute("transform", transform(armAngle + sway * 13));
		const offsetX = (vertices[shoulderIndex] - originX) * 700;
		const offsetY = (originY - vertices[shoulderIndex + 1]) * 700;
		anchor?.setAttribute("transform", `translate(${offsetX} ${offsetY})`);
	}

	return {
		resize(size) {
			svg.style.width = `${(size * 700) / 900}px`;
			svg.style.height = `${size}px`;
		},
		draw(elapsed, renderModel) {
			const remaining = elainaGreetingMs - elapsed;
			if (elapsed < 0 || remaining <= 0) {
				svg.style.display = "none";
				renderModel();
				return;
			}
			const edge = Math.min(elapsed, remaining);
			const originalOpacity = drawables.opacities[arm];
			if (edge < cupMs) {
				svg.style.display = "none";
				baseline.set(vertices);
				const slide = ease(edge / cupMs) * (224 / 700);
				for (let index = 1; index < vertices.length; index += 2)
					vertices[index] -= slide;
				try {
					renderModel();
				} finally {
					vertices.set(baseline);
				}
				return;
			}
			const lift = ease(
				Math.min((elapsed - cupMs) / liftMs, (remaining - cupMs) / lowerMs, 1),
			);
			const progress = Math.max(
				0,
				Math.min((elapsed - cupMs - liftMs) / waveMs, 1),
			);
			paint(
				lift,
				Math.sin(progress * 4 * Math.PI) *
					ease(Math.min(progress / 0.18, (1 - progress) / 0.18, 1)),
			);
			svg.style.display = "";
			drawables.opacities[arm] = 0;
			try {
				renderModel();
			} finally {
				drawables.opacities[arm] = originalOpacity;
			}
		},
		destroy() {
			svg.remove();
		},
	};
}
