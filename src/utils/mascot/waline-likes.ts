// Waline 3.16 commits these visual states after its vote request resolves.
// Keep the adapter with the optional mascot so Waline can run independently.
const articleLike = ".wl-reaction-item:has(img[src$='/tieba_agree.png'])";
const commentLike = ".wl-like";

export function listenForWalineLikes(
	onLike: () => void,
	signal: AbortSignal,
): void {
	const pending = new Map<Element, () => void>();
	const clear = () => {
		for (const dispose of pending.values()) dispose();
	};

	document.addEventListener(
		"click",
		(event) => {
			if (!(event.target instanceof Element)) return;
			const control = event.target.closest(`${commentLike}, ${articleLike}`);
			if (!control?.closest("shirone-waline") || pending.has(control)) return;

			const isComment = control.matches(commentLike);
			const node = isComment
				? control.querySelector(":scope > svg > path")
				: control;
			if (!node) return;
			const isLiked = () =>
				isComment
					? node.getAttribute("fill") === "red"
					: node.classList.contains("active");
			if (isLiked()) return;

			const observer = new MutationObserver(() => {
				if (!isLiked()) return;
				dispose();
				if (control.isConnected) onLike();
			});
			const timeout = setTimeout(() => dispose(), 15000);
			const dispose = () => {
				observer.disconnect();
				clearTimeout(timeout);
				pending.delete(control);
			};
			pending.set(control, dispose);
			observer.observe(node, {
				attributes: true,
				attributeFilter: [isComment ? "fill" : "class"],
			});
		},
		{ capture: true, signal },
	);
	document.addEventListener("swup:content:replace", clear, { signal });
	signal.addEventListener("abort", clear, { once: true });
}
