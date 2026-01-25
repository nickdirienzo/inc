import React, { useState, useEffect, useRef } from "react";
import { Box, Text, useInput, useStdout } from "ink";
import TextInput from "ink-text-input";
import Spinner from "ink-spinner";
import type { AgentMessage } from "../state/types.js";

const MAX_MESSAGE_LINES = 15;

interface ChatInterfaceProps {
  messages: AgentMessage[];
  isThinking: boolean;
  onSendMessage: (content: string) => Promise<void>;
}

/**
 * Format a timestamp to a readable time string
 */
function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

/**
 * Get display label for agent role
 */
function getRoleLabel(role: AgentMessage["role"]): string {
  switch (role) {
    case "pm":
      return "PM";
    case "tech_lead":
      return "Tech Lead";
    case "coder":
      return "Coder";
    case "user":
      return "You";
    default:
      return "Agent";
  }
}

/**
 * Get color for agent role
 */
function getRoleColor(role: AgentMessage["role"]): string {
  switch (role) {
    case "user":
      return "cyan";
    case "pm":
      return "green";
    case "tech_lead":
      return "blue";
    case "coder":
      return "magenta";
    default:
      return "white";
  }
}

/**
 * ChatInterface component displays message history and handles user input
 */
export function ChatInterface({ messages, isThinking, onSendMessage }: ChatInterfaceProps) {
  const [inputValue, setInputValue] = useState("");
  const [isMultiline, setIsMultiline] = useState(false);
  const [multilineBuffer, setMultilineBuffer] = useState<string[]>([]);
  const messagesEndRef = useRef<number>(0);
  const { stdout } = useStdout();
  const terminalWidth = stdout?.columns ?? 80;

  // Auto-scroll effect when new messages appear
  useEffect(() => {
    messagesEndRef.current = messages.length;
  }, [messages.length]);

  // Handle key inputs for multiline support
  useInput((input, key) => {
    // Shift+Enter starts/continues multiline mode
    if (key.shift && key.return) {
      if (!isMultiline) {
        setIsMultiline(true);
        setMultilineBuffer([inputValue]);
        setInputValue("");
      } else {
        setMultilineBuffer([...multilineBuffer, inputValue]);
        setInputValue("");
      }
      return;
    }

    // Escape cancels multiline mode
    if (key.escape && isMultiline) {
      setIsMultiline(false);
      setMultilineBuffer([]);
      setInputValue("");
      return;
    }
  });

  // Handle message submission
  const handleSubmit = async (value: string) => {
    if (isThinking) {
      return; // Don't allow sending while agent is thinking
    }

    let messageToSend = value;

    // If in multiline mode, combine buffer with current value
    if (isMultiline) {
      const allLines = [...multilineBuffer, value];
      messageToSend = allLines.join("\n");
      setIsMultiline(false);
      setMultilineBuffer([]);
    }

    const trimmed = messageToSend.trim();
    if (!trimmed) {
      setInputValue("");
      return;
    }

    setInputValue("");
    await onSendMessage(trimmed);
  };

  // Determine visible messages (last 20 to avoid overflow)
  const visibleMessages = messages.slice(-20);

  const contentWidth = Math.max(20, terminalWidth - 6);

  const truncateMessage = (content: string): string => {
    const lines = content.split("\n");
    if (lines.length <= MAX_MESSAGE_LINES) {
      return content;
    }
    return lines.slice(0, MAX_MESSAGE_LINES).join("\n") + "\n... (truncated)";
  };

  return (
    <Box flexDirection="column" height="100%" overflow="hidden">
      {/* Message History - flexGrow so it takes available space, flexShrink so input stays visible */}
      <Box
        borderStyle="round"
        borderColor="green"
        paddingX={1}
        paddingY={1}
        flexDirection="column"
        overflow="hidden"
        flexGrow={1}
        flexShrink={1}
      >
        <Text bold color="green">CHAT</Text>
        <Box flexDirection="column" minHeight={10} overflow="hidden">
          {visibleMessages.length === 0 ? (
            <Text dimColor wrap="truncate">
              No messages yet. Ask me about epics, or I'll notify you when something needs attention.
            </Text>
          ) : (
            <Box flexDirection="column" overflow="hidden">
              {visibleMessages.map((msg, idx) => {
                const roleLabel = getRoleLabel(msg.role);
                const roleColor = getRoleColor(msg.role);
                const time = formatTime(msg.timestamp);
                const displayContent = truncateMessage(msg.content);

                return (
                  <Box key={idx} flexDirection="column" marginBottom={1} width={contentWidth}>
                    <Box flexDirection="row">
                      <Text bold color={roleColor}>
                        {roleLabel}
                      </Text>
                      <Text dimColor> • {time}</Text>
                    </Box>
                    <Text wrap="wrap">{displayContent}</Text>
                  </Box>
                );
              })}
            </Box>
          )}

          {/* Thinking Indicator */}
          {isThinking && (
            <Box marginTop={1}>
              <Text color="yellow">
                <Spinner type="dots" />
              </Text>
              <Text dimColor> Agent is typing...</Text>
            </Box>
          )}
        </Box>
      </Box>

      {/* Input Area - flexShrink={0} ensures it stays visible */}
      <Box flexDirection="column" marginTop={1} flexShrink={0}>
        {isMultiline && (
          <Box flexDirection="column" marginBottom={1}>
            <Text dimColor wrap="truncate">Multiline mode (Enter to send, Esc to cancel):</Text>
            {multilineBuffer.slice(-3).map((line, idx) => (
              <Text key={idx} dimColor wrap="truncate">
                {idx + 1}: {line}
              </Text>
            ))}
          </Box>
        )}

        <Box flexDirection="row">
          <Text color="cyan">{isMultiline ? `${multilineBuffer.length + 1}:` : ">"} </Text>
          <TextInput
            value={inputValue}
            onChange={setInputValue}
            onSubmit={handleSubmit}
            placeholder={
              isMultiline
                ? "Enter to send"
                : "Type message..."
            }
          />
        </Box>
      </Box>
    </Box>
  );
}
