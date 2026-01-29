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
  let selfCommandFn: Function;
  let yieldTurnFn: Function;
  let geminiSleepFn: Function;
  let watchLogFn: Function;
  const ORIGINAL_ENV = process.env;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    process.env = { ...ORIGINAL_ENV }; // Clone env
    // Dynamically import to trigger tool registration
    await import('./self_command.js');
    
    // Find the tool handlers from the mock calls
    const calls = (mocks.registerTool as Mock).mock.calls;
    const selfCommandCall = calls.find(call => call[0] === 'self_command');
    const yieldTurnCall = calls.find(call => call[0] === 'yield_turn');
    const geminiSleepCall = calls.find(call => call[0] === 'gemini_sleep');
    const watchLogCall = calls.find(call => call[0] === 'watch_log');

    if (selfCommandCall) selfCommandFn = selfCommandCall[2];
    if (yieldTurnCall) yieldTurnFn = yieldTurnCall[2];
    if (geminiSleepCall) geminiSleepFn = geminiSleepCall[2];
    if (watchLogCall) watchLogFn = watchLogCall[2];
  });

  afterEach(() => {
    vi.resetModules();
    vi.useRealTimers();
    process.env = ORIGINAL_ENV; // Restore env
  });

  it('should register all tools', () => {
    expect(mocks.registerTool).toHaveBeenCalledWith('self_command', expect.any(Object), expect.any(Function));
    expect(mocks.registerTool).toHaveBeenCalledWith('yield_turn', expect.any(Object), expect.any(Function));
    expect(mocks.registerTool).toHaveBeenCalledWith('gemini_sleep', expect.any(Object), expect.any(Function));
    expect(mocks.registerTool).toHaveBeenCalledWith('watch_log', expect.any(Object), expect.any(Function));
  });

  it('should fail self_command if TMUX env var is missing', async () => {
    delete process.env.TMUX;
    const result = await selfCommandFn({ command: 'help' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Error: Not running inside tmux session");
  });

  it('should fail self_command if tmux session name does not match', async () => {
    process.env.TMUX = '/tmp/tmux-1000/default,1234,0';
    (execSync as Mock).mockReturnValue('other-session\n');

    const result = await selfCommandFn({ command: 'help' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Error: Not running inside tmux session");
  });

  it('self_command should return immediately and spawn the worker process', async () => {
    process.env.TMUX = '/tmp/tmux-1000/default,1234,0';
    (execSync as Mock).mockReturnValue('gemini-cli\n');

    const command = 'echo hello';
    const result = await selfCommandFn({ command });

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

  it('yield_turn should spawn the yield worker process', async () => {
    process.env.TMUX = '/tmp/tmux-1000/default,1234,0';
    (execSync as Mock).mockReturnValue('gemini-cli\n');

    const result = await yieldTurnFn({});

    expect(result.content[0].text).toContain('Yielding turn');

    // Verify spawn was called
    expect(mocks.spawn).toHaveBeenCalledWith(
        process.execPath,
        expect.arrayContaining([expect.stringContaining('delayed_yield.js')]),
        expect.objectContaining({
            detached: true,
            stdio: 'ignore',
            cwd: expect.any(String)
        })
    );
    
    // Verify unref was called
    expect(mocks.spawn.mock.results[0].value.unref).toHaveBeenCalled();
  });

  // Tests for gemini_sleep
  it('gemini_sleep should spawn the sleep worker process', async () => {
    process.env.TMUX = '/tmp/tmux-1000/default,1234,0';
    (execSync as Mock).mockReturnValue('gemini-cli\n');

    const result = await geminiSleepFn({ seconds: 10 });

    expect(result.content[0].text).toContain('Sleeping for 10 seconds');

    expect(mocks.spawn).toHaveBeenCalledWith(
        process.execPath,
        expect.arrayContaining([expect.stringContaining('delayed_sleep.js'), '10']),
        expect.objectContaining({ detached: true })
    );
  });

  // Tests for watch_log
  it('watch_log should spawn the watch worker process with defaults', async () => {
    process.env.TMUX = '/tmp/tmux-1000/default,1234,0';
    (execSync as Mock).mockReturnValue('gemini-cli\n');

    const result = await watchLogFn({ file_path: '/tmp/log.txt' });

    expect(result.content[0].text).toContain('Watching /tmp/log.txt');

    expect(mocks.spawn).toHaveBeenCalledWith(
        process.execPath,
        expect.arrayContaining([
            expect.stringContaining('delayed_watch.js'), 
            '/tmp/log.txt', 
            '', // No regex
            'true' // Default wake_on_change
        ]),
        expect.objectContaining({ detached: true })
    );
  });

  it('watch_log should spawn the watch worker process with regex', async () => {
    process.env.TMUX = '/tmp/tmux-1000/default,1234,0';
    (execSync as Mock).mockReturnValue('gemini-cli\n');

    const result = await watchLogFn({ file_path: '/tmp/log.txt', regex: 'Error' });

    const encodedRegex = Buffer.from('Error').toString('base64');
    
    expect(mocks.spawn).toHaveBeenCalledWith(
        process.execPath,
        expect.arrayContaining([
            expect.stringContaining('delayed_watch.js'), 
            '/tmp/log.txt', 
            encodedRegex,
            'false' // Default wake_on_change becomes false if regex provided
        ]),
        expect.objectContaining({ detached: true })
    );
  });
});