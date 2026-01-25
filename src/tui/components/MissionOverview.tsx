import React from "react";
import { Box, Text } from "ink";
import type { MissionWithProject } from "../state/types.js";

interface MissionOverviewProps {
  missions: MissionWithProject[];
  needsAttention: MissionWithProject[];
}

/**
 * Get color for mission status
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
 * Group missions by project path
 */
function groupMissionsByProject(missions: MissionWithProject[]): Map<string, MissionWithProject[]> {
  const grouped = new Map<string, MissionWithProject[]>();

  for (const mission of missions) {
    const existing = grouped.get(mission.projectPath) || [];
    existing.push(mission);
    grouped.set(mission.projectPath, existing);
  }

  return grouped;
}

/**
 * MissionOverview component
 *
 * Displays missions grouped by project with needs attention section at top.
 * Shows mission status with color coding and PR numbers.
 */
export function MissionOverview({ missions, needsAttention }: MissionOverviewProps) {
  const groupedMissions = groupMissionsByProject(missions);

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
              {needsAttention.map((mission) => (
                <Box key={mission.id} flexDirection="column" marginBottom={1}>
                  <Box>
                    <Text color="yellow" bold>
                      ⚠️  {mission.id}
                    </Text>
                    <Text color="gray" dimColor>
                      {" "}({mission.projectPath})
                    </Text>
                  </Box>
                  {mission.needs_attention && (
                    <Box paddingLeft={3}>
                      <Text color="white">
                        {mission.needs_attention.from}: {mission.needs_attention.question}
                      </Text>
                    </Box>
                  )}
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      )}

      {/* Missions by Project */}
      <Box
        borderStyle="round"
        borderColor="cyan"
        paddingX={1}
        paddingY={1}
        flexDirection="column"
      >
        <Text bold color="cyan">📋 MISSIONS</Text>
        <Box flexDirection="column">
          {groupedMissions.size === 0 ? (
            <Text color="gray" dimColor>
              No missions found. Run 'strike new "your mission"' to create one.
            </Text>
          ) : (
            Array.from(groupedMissions.entries()).map(([projectPath, projectMissions]) => (
              <Box key={projectPath} flexDirection="column" marginBottom={1}>
                {/* Project Header */}
                <Box marginBottom={1}>
                  <Text color="cyan" bold>
                    {projectPath}
                  </Text>
                </Box>

                {/* Missions for this project */}
                {projectMissions.map((mission) => {
                  const statusColor = getStatusColor(mission.status);
                  const hasAttention = mission.needs_attention !== undefined;
                  const prInfo = mission.pr_number ? ` (PR #${mission.pr_number})` : "";

                  return (
                    <Box key={mission.id} paddingLeft={2} marginBottom={1}>
                      <Box width={30}>
                        <Text>
                          {hasAttention && (
                            <Text color="yellow">⚠️  </Text>
                          )}
                          <Text>{mission.id}</Text>
                        </Text>
                      </Box>
                      <Box width={20}>
                        <Text color={statusColor}>{mission.status}</Text>
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
