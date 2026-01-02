/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: MIT
 */

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type Mock,
} from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { execSync } from 'child_process';

// Mock the MCP server and transport
const mockRegisterTool = vi.fn();
const mockConnect = vi.fn();

vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: vi.fn().mockImplementation(() => ({
    registerTool: mockRegisterTool,
    connect: mockConnect,
  })),
}));

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: vi.fn(),
}));

// Mock child_process
vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

describe('self_command MCP Server', () => {
  let toolFn: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // Dynamically import to trigger tool registration
    await import('./self_command.js');
    toolFn = (mockRegisterTool as Mock).mock.calls[0][2];
  });

  afterEach(() => {
    vi.resetModules();
    vi.useRealTimers();
  });

  it('should register the "self_command" tool', () => {
    expect(mockRegisterTool).toHaveBeenCalledWith(
      'self_command',
      expect.objectContaining({
        description: expect.stringContaining('Sends a command to the Gemini CLI itself'),
      }),
      expect.any(Function),
    );
  });

  it('should fail if not in the correct tmux session', async () => {
    (execSync as Mock).mockImplementation(() => {
      throw new Error('session not found');
    });

    const result = await toolFn({ command: 'help' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Error: Not running inside tmux session 'gemini-cli'");
  });

  it('should return immediately and schedule the command', async () => {
    (execSync as Mock).mockReturnValue(Buffer.from('')); // has-session succeeds

    const result = await toolFn({ command: 'echo hello' });

    expect(result.content[0].text).toContain('Will execute "echo hello" in ~3 seconds');
    
    // At this point, no tmux send-keys should have happened (only has-session)
    const callsBeforeDelay = (execSync as Mock).mock.calls.map(c => c[0]);
    expect(callsBeforeDelay.some((cmd: string) => cmd.includes('send-keys'))).toBe(false);
  });

  it('should execute the command after delay', async () => {
    (execSync as Mock).mockReturnValue(Buffer.from('')); 
    
    await toolFn({ command: 'hello' });

    // Fast-forward past the 3s initial delay and typing delays
    await vi.runAllTimersAsync();

    // Verify commands were sent
    const allCalls = (execSync as Mock).mock.calls.map(c => c[0]);
    const sendKeyCalls = allCalls.filter((cmd: string) => cmd.includes('send-keys'));
    
    // Should have calls for Escape, C-u, 'h', 'e', 'l', 'l', 'o', Enter
    expect(sendKeyCalls.length).toBeGreaterThan(5);
    
    const typedChars = sendKeyCalls
    .filter((call: string) => call.includes("tmux send-keys -t gemini-cli:0.0 '"))
    .map((call: string) => {
      const match = call.match(/'(.*)'$/);
      return match ? match[1] : '';
    })
    .join('')
    .replace(/'\''/g, "'");

    expect(typedChars).toBe('hello');
  });
});