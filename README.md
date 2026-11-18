# Workspace Settings Autopilot

Define your favourite workspace settings **once** – they are written to `.vscode/settings.json` of every folder you open in VS Code. Automatically.

Great for settings that *must* live in the workspace (e.g. AL/Business Central project settings, `workbench.colorCustomizations` per project, formatter options for a team repo) and that you are tired of copying around.

## Features

- ✅ Applies your template automatically when a folder is opened (also in multi-root workspaces)
- 🔀 Three modes: **merge** (default), **overwrite**, **only if missing**
- 🧠 Merge is smart: nested objects like `workbench.colorCustomizations` or `[python]` are merged key by key, all other project settings are kept
- 🤫 No Git noise – the file is only written when something actually changes
- 📄 Template either directly in your user settings or as a separate `settings.json` file (with live updates when the file changes)
- 🌍 English & German UI

## Getting started

1. Install the extension.
2. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and run one of:
   - **Settings Autopilot: Edit template** – define the template in your user `settings.json`
   - **Settings Autopilot: Save current project's .vscode/settings.json as template** – take an existing project as starting point
   - **Settings Autopilot: Use a settings.json file as template…** – point to a file (e.g. in OneDrive/Dropbox/Git)
3. Done. Every folder you open now gets your settings.

### Example (user `settings.json`)

```jsonc
"settingsAutopilot.template": {
    "editor.tabSize": 4,
    "files.trimTrailingWhitespace": true,
    "workbench.colorCustomizations": {
        "titleBar.activeBackground": "#263125"
    }
}
```

## Extension Settings

| Setting | Default | Description |
|---|---|---|
| `settingsAutopilot.template` | `{}` | The settings written to every `.vscode/settings.json` |
| `settingsAutopilot.templateFile` | `""` | Optional path to a `settings.json` used instead of `template` (`~` and `${env:VAR}` supported) |
| `settingsAutopilot.enabled` | `true` | Apply automatically when a folder is opened |
| `settingsAutopilot.mode` | `merge` | `merge` · `overwrite` · `onlyIfMissing` |
| `settingsAutopilot.excludeFolders` | `[]` | Folder names or absolute paths to skip |
| `settingsAutopilot.showNotifications` | `true` | Status bar message after applying |

## Commands

| Command | |
|---|---|
| Settings Autopilot: Apply template to .vscode/settings.json now | Run manually |
| Settings Autopilot: Edit template | Opens the template |
| Settings Autopilot: Use a settings.json file as template… | Pick a template file |
| Settings Autopilot: Save current project's .vscode/settings.json as template | Copy a project's settings into your template |

Logs: *View → Output → Workspace Settings Autopilot*.

## Notes

- In **merge** mode the project file is rewritten as plain JSON, so comments inside the *project's* `settings.json` are not preserved. **overwrite** with a template file keeps the template's comments 1:1.
- Nothing happens when no folder is open.

---

## 🇩🇪 Kurz auf Deutsch

Leg deine Workspace-Einstellungen einmal als Vorlage fest. Die Extension schreibt sie automatisch in `.vscode/settings.json` jedes geöffneten Ordners. Einrichten: `Strg+Shift+P` → **Settings Autopilot: Vorlage bearbeiten**. Die Oberfläche ist auf Deutsch, wenn VS Code auf Deutsch eingestellt ist.


## Development

```bash
git clone https://github.com/Bvrtck/workspace-settings-autopilot.git
cd workspace-settings-autopilot
code .
```

Press **F5** to start an Extension Development Host with the extension loaded. No build step – it's plain JavaScript.

Package / publish:

```bash
npx @vscode/vsce package   # creates workspace-settings-autopilot-x.y.z.vsix
npx @vscode/vsce publish   # publishes to the VS Code Marketplace
```

Contributions and issues are welcome!

## License

[MIT](LICENSE) © bartoszctm
