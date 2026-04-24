import { cp, mkdir, rm } from "node:fs/promises";

const generatedDir = new URL("../generated", import.meta.url);
const outputDir = new URL("../dist/generated", import.meta.url);

async function copyGeneratedArtifacts() {
  try {
    await mkdir(outputDir, { recursive: true });
    await rm(outputDir, { recursive: true, force: true });
    await cp(generatedDir, outputDir, {
      recursive: true,
      force: true,
      errorOnExist: false
    });
    console.log("Copied generated artifacts to dist/generated");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      console.warn("No generated directory found. Skipping generated artifact copy.");
      return;
    }
    throw error;
  }
}

copyGeneratedArtifacts();
