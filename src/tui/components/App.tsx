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
import { executeTuiAgentQuery } from "../agent/query.js";

/**
 * Maximum number of messages to keep in chat history
 */
const MAX_CHAT_HISTORY = 20;

/**
 * Enforce message limit by keeping only the most recent messages
 */
function enforceMessageLimit(messages: AgentMessage[]): AgentMessage[] {
  if (messages.length <= MAX_CHAT_HISTORY) {
    return messages;
  }
  // Keep only the last MAX_CHAT_HISTORY messages
  return messages.slice(-MAX_CHAT_HISTORY);
}

/**
 * Convert technical error messages to user-friendly ones
 */
function getUserFriendlyErrorMessage(error: string): string {
  // Network-related errors
  if (error.includes("ECONNREFUSED") || error.includes("ENOTFOUND") || error.includes("network")) {
    return "Unable to connect to the agent. Please check your network connection and try again.";
  }

  // API/Authentication errors
  if (error.includes("401") || error.includes("unauthorized") || error.includes("authentication")) {
    return "Authentication failed. Please check your API credentials.";
  }

  // Rate limiting
  if (error.includes("429") || error.includes("rate limit")) {
    return "Too many requests. Please wait a moment and try again.";
  }

  // Timeout errors
  if (error.includes("timeout") || error.includes("ETIMEDOUT")) {
    return "The request timed out. Please try again.";
  }

  // File not found
  if (error.includes("ENOENT") || error.includes("not found")) {
    return "A required file was not found. Please verify your project setup.";
  }

  // Generic fallback
  return "Something went wrong. Please try again or check the console for details.";
}

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

  // Track which needs_attention alerts we've already posted
  const [alertedQuestions, setAlertedQuestions] = useState<Set<string>>(new Set());

  // Agent response handler
  const [agentState] = useState(() => new AgentResponseState());

  // Setup missions monitoring
  useEffect(() => {
    const missionsMonitor = createUseMissions((result: UseMissionsResult) => {
      setState((prev) => {
        // Detect new or changed needs_attention flags
        const newMessages: AgentMessage[] = [];

        for (const mission of result.needsAttention) {
          if (mission.needs_attention) {
            // Create hash for deduplication
            const hash = `${mission.id}:${mission.needs_attention.question}`;

            // Only post message if we haven't alerted for this exact question before
            if (!alertedQuestions.has(hash)) {
              newMessages.push({
                role: "mission_control" as const,
                content: `⚠️  Mission "${mission.id}" needs your attention: ${mission.needs_attention.question}`,
                timestamp: new Date().toISOString(),
              });

              // Add to set
              setAlertedQuestions((prevSet) => new Set(prevSet).add(hash));
            }
          }
        }

        // If we have new messages, append them
        if (newMessages.length > 0) {
          return {
            ...prev,
            missions: result,
            messages: enforceMessageLimit([...prev.messages, ...newMessages]),
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
  }, [alertedQuestions]);

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
      messages: enforceMessageLimit([...prev.messages, userMessage]),
      isThinking: true,
    }));

    try {
      // Get project root (can be refined later)
      const projectRoot = process.cwd();

      // Initialize agent message that we'll update incrementally
      let agentMessageContent = "";
      let agentMessageAdded = false;

      // Iterate through query responses
      for await (const response of executeTuiAgentQuery(content, projectRoot)) {
        if (response.type === 'text') {
          // Append to current agent message content
          agentMessageContent += response.content;

          // Update or add agent message
          setState((prev) => {
            const messages = [...prev.messages];

            if (!agentMessageAdded) {
              // Add new agent message
              messages.push({
                role: "mission_control",
                content: agentMessageContent,
                timestamp: new Date().toISOString(),
              });
              agentMessageAdded = true;
            } else {
              // Update existing agent message (last one)
              messages[messages.length - 1] = {
                ...messages[messages.length - 1],
                content: agentMessageContent,
              };
            }

            return {
              ...prev,
              messages: enforceMessageLimit(messages),
            };
          });
        } else if (response.type === 'thinking') {
          // Keep thinking indicator on
          // (isThinking is already true)
        } else if (response.type === 'complete') {
          // Mark thinking as complete
          setState((prev) => ({
            ...prev,
            isThinking: false,
          }));

          // Process file references in the complete response
          // Only process if we have content
          if (agentMessageContent.trim()) {
            try {
              const contextFile = await processAgentResponse(agentMessageContent);

              if (contextFile) {
                setState((prev) => ({
                  ...prev,
                  contextFile,
                }));
              }
            } catch (fileError) {
              // Log file processing errors but don't crash
              console.error("Error processing file references:", fileError);
            }
          }
        } else if (response.type === 'error') {
          // Log full error for debugging
          console.error("Agent error:", response.error);

          // Show user-friendly error message in chat
          const errorMessage: AgentMessage = {
            role: "mission_control",
            content: getUserFriendlyErrorMessage(response.error),
            timestamp: new Date().toISOString(),
          };

          setState((prev) => ({
            ...prev,
            messages: agentMessageAdded
              ? prev.messages
              : enforceMessageLimit([...prev.messages, errorMessage]),
            isThinking: false,
          }));
        }
      }

      // Edge case: Don't add empty messages to chat
      // If agentMessageAdded is true but content is empty, remove it
      if (agentMessageAdded && !agentMessageContent.trim()) {
        setState((prev) => ({
          ...prev,
          messages: prev.messages.slice(0, -1), // Remove last (empty) message
        }));
      }
    } catch (error) {
      // Log full error to console for debugging
      console.error("Unexpected error in agent query:", error);

      // Show user-friendly error message in chat
      const errorMessage: AgentMessage = {
        role: "mission_control",
        content: getUserFriendlyErrorMessage(
          error instanceof Error ? error.message : String(error)
        ),
        timestamp: new Date().toISOString(),
      };

      setState((prev) => ({
        ...prev,
        messages: enforceMessageLimit([...prev.messages, errorMessage]),
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
