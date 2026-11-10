import sharp from "sharp";

const source = "public/images/group-portrait.avif";
const widths = [384, 640, 750, 828, 1080, 1200, 1800, 1920, 2048];

for (const width of widths) {
  const output = `public/images/group-portrait-hero-${width}.avif`;
  const result = await sharp(source)
    .resize({ width })
    .avif({ quality: 60, effort: 4 })
    .toFile(output);
  process.stdout.write(`${output}: ${result.width}×${result.height}, ${result.size} bytes\n`);
}
