import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const rulesPath = path.join(__dirname, "..", "config", "rules.json");
export const guidelinePath = path.join(__dirname, "..", "config", "guideline.json");

export function loadRules() {
  return JSON.parse(fs.readFileSync(rulesPath, "utf8"));
}

export function saveRules(rules) {
  fs.writeFileSync(rulesPath, `${JSON.stringify(rules, null, 2)}\n`, "utf8");
}

export function loadGuidelineFile() {
  return JSON.parse(fs.readFileSync(guidelinePath, "utf8"));
}
