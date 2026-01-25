import React from "react";
import { Box, Text } from "ink";
import type { EpicWithProject } from "../state/types.js";

interface EpicOverviewProps {
  epics: EpicWithProject[];
  needsAttention: EpicWithProject[];
}

/**
 * Get color for epic status
 */
function getStatusColor(status: string): string {
  switch (status) {
    case "new":
    case "spec_in_progress":
      return "yellow";
    case "spec_complete":
    case "plan_in_progress":
    case "plan_complete":
      return "blue";
    case "coding":
      return "green";
    case "review":
      return "magenta";
    case "done":
      return "gray";
    default:
      return "white";
  }
}

/**
 * Group epics by project path
 */
function groupEpicsByProject(epics: EpicWithProject[]): Map<string, EpicWithProject[]> {
  const grouped = new Map<string, EpicWithProject[]>();

  for (const epic of epics) {
    const existing = grouped.get(epic.projectPath) || [];
    existing.push(epic);
    grouped.set(epic.projectPath, existing);
  }

  return grouped;
}

/**
 * EpicOverview component
 *
 * Displays epics grouped by project with needs attention section at top.
 * Shows epic status with color coding and PR numbers.
 */
export function EpicOverview({ epics, needsAttention }: EpicOverviewProps) {
  const groupedEpics = groupEpicsByProject(epics);

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Needs Attention Section */}
      {needsAttention.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Box
            borderStyle="double"
            borderColor="yellow"
            paddingX={1}
            paddingY={1}
            flexDirection="column"
          >
            <Text bold color="yellow">⚠️  NEEDS ATTENTION</Text>
            <Box flexDirection="column">
              {needsAttention.map((epic) => {
                const shortId = epic.shortId ?? epic.id.slice(0, 8);
                return (
                <Box key={epic.id} flexDirection="column" marginBottom={1}>
                  <Box>
                    <Text color="yellow" bold>
                      ⚠️  {shortId}
                    </Text>
                    <Text color="gray" dimColor>
                      {" "}{epic.id}
                    </Text>
                    <Text color="gray" dimColor>
                      {" "}({epic.projectPath})
                    </Text>
                  </Box>
                  {epic.needs_attention && (
                    <Box paddingLeft={3}>
                      <Text color="white">
                        {epic.needs_attention.from}: {epic.needs_attention.question}
                      </Text>
                    </Box>
                  )}
                </Box>
              )})}
            </Box>
          </Box>
        </Box>
      )}

      {/* Epics by Project */}
      <Box
        borderStyle="round"
        borderColor="cyan"
        paddingX={1}
        paddingY={1}
        flexDirection="column"
      >
        <Text bold color="cyan">📋 EPICS</Text>
        <Box flexDirection="column">
          {groupedEpics.size === 0 ? (
            <Text color="gray" dimColor>
              No epics found. Run 'inc new "your epic"' to create one.
            </Text>
          ) : (
            Array.from(groupedEpics.entries()).map(([projectPath, projectEpics]) => (
              <Box key={projectPath} flexDirection="column" marginBottom={1}>
                {/* Project Header */}
                <Box marginBottom={1}>
                  <Text color="cyan" bold>
                    {projectPath}
                  </Text>
                </Box>

                {/* Epics for this project */}
                {projectEpics.map((epic) => {
                  const statusColor = getStatusColor(epic.status);
                  const hasAttention = epic.needs_attention !== undefined;
                  const prInfo = epic.pr_number ? ` (PR #${epic.pr_number})` : "";
                  const shortId = epic.shortId ?? epic.id.slice(0, 8);

                  return (
                    <Box key={epic.id} paddingLeft={2} marginBottom={1}>
                      <Box width={12}>
                        <Text>
                          {hasAttention && (
                            <Text color="yellow">⚠️  </Text>
                          )}
                          <Text color="cyan">{shortId}</Text>
                        </Text>
                      </Box>
                      <Box width={30}>
                        <Text color="gray">{epic.id}</Text>
                      </Box>
                      <Box width={20}>
                        <Text color={statusColor}>{epic.status}</Text>
                      </Box>
                      <Box>
                        <Text color="gray">{prInfo}</Text>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            ))
          )}
        </Box>
      </Box>
    </Box>
  );
}
