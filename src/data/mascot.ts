import type { MascotModel } from "@/types/mascotConfig";

/** 本站模型资料。伊蕾娜的去桌子资源与参数已在浏览器中独立验证。 */
export const mascotModel: MascotModel = {
	id: "elaina",
	name: "伊蕾娜",
	modelUrl: "/live2d/elaina/LSS.model3.json",
	canvasWidth: 700,
	canvasHeight: 900,
	greetingArt: "elaina",
	expressions: [],
	reactions: {
		tap: [
			{ parameter: "ParamMouthForm", value: 0.45 },
			{ parameter: "ParamAngleY", pulse: { amplitude: -8, durationMs: 720 } },
		],
		wink: [
			{ parameter: "ParamEyeLOpen", value: 0 },
			{ parameter: "ParamEyeROpen", value: 1 },
			{ parameter: "ParamMouthForm", value: 0.8 },
			{ parameter: "ParamAngleZ", value: 5 },
		],
		shy: [
			{ parameter: "Param4", value: 1 },
			{ parameter: "ParamEyeBallY", value: -0.35 },
			{ parameter: "ParamAngleY", value: -6 },
		],
		flustered: [
			{ parameter: "Param4", value: 1 },
			{ parameter: "Param5", value: 1 },
			{ parameter: "ParamMouthOpenY", value: 0.25 },
			{
				parameter: "ParamAngleX",
				value: 0,
				oscillation: { amplitude: 12, durationMs: 800 },
			},
		],
		like: [{ parameter: "Param", value: 1 }],
	},
};
