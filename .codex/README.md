# Agent profiles

Four project-scoped TOML definitions preserve the user's requested roles and inherit the session's available model. File ownership is expressed in instructions and checked by the technical lead; it is not a filesystem sandbox.

The current session uses freshly spawned collaborators with matching names and explicit scoped prompts. These files configure future sessions; writing them does not retroactively change running agents.

Format reference: [official subagent documentation](https://learn.chatgpt.com/docs/agent-configuration/subagents).
