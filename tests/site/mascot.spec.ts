import { expect, type Page, test } from "@playwright/test";

const rootSelector = "shirone-mascot";
const storageKey = "shirone-mascot:elaina:v1";

function modelRequests(page: Page): string[] {
	const requests: string[] = [];
	page.on("request", (request) => {
		if (/\/live2d\//.test(request.url())) requests.push(request.url());
	});
	return requests;
}

async function openReady(page: Page, path = "/"): Promise<void> {
	await page.goto(path, { waitUntil: "domcontentloaded" });
	await expect(page.locator(rootSelector)).toHaveAttribute(
		"data-state",
		"ready",
		{ timeout: 20000 },
	);
	await expect(page.locator(`${rootSelector} canvas`)).toHaveCount(1);
	await page.waitForFunction(() =>
		getComputedStyle(document.documentElement)
			.getPropertyValue("--mc-primary")
			.trim()
			.startsWith("#"),
	);
}

test.describe("伊蕾娜看板娘", () => {
	test.use({
		viewport: { width: 1440, height: 1000 },
		reducedMotion: "reduce",
	});

	test("desktop sizes, keyboard interaction and persisted collapse", async ({
		page,
	}) => {
		const requests = modelRequests(page);
		await openReady(page);
		const root = page.locator(rootSelector);
		const interact = page.getByRole("button", { name: "和伊蕾娜互动" });
		await interact.focus();
		await interact.press("Enter");
		await page.getByRole("button", { name: "放大看板娘" }).click();
		await expect(root).toHaveCSS("--mascot-height", "336px");
		await expect(
			page.getByRole("button", { name: "放大看板娘" }),
		).toBeDisabled();
		await page.getByRole("button", { name: "缩小看板娘" }).click();
		await page.getByRole("button", { name: "缩小看板娘" }).click();
		await expect(root).toHaveCSS("--mascot-height", "256px");
		await expect(
			page.getByRole("button", { name: "缩小看板娘" }),
		).toBeDisabled();
		await page.getByRole("button", { name: "收起看板娘" }).click();
		await expect(root).toHaveAttribute("data-state", "collapsed");
		await expect(root.locator("canvas")).toHaveCount(0);
		await expect(
			page.getByRole("button", { name: "显示伊蕾娜" }),
		).toBeFocused();
		requests.length = 0;
		await page.reload({ waitUntil: "domcontentloaded" });
		await expect(
			page.getByRole("button", { name: "显示伊蕾娜" }),
		).toBeVisible();
		expect(requests).toEqual([]);
		await page.getByRole("button", { name: "显示伊蕾娜" }).click();
		await expect(root).toHaveAttribute("data-state", "ready", {
			timeout: 20000,
		});
		await expect(root).toHaveCSS("--mascot-height", "256px");
		await expect(root.locator("canvas")).toHaveCount(1);
	});

	test("Swup navigation keeps the same canvas without model reinitialization", async ({
		page,
	}) => {
		test.setTimeout(60000);
		const requests = modelRequests(page);
		await openReady(page);
		await page.waitForFunction(() => !!window.swup?.hooks);
		await page.locator(`${rootSelector} canvas`).evaluate((canvas) => {
			canvas.setAttribute("data-test-marker", "persistent");
		});
		const count = requests.length;
		await page.locator('#top-row a[href$="/archive/"]').first().click();
		await expect(page.locator("#swup-container")).toHaveAttribute(
			"data-current-page",
			"archive",
		);
		await expect(page.locator(`${rootSelector} canvas`)).toHaveAttribute(
			"data-test-marker",
			"persistent",
		);
		await expect(page.locator(rootSelector)).toHaveCount(1);
		expect(requests.length).toBe(count);
	});

	test("mobile and tablet do not download Core, model or renderer", async ({
		page,
	}) => {
		const requests = modelRequests(page);
		const renderers: string[] = [];
		page.on("request", (request) => {
			if (/mascot\/renderer|pixi__js|untitled-pixi-live2d/.test(request.url()))
				renderers.push(request.url());
		});
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto("/", { waitUntil: "domcontentloaded" });
		await expect(page.locator(rootSelector)).toHaveAttribute(
			"data-state",
			"loading",
		);
		await expect(page.locator(rootSelector)).toBeHidden();
		await page.setViewportSize({ width: 1024, height: 900 });
		await expect(page.locator(rootSelector)).toBeHidden();
		expect(requests).toEqual([]);
		expect(renderers).toEqual([]);
		await expect(page.locator(`${rootSelector} canvas`)).toHaveCount(0);
	});

	test("restored collapsed preference avoids all model requests on direct load", async ({
		page,
	}) => {
		await page.addInitScript(
			({ key }) =>
				localStorage.setItem(
					key,
					JSON.stringify({ collapsed: true, size: 320 }),
				),
			{ key: storageKey },
		);
		const requests = modelRequests(page);
		await page.goto("/archive/", { waitUntil: "domcontentloaded" });
		await expect(
			page.getByRole("button", { name: "显示伊蕾娜" }),
		).toBeVisible();
		await expect(page.locator(`${rootSelector} canvas`)).toHaveCount(0);
		expect(requests).toEqual([]);
	});

	test("responsive teardown and re-entry produce only one live canvas", async ({
		page,
	}) => {
		await openReady(page);
		await page.setViewportSize({ width: 1100, height: 900 });
		await expect(page.locator(rootSelector)).toBeHidden();
		await expect(page.locator(`${rootSelector} canvas`)).toHaveCount(0);
		await page.setViewportSize({ width: 1440, height: 1000 });
		await expect(page.locator(rootSelector)).toHaveAttribute(
			"data-state",
			"ready",
			{ timeout: 20000 },
		);
		await expect(page.locator(`${rootSelector} canvas`)).toHaveCount(1);
	});

	test("reduced motion updates live; search and sidebar temporarily yield", async ({
		page,
	}) => {
		await openReady(page);
		const root = page.locator(rootSelector);
		await expect(root).toHaveAttribute("data-running", "false");
		await page.emulateMedia({ reducedMotion: "no-preference" });
		await expect(root).toHaveAttribute("data-running", "true");
		await page.emulateMedia({ reducedMotion: "reduce" });
		await expect(root).toHaveAttribute("data-running", "false");
		await page.locator(".top-app-bar__search-shell").click();
		await page
			.getByRole("textbox", { name: "搜索", exact: true })
			.fill("Hello");
		await expect(root).toBeHidden();
		await page.keyboard.press("Escape");
		await page.getByRole("textbox", { name: "搜索", exact: true }).fill("");
		await page.mouse.move(700, 150);
		await expect(root).toBeVisible();
		await page.locator("#sidebar").hover({ position: { x: 100, y: 20 } });
		await expect(root).toBeHidden();
		await page.mouse.move(700, 150);
		await expect(root).toBeVisible();
	});

	test("collapse during a pending model fetch never attaches a late canvas", async ({
		page,
	}) => {
		let release: () => void = () => {};
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		await page.route("**/live2d/elaina/LSS.moc3", async (route) => {
			await gate;
			await route.continue().catch(() => {});
		});
		const requested = page.waitForRequest("**/live2d/elaina/LSS.moc3");
		await page.goto("/", { waitUntil: "domcontentloaded" });
		await requested;
		await page.getByRole("button", { name: "收起看板娘" }).click();
		release();
		await expect(page.locator(rootSelector)).toHaveAttribute(
			"data-state",
			"collapsed",
		);
		await expect(page.locator(`${rootSelector} canvas`)).toHaveCount(0);
		await page.getByRole("button", { name: "显示伊蕾娜" }).click();
		await expect(page.locator(rootSelector)).toHaveAttribute(
			"data-state",
			"ready",
			{ timeout: 20000 },
		);
		await expect(page.locator(`${rootSelector} canvas`)).toHaveCount(1);
	});

	test("failed assets offer an explicit retry and recover", async ({
		page,
	}) => {
		let attempts = 0;
		await page.route("**/live2d/elaina/LSS.model3.json", (route) => {
			attempts++;
			return attempts === 1
				? route.fulfill({ status: 503, body: "unavailable" })
				: route.continue();
		});
		await page.goto("/", { waitUntil: "domcontentloaded" });
		await expect(page.locator(rootSelector)).toHaveAttribute(
			"data-state",
			"error",
			{ timeout: 20000 },
		);
		await expect(
			page.getByText("看板娘暂时未能加载", { exact: true }),
		).toBeVisible();
		expect(attempts).toBe(1);
		await page.getByRole("button", { name: "重试", exact: true }).click();
		await expect(page.locator(rootSelector)).toHaveAttribute(
			"data-state",
			"ready",
			{ timeout: 20000 },
		);
		expect(attempts).toBe(2);
	});

	test("music overlap and native dialogs temporarily yield without recreating the canvas", async ({
		page,
	}) => {
		await page.addInitScript(() => {
			localStorage.setItem("music-form", "floating");
			localStorage.setItem("music-floating-pos", "50");
		});
		await openReady(page);
		const root = page.locator(rootSelector);
		const music = page.locator(".music-floating__handle");
		await expect(music).toBeVisible();
		const box = await music.boundingBox();
		if (!box) throw new Error("Missing music handle geometry");
		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
		await page.mouse.down();
		await page.mouse.move(30, 900, { steps: 10 });
		await page.mouse.up();
		await expect(root).toBeHidden();
		await expect(root.locator("canvas")).toHaveCount(1);
		await page.mouse.move(30, 900);
		await page.mouse.down();
		await page.mouse.move(30, 500, { steps: 10 });
		await page.mouse.up();
		await page.mouse.move(700, 150);
		await expect(root).toBeVisible();
		await page.evaluate(() => {
			const dialog = document.createElement("dialog");
			dialog.setAttribute("aria-label", "弹窗避让验证");
			dialog.innerHTML =
				'<form method="dialog"><button>关闭验证弹窗</button></form>';
			document.body.append(dialog);
			dialog.showModal();
		});
		await expect(root).toBeHidden();
		await page.getByRole("button", { name: "关闭验证弹窗" }).click();
		await expect(root).toBeVisible();
		await expect(root.locator("canvas")).toHaveCount(1);
	});

	test("WebGL context loss releases the canvas and explicit retry recovers", async ({
		page,
	}) => {
		await openReady(page);
		const lost = await page
			.locator(`${rootSelector} canvas`)
			.evaluate((element) => {
				const canvas = element as HTMLCanvasElement;
				const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
				const extension = gl?.getExtension("WEBGL_lose_context");
				extension?.loseContext();
				return !!extension;
			});
		expect(lost).toBe(true);
		await expect(page.locator(rootSelector)).toHaveAttribute(
			"data-state",
			"error",
		);
		await expect(page.locator(`${rootSelector} canvas`)).toHaveCount(0);
		await page.getByRole("button", { name: "重试", exact: true }).click();
		await expect(page.locator(rootSelector)).toHaveAttribute(
			"data-state",
			"ready",
			{ timeout: 20000 },
		);
		await expect(page.locator(`${rootSelector} canvas`)).toHaveCount(1);
	});
});
