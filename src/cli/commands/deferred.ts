import { Command } from "commander";
import { createDeferredItem, readDeferredItem, listDeferredItems, promoteDeferredItem, resolveEpicId, createEpic, initIncDir } from "../../state/index.js";
import { registerEpic } from "../../registry/index.js";

export const deferredCommand = new Command("deferred")
  .description("Manage deferred work items");

deferredCommand
  .command("add")
  .description("Add a new deferred work item")
  .requiredOption("--title <title>", "One-line summary of the deferred work")
  .requiredOption("--description <description>", "Detailed explanation of what was deferred")
  .requiredOption("--rationale <rationale>", "Why this work was deferred")
  .requiredOption("--source-epic <epic>", "Epic ID where this work was deferred")
  .action(async (options: {
    title: string;
    description: string;
    rationale: string;
    sourceEpic: string;
  }) => {
    const projectRoot = process.cwd();

    try {
      // Resolve the source epic ID (supports short IDs)
      const resolved = await resolveEpicId(projectRoot, options.sourceEpic);
      if (!resolved) {
        console.error(`Epic not found: ${options.sourceEpic}`);
        process.exit(1);
      }

      const { epicId: sourceEpicId } = resolved;

      // Create the deferred item
      const item = await createDeferredItem(projectRoot, {
        title: options.title,
        description: options.description,
        rationale: options.rationale,
        source_epic_id: sourceEpicId,
        created_by: "user", // CLI commands are user-initiated
      });

      console.log(`Deferred item created: ${item.id}`);
      console.log(`  Title: ${item.title}`);
      console.log(`  Source epic: ${sourceEpicId}`);
    } catch (error) {
      console.error("Failed to create deferred item:", error);
      process.exit(1);
    }
  });

deferredCommand
  .command("show")
  .description("Show details of a deferred work item")
  .argument("<id>", "Deferred item ID")
  .action(async (itemId: string) => {
    const projectRoot = process.cwd();

    try {
      const item = await readDeferredItem(projectRoot, itemId);

      if (!item) {
        console.error(`Deferred item not found: ${itemId}`);
        process.exit(1);
      }

      console.log(`Deferred Item: ${item.id}`);
      console.log(`  Title: ${item.title}`);
      console.log(`  Description:`);
      // Split multi-line description and indent each line
      const descriptionLines = item.description.split("\n");
      for (const line of descriptionLines) {
        console.log(`    ${line}`);
      }
      console.log(`  Rationale: ${item.rationale}`);
      console.log(`  Source Epic ID: ${item.source_epic_id}`);
      console.log(`  Created At: ${item.created_at}`);
      console.log(`  Created By: ${item.created_by}`);

      if (item.promoted_to_epic_id) {
        console.log(`  Promoted To Epic ID: ${item.promoted_to_epic_id}`);
        console.log(`  Promoted At: ${item.promoted_at}`);
      }
    } catch (error) {
      console.error("Failed to show deferred item:", error);
      process.exit(1);
    }
  });

deferredCommand
  .command("list")
  .description("List all deferred work items")
  .option("--all", "Include promoted items")
  .action(async (options: { all?: boolean }) => {
    const projectRoot = process.cwd();

    try {
      const items = await listDeferredItems(projectRoot, { includePromoted: options.all });

      if (items.length === 0) {
        if (options.all) {
          console.log("No deferred items found.");
        } else {
          console.log("No open deferred items. Create one with 'inc deferred add'.");
        }
        return;
      }

      console.log("Deferred Items:\n");
      for (const item of items) {
        const promotedFlag = item.promoted_to_epic_id ? " [PROMOTED]" : "";
        console.log(`  ${item.id}: ${item.title}${promotedFlag}`);
        console.log(`    Source: ${item.source_epic_id}`);
        console.log(`    Created: ${new Date(item.created_at).toLocaleDateString()}`);
        if (item.promoted_to_epic_id) {
          console.log(`    Promoted to: ${item.promoted_to_epic_id}`);
        }
        console.log("");
      }
    } catch (error) {
      console.error("Failed to list deferred items:", error);
      process.exit(1);
    }
  });

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

deferredCommand
  .command("promote")
  .description("Promote a deferred item to a new epic")
  .argument("<id>", "Deferred item ID")
  .action(async (itemId: string) => {
    const projectRoot = process.cwd();

    try {
      // Read the deferred item
      const item = await readDeferredItem(projectRoot, itemId);

      if (!item) {
        console.error(`Deferred item not found: ${itemId}`);
        process.exit(1);
      }

      // Check if already promoted
      if (item.promoted_to_epic_id) {
        console.error(`Deferred item already promoted to epic: ${item.promoted_to_epic_id}`);
        process.exit(1);
      }

      // Ensure .inc directory exists
      await initIncDir(projectRoot);

      // Create epic description from deferred item
      const epicDescription = `${item.description}

## Context

This work was deferred from epic ${item.source_epic_id} because:
${item.rationale}`;

      // Generate slug from title
      const slug = slugify(item.title);

      // Create the epic
      const epic = await createEpic(projectRoot, slug, epicDescription);

      // Register in global registry
      await registerEpic(epic.id, projectRoot, epicDescription, slug);

      // Update deferred item to mark as promoted
      await promoteDeferredItem(projectRoot, itemId, epic.id);

      console.log(`Deferred item promoted to epic: ${epic.id}`);
      console.log(`  Epic slug: ${epic.slug}`);
      console.log(`  Status: ${epic.status}`);
      console.log("");
      console.log(`Next: run 'inc chat ${epic.id}' to start working with the PM`);
    } catch (error) {
      console.error("Failed to promote deferred item:", error);
      process.exit(1);
    }
  });
