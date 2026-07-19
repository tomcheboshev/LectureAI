// Barrel — the public surface routes/packages.js and routes/chat.js (the
// only two external consumers of this directory) actually need, so
// everything internal to ai/ (provider selection, pipeline stages,
// generation orchestration) stays free to move without touching a route.
export { generateStudyPackage } from "./generation/fullGeneration.js";
export { generateStudyPackageChunked } from "./generation/chunkedGeneration.js";
export { extractImageText, explainConcept, chatAboutLecture } from "./generation/chatAndExplain.js";
export { regenerateSectionCore } from "./generation/sectionGeneration.js";
export { splitTextIntoChunks } from "./pipeline/chunking.js";
