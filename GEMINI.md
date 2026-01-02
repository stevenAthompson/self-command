# GEMINI.md — Project self_command

You are an agentic coding assistant. Your goal is to execute Project self_command phases with **professional engineering hygiene**.  Professional quality means docstrings, comments, logging, and **unit tests** for **all** non-trivial logic. Code that works, but lacks unit tests doesn't count as complete. Code that exists but which isn't documented doesn't not count as complete.

The goal of the project is to create a Gemini Cli Extension. You will start with a copy of another project "run_long_command" in the current directory. You will modify the existing projects files to meet the requirements of the current project instead. The complete project MUST:
	Allow Gemini CLI to send itself commands using the same tmux methodology that the base project "run_long_command" used. In this project however, it will allow Gemini CLI to send itself any arbitrary command rather than performing a shell execution. Given the way the tmux method works this means that when "self_command" is called the currently running tool call will be cancelled if it doesn't exit immediately. So we must return immediately, pause for approximately 3 seconds and THEN send the requested command via tmux. 

	The code should fail gracefully when  gemini was started outside of tmux and commands can't be sent, and it should fail BEFORE trying to send the command to gemini cli.
	
	The final project output should not include any references to the original base project "run_long_command". All code, documentation, tests, etc should be cleaned up.
	
	The final working project should be uploaded to a new public github repository. 
	
	Ask questions if you are confused or stumped by an instruciton or find problems in the code that can not be solved. Do not make assumptions.
	
	All code must be portable and use the proper variables. No hardcoded paths, etc.
	
	The gemini_tmux.sh file is required to launch gemini cli properly inside of a tmux session. Don't delete it. You may tweak it if it needs to be updated or corrected.

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


Below is a guide to building Gemini CLI Extensions & a Guide to Releasing them:

# Getting started with Gemini CLI extensions

This guide will walk you through creating your first Gemini CLI extension.
You'll learn how to set up a new extension, add a custom tool via an MCP server,
create a custom command, and provide context to the model with a `GEMINI.md`
file.

## Prerequisites

Before you start, make sure you have the Gemini CLI installed and a basic
understanding of Node.js and TypeScript.

## Step 1: Create a new extension

The easiest way to start is by using one of the built-in templates. We'll use
the `mcp-server` example as our foundation.

Run the following command to create a new directory called `my-first-extension`
with the template files:

```bash
gemini extensions new my-first-extension mcp-server
```

This will create a new directory with the following structure:

```
my-first-extension/
├── example.ts
├── gemini-extension.json
├── package.json
└── tsconfig.json
```

## Step 2: Understand the extension files

Let's look at the key files in your new extension.

### `gemini-extension.json`

This is the manifest file for your extension. It tells Gemini CLI how to load
and use your extension.

```json
{
  "name": "my-first-extension",
  "version": "1.0.0",
  "mcpServers": {
    "nodeServer": {
      "command": "node",
      "args": ["${extensionPath}${/}dist${/}example.js"],
      "cwd": "${extensionPath}"
    }
  }
}
```

- `name`: The unique name for your extension.
- `version`: The version of your extension.
- `mcpServers`: This section defines one or more Model Context Protocol (MCP)
  servers. MCP servers are how you can add new tools for the model to use.
  - `command`, `args`, `cwd`: These fields specify how to start your server.
    Notice the use of the `${extensionPath}` variable, which Gemini CLI replaces
    with the absolute path to your extension's installation directory. This
    allows your extension to work regardless of where it's installed.

### `example.ts`

This file contains the source code for your MCP server. It's a simple Node.js
server that uses the `@modelcontextprotocol/sdk`.

```typescript
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({
  name: 'prompt-server',
  version: '1.0.0',
});

// Registers a new tool named 'fetch_posts'
server.registerTool(
  'fetch_posts',
  {
    description: 'Fetches a list of posts from a public API.',
    inputSchema: z.object({}).shape,
  },
  async () => {
    const apiResponse = await fetch(
      'https://jsonplaceholder.typicode.com/posts',
    );
    const posts = await apiResponse.json();
    const response = { posts: posts.slice(0, 5) };
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response),
        },
      ],
    };
  },
);

// ... (prompt registration omitted for brevity)

const transport = new StdioServerTransport();
await server.connect(transport);
```

This server defines a single tool called `fetch_posts` that fetches data from a
public API.

### `package.json` and `tsconfig.json`

These are standard configuration files for a TypeScript project. The
`package.json` file defines dependencies and a `build` script, and
`tsconfig.json` configures the TypeScript compiler.

## Step 3: Build and link your extension

Before you can use the extension, you need to compile the TypeScript code and
link the extension to your Gemini CLI installation for local development.

1.  **Install dependencies:**

    ```bash
    cd my-first-extension
    npm install
    ```

2.  **Build the server:**

    ```bash
    npm run build
    ```

    This will compile `example.ts` into `dist/example.js`, which is the file
    referenced in your `gemini-extension.json`.

3.  **Link the extension:**

    The `link` command creates a symbolic link from the Gemini CLI extensions
    directory to your development directory. This means any changes you make
    will be reflected immediately without needing to reinstall.

    ```bash
    gemini extensions link .
    ```

Now, restart your Gemini CLI session. The new `fetch_posts` tool will be
available. You can test it by asking: "fetch posts".

## Step 4: Add a custom command

Custom commands provide a way to create shortcuts for complex prompts. Let's add
a command that searches for a pattern in your code.

1.  Create a `commands` directory and a subdirectory for your command group:

    ```bash
    mkdir -p commands/fs
    ```

2.  Create a file named `commands/fs/grep-code.toml`:

    ```toml
    prompt = """
    Please summarize the findings for the pattern `{{args}}`.

    Search Results:
    !{grep -r {{args}} .}
    """
    ```

    This command, `/fs:grep-code`, will take an argument, run the `grep` shell
    command with it, and pipe the results into a prompt for summarization.

After saving the file, restart the Gemini CLI. You can now run
`/fs:grep-code "some pattern"` to use your new command.

## Step 5: Add a custom `GEMINI.md`

You can provide persistent context to the model by adding a `GEMINI.md` file to
your extension. This is useful for giving the model instructions on how to
behave or information about your extension's tools. Note that you may not always
need this for extensions built to expose commands and prompts.

1.  Create a file named `GEMINI.md` in the root of your extension directory:

    ```markdown
    # My First Extension Instructions

    You are an expert developer assistant. When the user asks you to fetch
    posts, use the `fetch_posts` tool. Be concise in your responses.
    ```

2.  Update your `gemini-extension.json` to tell the CLI to load this file:

    ```json
    {
      "name": "my-first-extension",
      "version": "1.0.0",
      "contextFileName": "GEMINI.md",
      "mcpServers": {
        "nodeServer": {
          "command": "node",
          "args": ["${extensionPath}${/}dist${/}example.js"],
          "cwd": "${extensionPath}"
        }
      }
    }
    ```

Restart the CLI again. The model will now have the context from your `GEMINI.md`
file in every session where the extension is active.

## Step 6: Releasing your extension

Once you are happy with your extension, you can share it with others. The two
primary ways of releasing extensions are via a Git repository or through GitHub
Releases. Using a public Git repository is the simplest method.

For detailed instructions on both methods, please refer to the
[Extension Releasing Guide](./extension-releasing.md).

## Conclusion

You've successfully created a Gemini CLI extension! You learned how to:

- Bootstrap a new extension from a template.
- Add custom tools with an MCP server.
- Create convenient custom commands.
- Provide persistent context to the model.
- Link your extension for local development.

From here, you can explore more advanced features and build powerful new
capabilities into the Gemini CLI.

# Extension releasing

There are two primary ways of releasing extensions to users:

- [Git repository](#releasing-through-a-git-repository)
- [Github Releases](#releasing-through-github-releases)

Git repository releases tend to be the simplest and most flexible approach,
while GitHub releases can be more efficient on initial install as they are
shipped as single archives instead of requiring a git clone which downloads each
file individually. Github releases may also contain platform specific archives
if you need to ship platform specific binary files.

## Releasing through a git repository

This is the most flexible and simple option. All you need to do is create a
publicly accessible git repo (such as a public github repository) and then users
can install your extension using `gemini extensions install <your-repo-uri>`.
They can optionally depend on a specific ref (branch/tag/commit) using the
`--ref=<some-ref>` argument, this defaults to the default branch.

Whenever commits are pushed to the ref that a user depends on, they will be
prompted to update the extension. Note that this also allows for easy rollbacks,
the HEAD commit is always treated as the latest version regardless of the actual
version in the `gemini-extension.json` file.

### Managing release channels using a git repository

Users can depend on any ref from your git repo, such as a branch or tag, which
allows you to manage multiple release channels.

For instance, you can maintain a `stable` branch, which users can install this
way `gemini extensions install <your-repo-uri> --ref=stable`. Or, you could make
this the default by treating your default branch as your stable release branch,
and doing development in a different branch (for instance called `dev`). You can
maintain as many branches or tags as you like, providing maximum flexibility for
you and your users.

Note that these `ref` arguments can be tags, branches, or even specific commits,
which allows users to depend on a specific version of your extension. It is up
to you how you want to manage your tags and branches.

### Example releasing flow using a git repo

While there are many options for how you want to manage releases using a git
flow, we recommend treating your default branch as your "stable" release branch.
This means that the default behavior for
`gemini extensions install <your-repo-uri>` is to be on the stable release
branch.

Lets say you want to maintain three standard release channels, `stable`,
`preview`, and `dev`. You would do all your standard development in the `dev`
branch. When you are ready to do a preview release, you merge that branch into
your `preview` branch. When you are ready to promote your preview branch to
stable, you merge `preview` into your stable branch (which might be your default
branch or a different branch).

You can also cherry pick changes from one branch into another using
`git cherry-pick`, but do note that this will result in your branches having a
slightly divergent history from each other, unless you force push changes to
your branches on each release to restore the history to a clean slate (which may
not be possible for the default branch depending on your repository settings).
If you plan on doing cherry picks, you may want to avoid having your default
branch be the stable branch to avoid force-pushing to the default branch which
should generally be avoided.

## Releasing through GitHub releases

Gemini CLI extensions can be distributed through
[GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases).
This provides a faster and more reliable initial installation experience for
users, as it avoids the need to clone the repository.

Each release includes at least one archive file, which contains the full
contents of the repo at the tag that it was linked to. Releases may also include
[pre-built archives](#custom-pre-built-archives) if your extension requires some
build step or has platform specific binaries attached to it.

When checking for updates, gemini will just look for the "latest" release on
github (you must mark it as such when creating the release), unless the user
installed a specific release by passing `--ref=<some-release-tag>`.

You may also install extensions with the `--pre-release` flag in order to get
the latest release regardless of whether it has been marked as "latest". This
allows you to test that your release works before actually pushing it to all
users.

### Custom pre-built archives

Custom archives must be attached directly to the github release as assets and
must be fully self-contained. This means they should include the entire
extension, see [archive structure](#archive-structure).

If your extension is platform-independent, you can provide a single generic
asset. In this case, there should be only one asset attached to the release.

Custom archives may also be used if you want to develop your extension within a
larger repository, you can build an archive which has a different layout from
the repo itself (for instance it might just be an archive of a subdirectory
containing the extension).

#### Platform specific archives

To ensure Gemini CLI can automatically find the correct release asset for each
platform, you must follow this naming convention. The CLI will search for assets
in the following order:

1.  **Platform and architecture-Specific:**
    `{platform}.{arch}.{name}.{extension}`
2.  **Platform-specific:** `{platform}.{name}.{extension}`
3.  **Generic:** If only one asset is provided, it will be used as a generic
    fallback.

- `{name}`: The name of your extension.
- `{platform}`: The operating system. Supported values are:
  - `darwin` (macOS)
  - `linux`
  - `win32` (Windows)
- `{arch}`: The architecture. Supported values are:
  - `x64`
  - `arm64`
- `{extension}`: The file extension of the archive (e.g., `.tar.gz` or `.zip`).

**Examples:**

- `darwin.arm64.my-tool.tar.gz` (specific to Apple Silicon Macs)
- `darwin.my-tool.tar.gz` (for all Macs)
- `linux.x64.my-tool.tar.gz`
- `win32.my-tool.zip`

#### Archive structure

Archives must be fully contained extensions and have all the standard
requirements - specifically the `gemini-extension.json` file must be at the root
of the archive.

The rest of the layout should look exactly the same as a typical extension, see
[extensions.md](./index.md).

#### Example GitHub Actions workflow

Here is an example of a GitHub Actions workflow that builds and releases a
Gemini CLI extension for multiple platforms:

```yaml
name: Release Extension

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Set up Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Build extension
        run: npm run build

      - name: Create release assets
        run: |
          npm run package -- --platform=darwin --arch=arm64
          npm run package -- --platform=linux --arch=x64
          npm run package -- --platform=win32 --arch=x64

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v1
        with:
          files: |
            release/darwin.arm64.my-tool.tar.gz
            release/linux.arm64.my-tool.tar.gz
            release/win32.arm64.my-tool.zip
```
