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

	test("quick activations progress from greeting to winking, blushing and flustered", async ({
		page,
	}) => {
		await openReady(page);
		const dialogue = page.locator("[data-mascot-dialogue]");
		const interact = page.getByRole("button", { name: "和伊蕾娜互动" });
		await interact.press("Enter");
		await expect(dialogue).toHaveText("你好呀，旅人！");
		await interact.press("Space");
		await expect(dialogue).toHaveText("欸？又见面了。");
		await interact.press("Enter");
		await expect(dialogue).toHaveText("这样一直看着我，会害羞的……");
		await interact.press("Space");
		await expect(dialogue).toHaveText("这样一直看着我，会害羞的……");
		await interact.press("Enter");
		await expect(dialogue).toHaveText("不、不要一直点啦！");
		await expect(dialogue).toBeEmpty();
		await interact.press("Enter");
		await expect(dialogue).toHaveText("你好呀，旅人！");
		await page.getByRole("button", { name: "收起看板娘" }).click();
		await expect(dialogue).toBeEmpty();
	});

	test("the drawn greeting returns to the native pose and respects reduced motion", async ({
		page,
	}) => {
		await page.emulateMedia({ reducedMotion: "no-preference" });
		await openReady(page);
		const art = page.locator("[data-mascot-greeting]");
		const interact = page.getByRole("button", { name: "和伊蕾娜互动" });
		const dialogue = page.locator("[data-mascot-dialogue]");
		await expect(art).toBeAttached();
		await expect(art.locator("image").first()).toHaveAttribute(
			"href",
			/^blob:/,
		);
		await expect(art).toBeHidden();
		await interact.press("Enter");
		await expect(art).toBeVisible();
		await interact.press("Space");
		await expect(dialogue).toHaveText("欸？又见面了。");
		await expect(art).toBeVisible();
		await expect(art).toBeHidden();
		await page.emulateMedia({ reducedMotion: "reduce" });
		await openReady(page);
		await expect(page.locator(rootSelector)).toHaveAttribute(
			"data-running",
			"false",
		);
		await interact.press("Enter");
		await expect(dialogue).toHaveText("你好呀，旅人！");
		await expect(art).toBeHidden();
	});

	test("only confirmed positive Waline votes put on sunglasses", async ({
		page,
	}) => {
		let rejectComment = true;
		await page.route("https://waline.zient.top/api/**", async (route) => {
			const { pathname } = new URL(route.request().url());
			const method = route.request().method();
			const headers = { "access-control-allow-origin": "*" };
			if (method === "PUT" && rejectComment) {
				rejectComment = false;
				await route.fulfill({ status: 403, headers, json: { errno: 403 } });
				return;
			}
			const data = pathname.endsWith("/article")
				? [{ reaction0: 1, reaction1: 0 }]
				: {
						count: 1,
						totalPages: 1,
						data: [
							{
								objectId: "test-like",
								nick: "QA",
								comment: "<p>QA</p>",
								time: Date.now(),
								status: "approved",
								like: 0,
							},
						],
					};
			await route.fulfill({ headers, json: { errno: 0, data } });
		});
		await page.route("https://unpkg.com/@waline/emojis/**", (route) =>
			route.fulfill({ status: 204 }),
		);
		await openReady(page, "/posts/hello-world/");
		const dialogue = page.locator("[data-mascot-dialogue]");
		const comment = page.locator(".wl-like");
		await page.locator("shirone-waline").scrollIntoViewIfNeeded();
		await expect(comment).toBeVisible();
		await expect(dialogue).toBeEmpty();
		const rejected = page.waitForResponse(
			(response) =>
				response.request().method() === "PUT" && response.status() === 403,
		);
		await comment.click();
		await rejected;
		await expect(comment.locator("path")).toHaveAttribute(
			"fill",
			"currentColor",
		);
		await expect(dialogue).toBeEmpty();
		await comment.click();
		await expect(dialogue).toHaveText("哼哼，眼光不错！");
		await page.getByRole("button", { name: "和伊蕾娜互动" }).press("Enter");
		await expect(dialogue).toHaveText("哼哼，眼光不错！");
		await expect(dialogue).toBeEmpty();
		await comment.click();
		await expect(comment.locator("path")).toHaveAttribute(
			"fill",
			"currentColor",
		);
		await expect(dialogue).toBeEmpty();

		const article = page.locator(".wl-reaction-img").first();
		await article.press("Enter");
		await expect(article).toHaveAttribute("aria-pressed", "true");
		await expect(dialogue).toHaveText("哼哼，眼光不错！");
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

	test("top display settings can turn off the mascot and remember it across reloads", async ({
		page,
	}) => {
		const requests = modelRequests(page);
		await openReady(page);
		const root = page.locator(rootSelector);
		const settings = page.locator("#display-settings-switch");
		const toggle = page.getByRole("checkbox", { name: "显示看板娘" });
		await settings.click();
		await expect(toggle).toBeChecked();
		await toggle.press("Space");
		await expect(toggle).not.toBeChecked();
		await expect(root).toHaveAttribute("data-state", "disabled");
		await expect(root).toBeHidden();
		await expect(root.locator("canvas")).toHaveCount(0);
		requests.length = 0;
		await page.reload({ waitUntil: "domcontentloaded" });
		await expect(root).toHaveAttribute("data-state", "disabled");
		expect(requests).toEqual([]);
		await settings.click();
		await expect(toggle).not.toBeChecked();
		await toggle.press("Space");
		await expect(toggle).toBeChecked();
		await expect(root.locator("canvas")).toBeVisible({ timeout: 20000 });
	});

	test("a mobile device with a desktop-sized fine-pointer viewport stays disabled", async ({
		page,
	}) => {
		const requests = modelRequests(page);
		await page.addInitScript(() => {
			Object.defineProperty(navigator, "userAgent", {
				value:
					"Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/128.0 Mobile Safari/537.36",
			});
		});
		await page.goto("/", { waitUntil: "domcontentloaded" });
		await page.waitForFunction(() => !!customElements.get("shirone-mascot"));
		expect(
			await page.evaluate(
				() =>
					matchMedia(
						"(min-width: 1280px) and (hover: hover) and (pointer: fine)",
					).matches,
			),
		).toBe(true);
		await expect(page.locator(rootSelector)).toBeHidden();
		await page.locator("#display-settings-switch").click();
		await expect(
			page.getByRole("checkbox", { name: "显示看板娘" }),
		).toHaveCount(0);
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

	test("reduced motion updates live; search yields without hiding on hover", async ({
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
		await expect(root).toBeVisible();
		await page.getByRole("button", { name: "和伊蕾娜互动" }).hover();
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

	test("a saved music handle collision moves the mascot while open overlays hide it", async ({
		page,
	}) => {
		await page.setViewportSize({ width: 1592, height: 814 });
		await page.addInitScript(() => {
			localStorage.setItem("music-form", "floating");
			localStorage.setItem("music-floating-edge", "left");
			localStorage.setItem("music-floating-pos", "58.4");
		});
		await openReady(page);
		const root = page.locator(rootSelector);
		const music = page.locator(".music-floating__handle");
		await expect(music).toBeVisible();
		await expect(root).toBeVisible();
		await expect
			.poll(async () => {
				const handle = await music.boundingBox();
				const mascot = await root.boundingBox();
				return !!handle && !!mascot && mascot.x >= handle.x + handle.width;
			})
			.toBe(true);
		await music.click();
		await expect(root).toBeHidden();
		await expect(root.locator("canvas")).toHaveCount(1);
		await page.locator(".music-floating__close").click();
		await page.mouse.move(700, 150);
		await expect(root).toBeVisible();
		const box = await music.boundingBox();
		if (!box) throw new Error("Missing music handle geometry");
		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
		await page.mouse.down();
		await page.mouse.move(30, 250, { steps: 10 });
		await page.mouse.up();
		await page.mouse.move(700, 150);
		await expect(root).toBeVisible();
		await expect(root).toHaveCSS("inset-inline-start", "16px");
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
