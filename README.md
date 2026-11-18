# Workspace Settings Autopilot

Write your VS Code settings once – get them in every project automatically.

The extension writes your template to `.vscode/settings.json` whenever you open a folder. Perfect for AL/Business Central settings, color customizations, or any settings you'd otherwise copy from project to project.

## Setup

1. Install the extension
2. `Ctrl+Shift+P` → **Settings Autopilot: Edit template**
3. Done – every folder you open gets your settings

**Or** use an existing project as your template:  
`Ctrl+Shift+P` → **Settings Autopilot: Save current project's .vscode/settings.json as template**

**Or** point to a file (e.g. in OneDrive):  
`Ctrl+Shift+P` → **Settings Autopilot: Use a settings.json file as template…**

## Example

```jsonc
"settingsAutopilot.template": {
    "editor.tabSize": 4,
    "workbench.colorCustomizations": {
        "titleBar.activeBackground": "#263125"
    }
}
```

## Settings

| Setting | Default | Description |
|---|---|---|
| `settingsAutopilot.template` | `{}` | Settings written to every `.vscode/settings.json` |
| `settingsAutopilot.templateFile` | `""` | Path to a file used instead of `template` |
| `settingsAutopilot.enabled` | `true` | Apply automatically on folder open |
| `settingsAutopilot.mode` | `merge` | `merge` · `overwrite` · `onlyIfMissing` |
| `settingsAutopilot.excludeFolders` | `[]` | Folder names or paths to skip |
| `settingsAutopilot.showNotifications` | `true` | Show status message after applying |

**merge** (default): keeps existing project settings, merges nested objects like `workbench.colorCustomizations` key by key.  
**overwrite**: replaces everything.  
**onlyIfMissing**: only writes if `.vscode/settings.json` doesn't exist yet.

## 🇩🇪 Deutsch

Einstellungen einmal als Vorlage festlegen, die Extension schreibt sie automatisch in jeden Projektordner. `Strg+Shift+P` → **Settings Autopilot: Vorlage bearbeiten**. Die Oberfläche erscheint auf Deutsch, wenn VS Code auf Deutsch eingestellt ist.

## Development

```bash
git clone https://github.com/bartoszctm/workspace-settings-autopilot.git
cd workspace-settings-autopilot
code .
# F5 → Extension Development Host
```

No build step. Package: `npx @vscode/vsce package`

## License

[MIT](LICENSE) © bartoszctm
