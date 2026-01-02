#!/usr/bin/bash

SESSION_NAME="gemini-cli"

# 1. Check if the session already exists
tmux has-session -t $SESSION_NAME 2>/dev/null

if [ $? != 0 ]; then
  # 2. Create the session detached (-d) running the specific command
  # Replace 'gemini chat start' with your actual command if different
  tmux new-session -d -s $SESSION_NAME 'gemini'
  
  # Optional: Set a larger history limit for long logs
  tmux set-option -t $SESSION_NAME history-limit 10000
fi

# 3. Attach to the session so you can see/use it manually
tmux attach -t $SESSION_NAME
