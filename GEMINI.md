# GEMINI.md — Project self_command

You are an agentic coding assistant. Your goal is to execute Project self_command phases with **professional engineering hygiene**.  Professional quality means docstrings, comments, logging, and **unit tests** for **all** non-trivial logic. Code that works, but lacks unit tests doesn't count as complete. Code that exists but which isn't documented doesn't not count as complete.

The goal of the project is to create a Gemini Cli Extension. You will start with a copy of another project "run_long_command" in the current directory. You will modify the existing projects files to meet the requirements of the current project instead. The complete project MUST:
	Allow Gemini CLI to send itself commands using the same tmux methodology that the base project "run_long_command" used. In this project however, it will allow Gemini CLI to send itself any arbitrary command rather than performing a shell execution. Given the way the tmux method works this means that when "self_command" is called the currently running tool call will be cancelled if it doesn't exit immediately. So we must return immediately, pause for approximately 3 seconds and THEN send the requested command via tmux. 

	The code should fail gracefully when  gemini was started outside of tmux and commands can't be sent, and it should fail BEFORE trying to send the command to gemini cli.
	
	The final project output should not include any references to the original base project "run_long_command". All code, documentation, tests, etc should be cleaned up.
	
	The final working project should be uploaded to a new public github repository. 
	
	Ask questions if you are confused or stumped by an instruciton or find problems in the code that can not be solved. Do not make assumptions.

After EVERY turn you must:
	Append the current progress to a file named name "progress.md". Include a brief description of the most recent work. This file should only ever be appended to: NEVER delete this file. NEVER edit this file. It is a log of all progress, even mistakes. You may check the file for historical information about progress to prevent yourself from repeating past mistakes. 
	Do NOT edit unit tests to work around failing tests. Hacking, altering, skipping, or avoiding tests that are faillng to avoid fixing the root issue is prohibited. If you are stuck ask for help and end your turn instead.
	In another file named "project_results.md":
		* Write or update the overview of the project so far. 
		* Include a high level description of the projects purpose, stated goals, and the various phases and work done so far.
		* Include the output of test results so far and how those compare to baseline numbers.
		* Include a FAQ.
		* Include basic troubleshooting steps should something go wrong.
		* Include a list of the all the customized code and a brief description of what each does. Include instructions for using the project and for running the full testing pipeline.
		* Include any miscellaneous information that another AI or programmer might want or need to know about the project, including dependencies and steps require to reproduce the work.
		* Describe any challenges that were encountered along the way, and how they were overcome. Include enough detail that a reader can determine if/why solutions were deemed to be optimal. Do not justify those decisions, just describe them.
		* Update this file with every turn to ensure that it stays up to date and complete. This is the primary deliverable of the project and must be 100% accurate and complete. 
