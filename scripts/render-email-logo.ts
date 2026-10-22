import fs from "fs";
import path from "path";
import sharp from "sharp";

async function main() {
  const svgPath = path.join(process.cwd(), "public", "images", "logo-svg.svg");
  const outPath = path.join(process.cwd(), "public", "images", "logo-email-240.png");

  if (!fs.existsSync(svgPath)) {
    console.error("SVG logo not found at:", svgPath);
    process.exit(1);
  }

  // 3x high-res transparent PNG (240x240 for 80px display at retina)
  await sharp(svgPath, { density: 300 })
    .resize(240, 240, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ quality: 95, compressionLevel: 9 })
    .toFile(outPath);

  const stats = fs.statSync(outPath);
  console.log(`Successfully generated ${outPath} (${stats.size} bytes)`);
}

main().catch(console.error);
