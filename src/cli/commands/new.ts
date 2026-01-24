import { Command } from "commander";
import { createMission, initStrikeDir } from "../../state/index.js";
import { registerMission } from "../../registry/index.js";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Simple slug generator - no external dependency needed
function slugify(text: string): string {
  // Use first line for slug
  const firstLine = text.split("\n")[0].trim();
  return firstLine
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

/**
 * Open $EDITOR for multiline input
 */
async function openEditor(): Promise<string> {
  const editor = process.env.EDITOR || process.env.VISUAL || "vi";
  const tempFile = join(tmpdir(), `strike-mission-${Date.now()}.md`);

  // Write template to temp file
  const template = `# Mission Brief

Describe what you want to build. Be as detailed as you like.

## What

[What should be built?]

## Why

[Why is this needed?]

## Context

[Any relevant context, constraints, or preferences]

---
Lines starting with # are treated as headers, not comments.
Delete this section before saving.
`;

  await writeFile(tempFile, template);

  // Open editor
  await new Promise<void>((resolve, reject) => {
    const child = spawn(editor, [tempFile], {
      stdio: "inherit",
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Editor exited with code ${code}`));
      }
    });

    child.on("error", reject);
  });

  // Read the edited file
  const content = await readFile(tempFile, "utf-8");

  // Clean up temp file
  await unlink(tempFile).catch(() => {});

  // Remove the instruction block at the end if still present
  const cleaned = content
    .replace(/---\nLines starting with.*Delete this section before saving\.\n?/s, "")
    .trim();

  return cleaned;
}

export const newCommand = new Command("new")
  .description("Create a new mission")
  .argument("[description]", "Description of the mission (optional if using --file or $EDITOR)")
  .option("-f, --file <path>", "Read mission brief from a file")
  .action(async (description: string | undefined, options: { file?: string }) => {
    const projectRoot = process.cwd();

    try {
      let brief: string;

      if (options.file) {
        // Read from file
        brief = await readFile(options.file, "utf-8");
        brief = brief.trim();
      } else if (description) {
        // Use command line argument
        brief = description;
      } else {
        // Open $EDITOR for multiline input
        console.log("Opening editor for mission brief...");
        brief = await openEditor();
      }

      if (!brief) {
        console.error("Mission brief cannot be empty");
        process.exit(1);
      }

      // Ensure .strike directory exists
      await initStrikeDir(projectRoot);

      // Generate slug from first line of description
      const id = slugify(brief);

      const mission = await createMission(projectRoot, id, brief);

      // Register in global registry so it can be found from anywhere
      await registerMission(mission.id, projectRoot, brief);

      console.log(`Created mission: ${mission.id}`);
      console.log(`  Status: ${mission.status}`);
      console.log(`  Path: .strike/missions/${mission.id}/`);
      console.log("");
      console.log(`Next: run 'strike chat ${mission.id}' to start working with the PM`);
    } catch (error) {
      console.error("Failed to create mission:", error);
      process.exit(1);
    }
  });
