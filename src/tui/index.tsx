/**
 * TUI entry point for Inc Epic Control
 * Launches the Ink-based terminal interface
 */

import React from "react";
import { render, type Instance } from "ink";
import { App } from "./components/App.js";

let app: Instance | null = null;

/**
 * Start the TUI mission control interface
 * Returns a cleanup function to stop the TUI
 */
export function start(): () => void {
  try {
    // Show loading message briefly
    console.log("Launching Inc Epic Control...\n");

    // Render the Ink app
    app = render(<App />);

    // Handle cleanup on Ctrl+C
    const handleExit = (): void => {
      if (app) {
        app.unmount();
        app = null;
      }
      process.exit(0);
    };

    // Register exit handlers
    process.on("SIGINT", handleExit);
    process.on("SIGTERM", handleExit);

    // Return cleanup function
    return (): void => {
      if (app) {
        app.unmount();
        app = null;
      }
    };
  } catch (error) {
    // Handle errors gracefully
    console.error("\n❌ Failed to start TUI:");
    if (error instanceof Error) {
      console.error(`   ${error.message}`);
      if (error.stack) {
        console.error("\nStack trace:");
        console.error(error.stack);
      }
    } else {
      console.error(`   ${String(error)}`);
    }
    console.error("\nPlease report this issue if it persists.");
    process.exit(1);
  }
}

/**
 * Wait for TUI to complete (if needed for programmatic usage)
 */
export async function waitUntilExit(): Promise<void> {
  if (app) {
    await app.waitUntilExit();
  }
}
