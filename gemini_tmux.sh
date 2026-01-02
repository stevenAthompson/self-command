#!/bin/bash

# Configuration
SESSION_NAME="${GEMINI_TMUX_SESSION_NAME:-gemini-cli}"
export GEMINI_TMUX_SESSION_NAME="$SESSION_NAME"

# Determine command to run
CMD="$@"

# Check if session already exists
if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
  echo "Session '$SESSION_NAME' already exists."
  
  if [ ! -z "$CMD" ]; then
    echo "Sending command to existing session: $CMD"
    tmux send-keys -t "$SESSION_NAME" "$CMD" C-m
  fi
  
  echo "Attaching..."
  tmux attach-session -t "$SESSION_NAME"
  exit 0
fi

if [ -z "$CMD" ]; then
  echo "Usage: $0 <command_to_run>"
  echo "Example: $0 gemini run my_instruction.md"
  exit 1
fi

echo "Starting new tmux session: $SESSION_NAME"
# Create a new session with a shell (so it doesn't close when cmd finishes)
# -d: Detached
# -s: Session name
tmux new-session -d -s "$SESSION_NAME"

# Wait a moment for shell to initialize
sleep 0.5

# Send the command to the session
echo "Sending command: $CMD"
tmux send-keys -t "$SESSION_NAME" "$CMD" C-m

# Attach to the session
echo "Attaching..."
tmux attach-session -t "$SESSION_NAME"
