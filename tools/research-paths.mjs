import path from "node:path";

export const publicResearchDir = path.resolve("research");
export const privateResearchDir = process.env.FICHEBAIT_RESEARCH_DIR
  ? path.resolve(process.env.FICHEBAIT_RESEARCH_DIR)
  : publicResearchDir;

export function privateResearchPath(...segments) {
  return path.join(privateResearchDir, ...segments);
}

export function publicResearchPath(...segments) {
  return path.join(publicResearchDir, ...segments);
}
