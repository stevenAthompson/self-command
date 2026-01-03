/**
 * @license
 * Copyright 2026 Steven A. Thompson
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
import { execSync, spawn } from 'child_process';
import path from 'path';

// Hoist mocks to ensure they are available for vi.mock
const mocks = vi.hoisted(() => ({
  registerTool: vi.fn(),
  connect: vi.fn(),
  spawn: vi.fn().mockReturnValue({ unref: vi.fn() }),
}));

vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: vi.fn().mockImplementation(() => ({
    registerTool: mocks.registerTool,
    connect: mocks.connect,
  })),
}));

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: vi.fn(),
}));

// Mock child_process
vi.mock('child_process', () => ({
  execSync: vi.fn(),
  spawn: mocks.spawn,
}));

describe('self_command MCP Server', () => {
  let toolFn: Function;
  const ORIGINAL_ENV = process.env;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    process.env = { ...ORIGINAL_ENV }; // Clone env
    // Dynamically import to trigger tool registration
    await import('./self_command.js');
    toolFn = (mocks.registerTool as Mock).mock.calls[0][2];
  });

  afterEach(() => {
    vi.resetModules();
    vi.useRealTimers();
    process.env = ORIGINAL_ENV; // Restore env
  });

  it('should register the "self_command" tool', () => {
    expect(mocks.registerTool).toHaveBeenCalledWith(
      'self_command',
      expect.objectContaining({
        description: expect.stringContaining('Sends a command to the Gemini CLI itself'),
      }),
      expect.any(Function),
    );
  });

  it('should fail if TMUX env var is missing', async () => {
    delete process.env.TMUX;
    const result = await toolFn({ command: 'help' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Error: Not running inside tmux session");
  });

  it('should fail if tmux session name does not match', async () => {
    process.env.TMUX = '/tmp/tmux-1000/default,1234,0';
    (execSync as Mock).mockReturnValue('other-session\n');

    const result = await toolFn({ command: 'help' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Error: Not running inside tmux session");
  });

  it('should return immediately and spawn the worker process', async () => {
    process.env.TMUX = '/tmp/tmux-1000/default,1234,0';
    (execSync as Mock).mockReturnValue('gemini-cli\n');

    const command = 'echo hello';
    const result = await toolFn({ command });

    expect(result.content[0].text).toContain('Will execute "echo hello" in ~3 seconds');

    // Verify spawn was called
    expect(mocks.spawn).toHaveBeenCalledWith(
        process.execPath,
        expect.arrayContaining([expect.stringContaining('delayed_submit.js'), Buffer.from(command).toString('base64')]),
        expect.objectContaining({
            detached: true,
            stdio: 'ignore',
            cwd: expect.any(String)
        })
    );
    
    // Verify unref was called on the child process
    expect(mocks.spawn.mock.results[0].value.unref).toHaveBeenCalled();
  });
});