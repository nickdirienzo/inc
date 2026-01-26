import React from "react";
import { Box, Text, useInput } from "ink";
import { ContextFile } from "../state/types.js";

interface ContextPaneProps {
  contextFile: ContextFile | null;
  clearContextFile: () => void;
}

const MAX_LINES = 500;

/**
 * ContextPane component displays file contents in the TUI
 * Only renders when contextFile is not null
 */
export const ContextPane: React.FC<ContextPaneProps> = ({
  contextFile,
  clearContextFile,
}) => {
  // Handle Esc key to close
  useInput((input, key) => {
    if (key.escape && contextFile) {
      clearContextFile();
    }
  });

  // Don't render if no file to display
  if (!contextFile) {
    return null;
  }

  // Split content into lines
  const lines = contextFile.content.split("\n");
  const totalLines = lines.length;
  const isTruncated = totalLines > MAX_LINES;

  // Prepare display lines with line numbers
  const displayLines = lines.slice(0, MAX_LINES).map((line, index) => {
    const lineNumber = index + 1;
    const lineNumStr = lineNumber.toString().padStart(4, " ");
    return `${lineNumStr} │ ${line}`;
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="cyan"
      paddingX={1}
      width="30%"
      height="100%"
    >
      {/* Header with file path */}
      <Box marginBottom={1}>
        <Text bold color="cyan">
          {contextFile.path}
        </Text>
      </Box>

      {/* File content with line numbers */}
      <Box flexDirection="column" flexGrow={1} overflow="hidden">
        {displayLines.map((line, index) => (
          <Text key={index} dimColor={index % 2 === 0}>
            {line}
          </Text>
        ))}
        {isTruncated && (
          <Box marginTop={1}>
            <Text color="yellow">
              ... ({totalLines - MAX_LINES} more lines truncated)
            </Text>
          </Box>
        )}
      </Box>

      {/* Footer hint */}
      <Box marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
        <Text dimColor>Press Esc to close</Text>
      </Box>
    </Box>
  );
};
