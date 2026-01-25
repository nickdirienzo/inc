import React, { useState, useEffect, useRef } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import Spinner from "ink-spinner";
import type { AgentMessage } from "../state/types.js";

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

  return (
    <Box flexDirection="column" height="100%">
      {/* Message History */}
      <Box
        borderStyle="round"
        borderColor="green"
        paddingX={1}
        paddingY={1}
        flexDirection="column"
      >
        <Text bold color="green">CHAT</Text>
        <Box flexDirection="column" minHeight={10}>
          {visibleMessages.length === 0 ? (
            <Text dimColor>
              No messages yet. Ask me about missions, or I'll notify you when something needs attention.
            </Text>
          ) : (
            <Box flexDirection="column">
              {visibleMessages.map((msg, idx) => {
                const roleLabel = getRoleLabel(msg.role);
                const roleColor = getRoleColor(msg.role);
                const time = formatTime(msg.timestamp);

                return (
                  <Box key={idx} flexDirection="column" marginBottom={1}>
                    <Box flexDirection="row">
                      <Text bold color={roleColor}>
                        {roleLabel}
                      </Text>
                      <Text dimColor> • {time}</Text>
                    </Box>
                    <Text>{msg.content}</Text>
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

      {/* Input Area */}
      <Box flexDirection="column" marginTop={1}>
        {isMultiline && (
          <Box flexDirection="column" marginBottom={1}>
            <Text dimColor>Multiline mode (press Enter to send, Esc to cancel):</Text>
            {multilineBuffer.map((line, idx) => (
              <Text key={idx} dimColor>
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
                ? "Continue message... (Enter to send)"
                : "Type your message... (Shift+Enter for multiline)"
            }
          />
        </Box>
      </Box>
    </Box>
  );
}
