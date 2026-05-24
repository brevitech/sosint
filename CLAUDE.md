# CLAUDE.md

## GitHub Access Policy

**Always use the `GH_TOKEN` environment variable for all GitHub read and write operations.**

- Use `gh` CLI with `GH_TOKEN` (or raw `git` over HTTPS with the token in the URL / credential helper) for cloning, fetching, pushing, branch operations, PR creation, issue management, comments, reviews, releases, and any other GitHub interaction.
- **Never** use the GitHub connector.
- **Never** use any `mcp__github__*` MCP tools.
- If a GitHub MCP tool appears available, ignore it and fall back to `gh` / `git` with `GH_TOKEN`.

### Examples

```bash
# Read
gh pr list
gh pr view <num>
gh issue view <num>
gh api repos/brevitech/sosint/...

# Write
gh pr create --title "..." --body "..."
gh pr comment <num> --body "..."
gh issue comment <num> --body "..."
git push -u origin <branch>
```

If `GH_TOKEN` is unset or invalid, stop and ask the user to fix it rather than falling back to the connector or MCP.
