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
import { EventEmitter } from 'events';

// Hoist mocks to ensure they are available for vi.mock
const mocks = vi.hoisted(() => ({
  registerTool: vi.fn(),
  connect: vi.fn(),
  spawn: vi.fn(), // We will configure the return value in tests
  existsSync: vi.fn().mockReturnValue(true),
  openSync: vi.fn(),
  closeSync: vi.fn(),
  unlinkSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

vi.mock('fs', () => ({
  default: {
    existsSync: mocks.existsSync,
    openSync: mocks.openSync,
    closeSync: mocks.closeSync,
    unlinkSync: mocks.unlinkSync,
    writeFileSync: mocks.writeFileSync,
  },
  existsSync: mocks.existsSync,
  openSync: mocks.openSync,
  closeSync: mocks.closeSync,
  unlinkSync: mocks.unlinkSync,
  writeFileSync: mocks.writeFileSync,
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
  let runLongCommandFn: Function;
  const ORIGINAL_ENV = process.env;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    process.env = { ...ORIGINAL_ENV }; // Clone env
    mocks.existsSync.mockReturnValue(true); // Default to file existing
    
    // Default spawn mock for simple tools (just unref)
    mocks.spawn.mockReturnValue({ unref: vi.fn() });

    // Dynamically import to trigger tool registration
    await import('./self_command.js');
    
    // Find the tool handlers from the mock calls
    const calls = (mocks.registerTool as Mock).mock.calls;
    const selfCommandCall = calls.find(call => call[0] === 'self_command');
    const yieldTurnCall = calls.find(call => call[0] === 'yield_turn');
    const geminiSleepCall = calls.find(call => call[0] === 'gemini_sleep');
    const watchLogCall = calls.find(call => call[0] === 'watch_log');
    const runLongCommandCall = calls.find(call => call[0] === 'run_long_command');

    if (selfCommandCall) selfCommandFn = selfCommandCall[2];
    if (yieldTurnCall) yieldTurnFn = yieldTurnCall[2];
    if (geminiSleepCall) geminiSleepFn = geminiSleepCall[2];
    if (watchLogCall) watchLogFn = watchLogCall[2];
    if (runLongCommandCall) runLongCommandFn = runLongCommandCall[2];
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
    expect(mocks.registerTool).toHaveBeenCalledWith('run_long_command', expect.any(Object), expect.any(Function));
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
        expect.arrayContaining([expect.stringContaining('delayed_submit.js'),Buffer.from(command).toString('base64')]),
        expect.objectContaining({
            detached: true,
            stdio: 'ignore',
            cwd: expect.any(String)
        })
    );
  });

  it('run_long_command should spawn process and notify on completion', async () => {
    process.env.TMUX = '/tmp/tmux-1000/default,1234,0';
    (execSync as Mock).mockReturnValue('gemini-cli\n');

    // Setup complex spawn mock for run_long_command
    const mockChild = new EventEmitter() as any;
    mockChild.stdout = new EventEmitter();
    mockChild.stderr = new EventEmitter();
    mockChild.unref = vi.fn();
    mockChild.pid = 12345;
    mocks.spawn.mockReturnValue(mockChild);

    const command = 'sleep 5';
    const result = await runLongCommandFn({ command });

    // Verify initial return
    expect(result.content[0].text).toContain('started in the background');
    expect(result.content[0].text).toContain('PID: 12345');

    // Simulate process output and completion
    mockChild.stdout.emit('data', 'some output');
    mockChild.emit('close', 0);

    // Fast-forward timers to handle notification delay
    await vi.runAllTimersAsync();

    // Verify notification was sent via tmux
    // Logic: it calls sendNotification which calls execSync with tmux send-keys
    expect(execSync).toHaveBeenCalledWith(expect.stringContaining('tmux send-keys'));
  });

  it('yield_turn should spawn the yield worker process', async () => {
    process.env.TMUX = '/tmp/tmux-1000/default,1234,0';
    (execSync as Mock).mockReturnValue('gemini-cli\n');

    const result = await yieldTurnFn({});

    expect(result.content[0].text).toContain('Yielding turn');

    expect(mocks.spawn).toHaveBeenCalledWith(
        process.execPath,
        expect.arrayContaining([expect.stringContaining('instant_yield.js')]),
        expect.objectContaining({ detached: true })
    );
  });

  it('gemini_sleep should spawn the sleep worker process', async () => {
    process.env.TMUX = '/tmp/tmux-1000/default,1234,0';
    (execSync as Mock).mockReturnValue('gemini-cli\n');

    const result = await geminiSleepFn({ seconds: 10 });

    expect(result.content[0].text).toContain('Will sleep for 10 seconds');

    expect(mocks.spawn).toHaveBeenCalledWith(
        process.execPath,
        expect.arrayContaining([expect.stringContaining('delayed_sleep.js'), '10']),
        expect.objectContaining({ detached: true })
    );
  });

  it('watch_log should spawn the watch worker process with defaults', async () => {
    process.env.TMUX = '/tmp/tmux-1000/default,1234,0';
    (execSync as Mock).mockReturnValue('gemini-cli\n');

    const result = await watchLogFn({ file_path: '/tmp/log.txt' });

    expect(result.content[0].text).toContain('Log monitor background task');
    expect(result.content[0].text).toContain('started for /tmp/log.txt');

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
});