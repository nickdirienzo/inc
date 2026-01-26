import React from "react";
import { Box, Text } from "ink";
import type { EpicWithProject } from "../state/types.js";
import type { EpicStatus } from "../../state/schema.js";

interface EpicListProps {
  epics: EpicWithProject[];
  needsAttention: EpicWithProject[];
}

/**
 * Get color for epic status
 */
function getStatusColor(status: EpicStatus): string {
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
    case "abandoned":
      return "gray";
    default:
      return "white";
  }
}

/**
 * Categorize epics into sections
 */
function categorizeEpics(
  epics: EpicWithProject[],
  needsAttention: EpicWithProject[]
): {
  needsAttention: EpicWithProject[];
  inFlight: EpicWithProject[];
  other: EpicWithProject[];
} {
  // Create a Set of epic IDs that need attention for fast lookup
  const needsAttentionIds = new Set(needsAttention.map((e) => e.id));

  // Status sets for categorization
  const inFlightStatuses: Set<EpicStatus> = new Set([
    "spec_in_progress",
    "spec_complete",
    "plan_in_progress",
    "plan_complete",
    "coding",
    "review",
  ]);

  const otherStatuses: Set<EpicStatus> = new Set(["new", "done", "abandoned"]);

  // Separate epics into categories
  const inFlight: EpicWithProject[] = [];
  const other: EpicWithProject[] = [];

  for (const epic of epics) {
    // Skip epics that need attention (they'll only appear in needsAttention section)
    if (needsAttentionIds.has(epic.id)) {
      continue;
    }

    if (inFlightStatuses.has(epic.status)) {
      inFlight.push(epic);
    } else if (otherStatuses.has(epic.status)) {
      other.push(epic);
    }
  }

  // Sort all sections by updated_at (most recent first)
  const sortByUpdatedAt = (a: EpicWithProject, b: EpicWithProject) =>
    new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();

  needsAttention.sort(sortByUpdatedAt);
  inFlight.sort(sortByUpdatedAt);
  other.sort(sortByUpdatedAt);

  return { needsAttention, inFlight, other };
}

/**
 * Render a single epic entry
 */
function EpicEntry({ epic }: { epic: EpicWithProject }) {
  const statusColor = getStatusColor(epic.status);
  const hasAttention = epic.needs_attention !== undefined;
  const prInfo = epic.pr_number ? ` (PR #${epic.pr_number})` : "";

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box flexDirection="row">
        {hasAttention && (
          <Text color="yellow" bold>
            ⚠️{" "}
          </Text>
        )}
        <Text color="cyan">{epic.id}</Text>
        <Text color={statusColor}> [{epic.status}]</Text>
        {prInfo && <Text color="gray">{prInfo}</Text>}
      </Box>
      <Box paddingLeft={hasAttention ? 3 : 0}>
        <Text dimColor wrap="truncate">
          {epic.projectPath}
        </Text>
      </Box>
    </Box>
  );
}

/**
 * Render a section with header and epics
 */
function Section({
  title,
  count,
  epics,
  emptyMessage,
  color,
}: {
  title: string;
  count: number;
  epics: EpicWithProject[];
  emptyMessage: string;
  color: string;
}) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box marginBottom={1}>
        <Text bold color={color}>
          {title} ({count})
        </Text>
      </Box>
      {epics.length === 0 ? (
        <Box paddingLeft={2}>
          <Text dimColor>{emptyMessage}</Text>
        </Box>
      ) : (
        <Box flexDirection="column" paddingLeft={2}>
          {epics.map((epic) => (
            <EpicEntry key={epic.id} epic={epic} />
          ))}
        </Box>
      )}
    </Box>
  );
}

/**
 * EpicList component
 *
 * Displays epics in three vertical sections:
 * - Needs Attention: Epics with needs_attention flag
 * - In Flight: Active epics (spec_in_progress through review)
 * - Other: New, done, and abandoned epics
 */
export function EpicList({ epics, needsAttention }: EpicListProps) {
  const { needsAttention: needsAttentionEpics, inFlight, other } =
    categorizeEpics(epics, needsAttention);

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="green"
      paddingX={1}
      paddingY={1}
      width="30%"
      height="100%"
      overflow="hidden"
    >
      <Box marginBottom={1}>
        <Text bold color="green">
          EPICS
        </Text>
      </Box>

      <Box flexDirection="column" overflow="hidden">
        {/* Needs Attention Section */}
        <Section
          title="NEEDS ATTENTION"
          count={needsAttentionEpics.length}
          epics={needsAttentionEpics}
          emptyMessage="All clear ✓"
          color="yellow"
        />

        {/* In Flight Section */}
        <Section
          title="IN FLIGHT"
          count={inFlight.length}
          epics={inFlight}
          emptyMessage="No active epics. Run 'inc new' to start one."
          color="cyan"
        />

        {/* Other Section */}
        <Section
          title="OTHER"
          count={other.length}
          epics={other}
          emptyMessage="No other epics."
          color="gray"
        />
      </Box>
    </Box>
  );
}
