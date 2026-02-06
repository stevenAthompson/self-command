import { spawn, execSync } from 'child_process';
import { waitForStability } from './tmux_utils.js';
const TEST_SESSION = 'gemini-test-stability';
async function main() {
    // 1. Setup test session
    try {
        execSync(`tmux kill-session -t ${TEST_SESSION} 2>/dev/null`);
    }
    catch (e) { }
    execSync(`tmux new-session -d -s ${TEST_SESSION} -n main`);
    const target = `${TEST_SESSION}:0.0`;
    console.log(`Test session started: ${target}`);
    // 2. Start a "user cursor moving" simulator in background
    // This moves the cursor every 2 seconds. 
    // waitForStability SHOULD FAIL to find stability if it cares about cursor.
    // If it returns true (stable) while cursor is moving, it confirms the bug.
    const typer = spawn('bash', ['-c', `
        # Type some text first so we have something to move over
        tmux send-keys -t ${target} "Hello World"
        sleep 1
        for i in {1..15}; do
            tmux send-keys -t ${target} Left
            sleep 2
        done
    `], { stdio: 'inherit' });
    console.log("Cursor simulator started (moving every 2s)...");
    console.log("Waiting for stability (requirement: 10s stable)...");
    const startTime = Date.now();
    const isStable = await waitForStability(target, 10000, 1000, 20000); // Wait up to 20s
    const duration = Date.now() - startTime;
    console.log(`waitForStability returned: ${isStable} after ${duration}ms`);
    // Cleanup
    typer.kill();
    execSync(`tmux kill-session -t ${TEST_SESSION}`);
    if (isStable) {
        console.error("FAIL: Detected stability while user was moving cursor! (Bug Confirmed)");
        process.exit(1); // We want to see this fail to confirm the bug
    }
    else {
        console.log("PASS: Did not detect stability (timeout as expected).");
        process.exit(0);
    }
}
main();
