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
  spawn: vi.fn(), // We will configure the return value in tests
  existsSync: vi.fn().mockReturnValue(true),
}));

vi.mock('fs', () => ({
  default: {
    existsSync: mocks.existsSync,
  },
  existsSync: mocks.existsSync,
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
  spawnSync: vi.fn().mockReturnValue({ status: 0 }),
}));

describe('self_command Extensions', () => {
  let sendKeysFn: Function;
  let capturePaneFn: Function;
  let createPaneFn: Function;
  let closePaneFn: Function;
  let waitForIdleFn: Function;
  const ORIGINAL_ENV = process.env;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    process.env = { ...ORIGINAL_ENV }; // Clone env
    
    // Default spawn mock
    mocks.spawn.mockReturnValue({ unref: vi.fn() });

    // Mock execSync to return expected values for tmux checks
    (execSync as Mock).mockImplementation((cmd: string) => {
        if (cmd.includes('tmux display-message')) return 'gemini-cli\n';
        if (cmd.includes('tmux split-window')) return '%2\n';
        if (cmd.includes('tmux capture-pane')) return 'captured content\n';
        return '';
    });
    process.env.TMUX = '/tmp/tmux-1000/default,1234,0';

    // Dynamically import to trigger tool registration
    // We need to re-import or reset modules to ensure registerTool is called again
    vi.resetModules();
    await import('./self_command.js');
    
    // Find the tool handlers from the mock calls
    const calls = (mocks.registerTool as Mock).mock.calls;
    
    const sendKeysCall = calls.find(call => call[0] === 'send_keys');
    const capturePaneCall = calls.find(call => call[0] === 'capture_pane');
    const createPaneCall = calls.find(call => call[0] === 'create_pane');
    const closePaneCall = calls.find(call => call[0] === 'close_pane');
    const waitForIdleCall = calls.find(call => call[0] === 'wait_for_idle');

    if (sendKeysCall) sendKeysFn = sendKeysCall[2];
    if (capturePaneCall) capturePaneFn = capturePaneCall[2];
    if (createPaneCall) createPaneFn = createPaneCall[2];
    if (closePaneCall) closePaneFn = closePaneCall[2];
    if (waitForIdleCall) waitForIdleFn = waitForIdleCall[2];
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env = ORIGINAL_ENV;
  });

  it('should register extension tools', () => {
    expect(mocks.registerTool).toHaveBeenCalledWith('send_keys', expect.any(Object), expect.any(Function));
    expect(mocks.registerTool).toHaveBeenCalledWith('capture_pane', expect.any(Object), expect.any(Function));
    expect(mocks.registerTool).toHaveBeenCalledWith('create_pane', expect.any(Object), expect.any(Function));
    expect(mocks.registerTool).toHaveBeenCalledWith('close_pane', expect.any(Object), expect.any(Function));
    expect(mocks.registerTool).toHaveBeenCalledWith('wait_for_idle', expect.any(Object), expect.any(Function));
  });

  it('send_keys should execute tmux send-keys', async () => {
    const result = await sendKeysFn({ keys: 'ls -l', pane_id: '%1' });
    expect(result.content[0].text).toContain('Sent keys "ls -l" to pane %1');
    expect(execSync).toHaveBeenCalledWith(expect.stringContaining("tmux send-keys -t %1 'ls -l'"));
  });

  it('capture_pane should execute tmux capture-pane', async () => {
    const result = await capturePaneFn({ pane_id: '%1' });
    expect(result.content[0].text).toContain('captured content');
    expect(execSync).toHaveBeenCalledWith(expect.stringContaining("tmux capture-pane -p -t %1"), expect.anything());
  });

  it('create_pane should execute tmux split-window and return pane ID', async () => {
    const result = await createPaneFn({ command: 'top', direction: 'horizontal' });
    expect(result.content[0].text).toContain('Created new pane %2 running "top"');
    expect(execSync).toHaveBeenCalledWith(expect.stringContaining("tmux split-window -P -F \"#{pane_id}\" -h 'top'"), expect.anything());
  });

  it('close_pane should execute tmux kill-pane', async () => {
    const result = await closePaneFn({ pane_id: '%2' });
    expect(result.content[0].text).toContain('Closed pane %2');
    expect(execSync).toHaveBeenCalledWith(expect.stringContaining("tmux kill-pane -t %2"));
  });

  it('wait_for_idle should spawn delayed_idle worker', async () => {
    const result = await waitForIdleFn({ cpu_threshold: 10, duration_seconds: 5 });
    expect(result.content[0].text).toContain('Idle monitor');
    
    expect(mocks.spawn).toHaveBeenCalledWith(
        process.execPath,
        expect.arrayContaining([
            expect.stringContaining('delayed_idle.js'),
            '10',
            '5'
        ]),
        expect.objectContaining({ detached: true })
    );
  });
});
