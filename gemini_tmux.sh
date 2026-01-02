#!/bin/bash

# Configuration
SESSION_NAME="gemini-cli"

# Check if session already exists
tmux has-session -t "$SESSION_NAME" 2>/dev/null

if [ $? != 0 ]; then
  echo "Starting new tmux session: $SESSION_NAME"
  # Create a new session, but don't attach yet
  tmux new-session -d -s "$SESSION_NAME"
  
  # Optional: Send clear command to the first pane
  tmux send-keys -t "$SESSION_NAME" "clear" C-m
  
  echo "Session '$SESSION_NAME' created."
else
  echo "Session '$SESSION_NAME' already exists."
fi

# Attach to the session
echo "Attaching to session..."
tmux attach-session -t "$SESSION_NAME"
