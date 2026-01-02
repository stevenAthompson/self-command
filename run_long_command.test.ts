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
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { spawn, execSync } from 'child_process';
import { EventEmitter } from 'events';

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
  spawn: vi.fn(),
  execSync: vi.fn(),
}));

describe('run_long_command MCP Server', () => {
  let toolFn: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Dynamically import to trigger tool registration
    await import('./run_long_command.js');
    toolFn = (mockRegisterTool as Mock).mock.calls[0][2];
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('should register the "run_long_command" tool', () => {
    expect(mockRegisterTool).toHaveBeenCalledWith(
      'run_long_command',
      expect.objectContaining({
        description: expect.stringContaining('Executes a long-running shell command'),
      }),
      expect.any(Function),
    );
  });

  it('should fail if not in the correct tmux session', async () => {
    (execSync as Mock).mockImplementation(() => {
      throw new Error('session not found');
    });

    const result = await toolFn({ command: 'ls' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Error: Not running inside tmux session 'gemini-cli'");
  });

  it('should spawn the command and return immediately if in tmux session', async () => {
    (execSync as Mock).mockReturnValue(Buffer.from('')); // has-session succeeds
    const mockChild = new EventEmitter() as any;
    mockChild.unref = vi.fn();
    (spawn as Mock).mockReturnValue(mockChild);

    const result = await toolFn({ command: 'sleep 10' });

    expect(spawn).toHaveBeenCalledWith('sleep 10', expect.objectContaining({
      detached: true,
      stdio: 'ignore',
    }));
    expect(mockChild.unref).toHaveBeenCalled();
    expect(result.content[0].text).toContain('started in the background');
  });

  it('should notify Gemini when the command completes', async () => {
    vi.useFakeTimers();
    (execSync as Mock).mockReturnValue(Buffer.from('')); // All execSync calls succeed
    const mockChild = new EventEmitter() as any;
    mockChild.unref = vi.fn();
    (spawn as Mock).mockReturnValue(mockChild);

    await toolFn({ command: 'echo hello' });

    // Simulate process completion
    mockChild.emit('close', 0);

    // Fast-forward through delays in notifyGemini
    await vi.runAllTimersAsync();

    // Check if tmux send-keys was called
    expect(execSync).toHaveBeenCalledWith(expect.stringContaining('tmux send-keys -t gemini-cli:0.0 Escape'));
    
    // Reconstruct the message from individual send-keys calls
    const sendKeyCalls = (execSync as Mock).mock.calls.map(call => call[0]);
    const typedChars = sendKeyCalls
      .filter(call => call.includes("tmux send-keys -t gemini-cli:0.0 '"))
      .map(call => {
        const match = call.match(/'(.*)'$/);
        return match ? match[1] : '';
      })
      .join('')
      .replace(/'\''/g, "'");

    expect(typedChars).toContain('Background command completed');

    vi.useRealTimers();
  });

  it('should notify Gemini when the command fails to start', async () => {
    vi.useFakeTimers();
    (execSync as Mock).mockReturnValue(Buffer.from('')); 
    const mockChild = new EventEmitter() as any;
    mockChild.unref = vi.fn();
    (spawn as Mock).mockReturnValue(mockChild);

    await toolFn({ command: 'invalid-command' });

    // Simulate error
    mockChild.emit('error', new Error('spawn ENOENT'));

    await vi.runAllTimersAsync();

    // Reconstruct the message from individual send-keys calls
    const sendKeyCalls = (execSync as Mock).mock.calls.map(call => call[0]);
    const typedChars = sendKeyCalls
      .filter(call => call.includes("tmux send-keys -t gemini-cli:0.0 '"))
      .map(call => {
        const match = call.match(/'(.*)'$/);
        return match ? match[1] : '';
      })
      .join('')
      .replace(/'\\''/g, "'");

    expect(typedChars).toContain('Background command failed');

    vi.useRealTimers();
  });
});
