/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");

const ar = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../locales/ar.json"), "utf8"));
const en = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../locales/en.json"), "utf8"));

function getKeys(obj, prefix = "") {
  let keys = [];
  for (const k of Object.keys(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (typeof obj[k] === "object" && obj[k] !== null && !Array.isArray(obj[k])) {
      keys.push(...getKeys(obj[k], full));
    } else {
      keys.push(full);
    }
  }
  return keys;
}

const arKeys = new Set(getKeys(ar));
const enKeys = new Set(getKeys(en));

// 1. Check parity between ar.json and en.json
const missingInEn = [...arKeys].filter((k) => !enKeys.has(k));
const missingInAr = [...enKeys].filter((k) => !arKeys.has(k));

let hasErrors = false;

if (missingInEn.length > 0) {
  console.error("❌ Keys present in ar.json but missing in en.json:", missingInEn);
  hasErrors = true;
}

if (missingInAr.length > 0) {
  console.error("❌ Keys present in en.json but missing in ar.json:", missingInAr);
  hasErrors = true;
}

// 2. Check code usage in src
function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(fullPath));
    } else if (file.endsWith(".tsx") || file.endsWith(".ts")) {
      results.push(fullPath);
    }
  }
  return results;
}

const files = walk(path.resolve(__dirname, "../src"));
const regex = /\bt\(\s*["'`]([a-zA-Z0-9_.-]+)["'`]/g;
const missingInFiles = [];

for (const file of files) {
  const content = fs.readFileSync(file, "utf8");
  let m;
  while ((m = regex.exec(content)) !== null) {
    const key = m[1];
    if (!arKeys.has(key)) {
      missingInFiles.push({ file: path.relative(path.resolve(__dirname, ".."), file), key, missingIn: "ar" });
      hasErrors = true;
    }
    if (!enKeys.has(key)) {
      missingInFiles.push({ file: path.relative(path.resolve(__dirname, ".."), file), key, missingIn: "en" });
      hasErrors = true;
    }
  }
}

if (missingInFiles.length > 0) {
  console.error("❌ Translation keys used in code with t(...) but missing from dictionary:", missingInFiles);
}

if (!hasErrors) {
  console.log(`✅ All ${arKeys.size} translation keys in ar.json and en.json match 100%! All t(...) calls in code are valid.`);
  process.exit(0);
} else {
  process.exit(1);
}
