# 伊蕾娜（LSS）去桌子模型

这是本站使用的 LSS 模型资源副本。原有文件名、相对引用和署名文件均保留。

唯一素材修改是将 `LSS.4096/texture_00.png` 中独立桌子区域的 Alpha 通道清零，原始尺寸仍为 4096×2048。所有 RGB 通道及区域外像素保持不变；`.moc3` 模型与物理配置不变。

准备命令：

```powershell
node scripts/mascot/prepare-elaina.mjs --source "<原始 LSS 文件夹>"
```

像素修改区域、计数与 SHA-256 见 `elaina-preparation.json`。这属于视觉移除，模型内原有桌子网格 `ArtMesh108` 仍存在。无需在运行时额外隐藏它。

实际浏览器验证结果及后续接入要求见 `docs/elaina-mascot-model-validation.md`。
