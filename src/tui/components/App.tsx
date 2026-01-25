/**
 * App root component for Strike Mission Control TUI
 *
 * Implements three-pane layout:
 * - Top 40%: MissionOverview
 * - Bottom-left 60% height, 60% width: ChatInterface
 * - Bottom-right 60% height, 40% width: ContextPane (conditional)
 */

import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import { MissionOverview } from "./MissionOverview.js";
import { ChatInterface } from "./ChatInterface.js";
import { ContextPane } from "./ContextPane.js";
import { createUseMissions } from "../state/useMissions.js";
import { AgentResponseState, processAgentResponse } from "../state/useAgent.js";
import type { AgentMessage, ContextFile } from "../state/types.js";
import type { UseMissionsResult } from "../state/useMissions.js";

/**
 * App component state
 */
interface AppState {
  missions: UseMissionsResult;
  messages: AgentMessage[];
  isThinking: boolean;
  contextFile: ContextFile | null;
}

/**
 * Main App component for TUI Mission Control
 *
 * Manages global state and coordinates between child components
 */
export function App() {
  // State management
  const [state, setState] = useState<AppState>({
    missions: {
      missions: [],
      needsAttention: [],
      loading: true,
    },
    messages: [],
    isThinking: false,
    contextFile: null,
  });

  // Agent response handler
  const [agentState] = useState(() => new AgentResponseState());

  // Setup missions monitoring
  useEffect(() => {
    const missionsMonitor = createUseMissions((result: UseMissionsResult) => {
      setState((prev) => {
        // Proactive alerts for missions needing attention
        const hasNewAttention = result.needsAttention.length > 0 && prev.missions.needsAttention.length === 0;

        if (hasNewAttention) {
          // New mission needs attention - add proactive message
          const attentionMessages: AgentMessage[] = result.needsAttention.map((mission) => ({
            role: "pm" as const,
            content: `⚠️  Mission "${mission.id}" needs your attention: ${mission.needs_attention?.question || "Please review"}`,
            timestamp: new Date().toISOString(),
          }));

          return {
            ...prev,
            missions: result,
            messages: [...prev.messages, ...attentionMessages],
          };
        }

        return {
          ...prev,
          missions: result,
        };
      });
    });

    // Start monitoring
    missionsMonitor.start();

    // Cleanup on unmount
    return () => {
      missionsMonitor.stop();
    };
  }, []);

  /**
   * Handle sending a message to the agent
   */
  const handleSendMessage = async (content: string): Promise<void> => {
    // Add user message
    const userMessage: AgentMessage = {
      role: "user",
      content,
      timestamp: new Date().toISOString(),
    };

    setState((prev) => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      isThinking: true,
    }));

    try {
      // TODO: Integrate with Claude Agent SDK
      // For now, simulate agent response
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const agentMessage: AgentMessage = {
        role: "pm",
        content: `I received your message: "${content}". Agent integration is in progress.`,
        timestamp: new Date().toISOString(),
      };

      // Check for file references in response
      const contextFile = await processAgentResponse(agentMessage.content);

      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, agentMessage],
        isThinking: false,
        contextFile: contextFile || prev.contextFile,
      }));
    } catch (error) {
      // Handle error
      const errorMessage: AgentMessage = {
        role: "pm",
        content: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        timestamp: new Date().toISOString(),
      };

      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, errorMessage],
        isThinking: false,
      }));
    }
  };

  /**
   * Clear the context file pane
   */
  const clearContextFile = (): void => {
    setState((prev) => ({
      ...prev,
      contextFile: null,
    }));
    agentState.clearContextFile();
  };

  // Loading state
  if (state.missions.loading) {
    return (
      <Box flexDirection="column" padding={2}>
        <Text color="cyan">Loading Strike Mission Control...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" width="100%" height="100%">
      {/* Top 40%: Mission Overview */}
      <Box height="40%" flexDirection="column">
        <MissionOverview
          missions={state.missions.missions}
          needsAttention={state.missions.needsAttention}
        />
      </Box>

      {/* Bottom 60%: Chat and Context Pane */}
      <Box height="60%" flexDirection="row">
        {/* Bottom-left: Chat Interface (60% width or 100% if no context pane) */}
        <Box
          width={state.contextFile ? "60%" : "100%"}
          flexDirection="column"
        >
          <ChatInterface
            messages={state.messages}
            isThinking={state.isThinking}
            onSendMessage={handleSendMessage}
          />
        </Box>

        {/* Bottom-right: Context Pane (40% width, conditional) */}
        {state.contextFile && (
          <ContextPane
            contextFile={state.contextFile}
            clearContextFile={clearContextFile}
          />
        )}
      </Box>
    </Box>
  );
}
