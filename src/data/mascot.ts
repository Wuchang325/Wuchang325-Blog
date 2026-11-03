import type { MascotModel } from "@/types/mascotConfig";

/** 本站模型资料。伊蕾娜的去桌子资源与参数已在浏览器中独立验证。 */
export const mascotModel: MascotModel = {
	id: "elaina",
	name: "伊蕾娜",
	modelUrl: "/live2d/elaina/LSS.model3.json",
	canvasWidth: 700,
	canvasHeight: 900,
	expressions: [
		{ parameter: "Param4", value: 1 },
		{ parameter: "Param6", value: 1 },
		{ parameter: "Param", value: 1 },
		{ parameter: "Param3", value: 1 },
	],
};
