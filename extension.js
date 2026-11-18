// Workspace Settings Autopilot
// Applies a user-defined settings template to <folder>/.vscode/settings.json automatically.

'use strict';

const vscode = require('vscode');
const os = require('os');
const path = require('path');

const SECTION = 'settingsAutopilot';
const WELCOME_KEY = 'settingsAutopilot.welcomeShown';
const t = vscode.l10n.t;

let output;
let extContext;
let fileWatcher;
let queue = Promise.resolve();

// ---------------------------------------------------------------- helpers

function cfg() {
  return vscode.workspace.getConfiguration(SECTION);
}

function log(msg) {
  output.appendLine(`[${new Date().toLocaleTimeString()}] ${msg}`);
}

function resolveTemplateFile() {
  let p = (cfg().get('templateFile') || '').trim();
  if (!p) return undefined;
  p = p.replace(/\$\{env:([^}]+)\}/g, (_, name) => process.env[name] || '');
  if (p === '~' || p.startsWith('~/') || p.startsWith('~\\')) {
    p = path.join(os.homedir(), p.slice(1));
  }
  return vscode.Uri.file(path.resolve(p));
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** Parses JSON with comments and trailing commas (like VS Code's settings.json). */
function parseJsonc(text) {
  const stripped = scan(text, (c, n, i, s, out) => {
    if (c === '/' && n === '/') { while (i < s.length && s[i] !== '\n') i++; out.push('\n'); return i; }
    if (c === '/' && n === '*') { i += 2; while (i < s.length && !(s[i] === '*' && s[i + 1] === '/')) i++; return i + 1; }
    return -1;
  });
  const clean = scan(stripped, (c, n, i, s) => {
    if (c !== ',') return -1;
    let j = i + 1;
    while (j < s.length && /\s/.test(s[j])) j++;
    return (s[j] === '}' || s[j] === ']') ? i : -1; // drop trailing comma
  });
  const trimmed = clean.trim();
  const value = trimmed ? JSON.parse(trimmed) : {};
  if (!isPlainObject(value)) throw new Error(t('The file does not contain a JSON object.'));
  return value;
}

/** Walks text, copying string literals untouched; `handler` may consume non-string chars. */
function scan(s, handler) {
  const out = [];
  let inString = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inString) {
      out.push(c);
      if (c === '\\') { out.push(s[i + 1] ?? ''); i++; }
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') { inString = true; out.push(c); continue; }
    const next = handler(c, s[i + 1], i, s, out);
    if (next >= 0) { i = next; continue; }
    out.push(c);
  }
  return out.join('');
}

function deepMerge(base, override) {
  const result = { ...base };
  for (const [key, value] of Object.entries(override)) {
    result[key] = isPlainObject(value) && isPlainObject(result[key])
      ? deepMerge(result[key], value)
      : value;
  }
  return result;
}

function sameJson(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function readText(uri) {
  return new TextDecoder('utf-8').decode(await vscode.workspace.fs.readFile(uri));
}

async function writeText(uri, text) {
  await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(text));
}

async function exists(uri) {
  try { await vscode.workspace.fs.stat(uri); return true; } catch { return false; }
}

function samePath(a, b) {
  const norm = p => process.platform === 'win32' || process.platform === 'darwin' ? p.toLowerCase() : p;
  return a.scheme === b.scheme && norm(a.fsPath) === norm(b.fsPath);
}

function settingsUri(folder) {
  return vscode.Uri.joinPath(folder.uri, '.vscode', 'settings.json');
}

// ---------------------------------------------------------------- template

/**
 * Returns the active template or undefined if none is configured.
 * { source: 'file' | 'setting', uri?, text, obj }
 */
async function loadTemplate() {
  const fileUri = resolveTemplateFile();
  if (fileUri) {
    const text = await readText(fileUri);
    return { source: 'file', uri: fileUri, text, obj: parseJsonc(text) };
  }
  const obj = cfg().get('template') || {};
  if (!isPlainObject(obj) || Object.keys(obj).length === 0) return undefined;
  return { source: 'setting', text: JSON.stringify(obj, null, 4) + '\n', obj };
}

// ---------------------------------------------------------------- apply

function isExcluded(folder) {
  const excludes = cfg().get('excludeFolders') || [];
  return excludes.some(e => e === folder.name ||
    (path.isAbsolute(e) && samePath(vscode.Uri.file(path.resolve(e)), folder.uri)));
}

async function applyToFolder(folder, tpl) {
  if (isExcluded(folder)) { log(`Skipped (excluded): ${folder.name}`); return false; }

  const target = settingsUri(folder);
  if (tpl.uri && samePath(target, tpl.uri)) return false; // never write the template into itself

  const mode = cfg().get('mode');
  const targetExists = await exists(target);
  let newText;

  if (!targetExists) {
    newText = tpl.text;
  } else if (mode === 'onlyIfMissing') {
    return false;
  } else {
    const currentText = await readText(target);
    let current;
    try {
      current = parseJsonc(currentText);
    } catch (e) {
      log(`Cannot parse ${target.fsPath}: ${e.message}`);
      vscode.window.showWarningMessage(
        t('{0}/.vscode/settings.json is not valid JSON and was left unchanged.', folder.name));
      return false;
    }
    if (mode === 'overwrite') {
      if (currentText === tpl.text || (tpl.source === 'setting' && sameJson(current, tpl.obj))) return false;
      newText = tpl.text;
    } else { // merge
      const merged = deepMerge(current, tpl.obj);
      if (sameJson(merged, current)) return false;
      newText = JSON.stringify(merged, null, 4) + '\n';
    }
  }

  await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(folder.uri, '.vscode'));
  await writeText(target, newText);
  log(`Applied (${mode}) → ${target.fsPath}`);
  return true;
}

function applyToAll(folders, opts) {
  // serialize runs so overlapping triggers never write the same file concurrently
  queue = queue.then(() => doApply(folders, opts)).catch(e => log(`Error: ${e.message}`));
  return queue;
}

async function doApply(folders, { manual = false } = {}) {
  folders = folders || vscode.workspace.workspaceFolders || [];
  if (folders.length === 0) {
    if (manual) vscode.window.showInformationMessage(t('No folder is open.'));
    return;
  }

  let tpl;
  try {
    tpl = await loadTemplate();
  } catch (e) {
    const where = resolveTemplateFile()?.fsPath ?? '';
    log(`Cannot read template ${where}: ${e.message}`);
    vscode.window.showErrorMessage(t('Settings Autopilot: Cannot read template {0}: {1}', where, e.message));
    return;
  }

  if (!tpl) {
    if (manual || !extContext.globalState.get(WELCOME_KEY)) await showSetupPrompt();
    return;
  }

  const changed = [];
  for (const folder of folders) {
    try {
      if (await applyToFolder(folder, tpl)) changed.push(folder.name);
    } catch (e) {
      log(`Error in ${folder.name}: ${e.message}`);
      vscode.window.showErrorMessage(t('Settings Autopilot: Error in {0}: {1}', folder.name, e.message));
    }
  }

  if (changed.length && cfg().get('showNotifications')) {
    vscode.window.setStatusBarMessage('$(check) ' + t('Settings applied: {0}', changed.join(', ')), 5000);
  } else if (manual && !changed.length) {
    vscode.window.showInformationMessage(t('Everything is already up to date.'));
  }
}

// ---------------------------------------------------------------- commands

async function showSetupPrompt() {
  await extContext.globalState.update(WELCOME_KEY, true);
  const edit = t('Edit template');
  const file = t('Choose file…');
  const fromProject = t('Use current project');
  const items = [edit, file];
  for (const folder of vscode.workspace.workspaceFolders || []) {
    if (await exists(settingsUri(folder))) { items.push(fromProject); break; }
  }

  const pick = await vscode.window.showInformationMessage(
    t('Settings Autopilot: No template configured yet. Define the settings that should be written to every .vscode/settings.json.'),
    ...items);
  if (pick === edit) await editTemplate();
  else if (pick === file) await chooseTemplateFile();
  else if (pick === fromProject) await saveCurrentAsTemplate();
}

async function editTemplate() {
  const fileUri = resolveTemplateFile();
  if (fileUri) {
    if (!(await exists(fileUri))) await writeText(fileUri, '{\n    \n}\n');
    await vscode.window.showTextDocument(fileUri);
    return;
  }
  try {
    await vscode.commands.executeCommand('workbench.action.openSettingsJson',
      { revealSetting: { key: `${SECTION}.template`, edit: true } });
  } catch {
    await vscode.commands.executeCommand('workbench.action.openSettingsJson');
  }
}

async function chooseTemplateFile() {
  const uris = await vscode.window.showOpenDialog({
    canSelectMany: false,
    openLabel: t('Use as template'),
    filters: { JSON: ['json', 'jsonc'] }
  });
  if (!uris?.[0]) return;
  await cfg().update('templateFile', uris[0].fsPath, vscode.ConfigurationTarget.Global);
  vscode.window.showInformationMessage(t('Template file set: {0}', uris[0].fsPath));
}

async function saveCurrentAsTemplate() {
  const folders = vscode.workspace.workspaceFolders || [];
  if (folders.length === 0) {
    vscode.window.showInformationMessage(t('No folder is open.'));
    return;
  }
  const folder = folders.length === 1
    ? folders[0]
    : await vscode.window.showWorkspaceFolderPick({ placeHolder: t('Which folder?') });
  if (!folder) return;

  const source = settingsUri(folder);
  if (!(await exists(source))) {
    vscode.window.showWarningMessage(t('{0} has no .vscode/settings.json.', folder.name));
    return;
  }

  let text, obj;
  try {
    text = await readText(source);
    obj = parseJsonc(text);
  } catch (e) {
    vscode.window.showErrorMessage(t('Settings Autopilot: Cannot read {0}: {1}', source.fsPath, e.message));
    return;
  }

  const existing = await loadTemplate().catch(() => undefined);
  if (existing) {
    const replace = t('Replace');
    const answer = await vscode.window.showWarningMessage(
      t('Replace your current template with the settings of {0}?', folder.name), { modal: true }, replace);
    if (answer !== replace) return;
  }

  const fileUri = resolveTemplateFile();
  if (fileUri) {
    if (samePath(fileUri, source)) return;
    await writeText(fileUri, text);
  } else {
    await cfg().update('template', obj, vscode.ConfigurationTarget.Global);
  }
  vscode.window.showInformationMessage(t('Template saved from {0}.', folder.name));
}

// ---------------------------------------------------------------- lifecycle

function setupFileWatcher() {
  fileWatcher?.dispose();
  fileWatcher = undefined;
  const uri = resolveTemplateFile();
  if (!uri) return;

  fileWatcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(vscode.Uri.file(path.dirname(uri.fsPath)), path.basename(uri.fsPath)));
  let timer;
  const onChange = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (cfg().get('enabled')) { log('Template file changed'); applyToAll(); }
    }, 300);
  };
  fileWatcher.onDidChange(onChange);
  fileWatcher.onDidCreate(onChange);
}

function activate(context) {
  extContext = context;
  output = vscode.window.createOutputChannel('Workspace Settings Autopilot');

  context.subscriptions.push(
    output,
    vscode.commands.registerCommand(`${SECTION}.applyNow`, () => applyToAll(undefined, { manual: true })),
    vscode.commands.registerCommand(`${SECTION}.editTemplate`, editTemplate),
    vscode.commands.registerCommand(`${SECTION}.chooseTemplateFile`, chooseTemplateFile),
    vscode.commands.registerCommand(`${SECTION}.saveCurrentAsTemplate`, saveCurrentAsTemplate),
    vscode.workspace.onDidChangeWorkspaceFolders(e => {
      if (cfg().get('enabled') && e.added.length) applyToAll(e.added);
    }),
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration(`${SECTION}.templateFile`)) setupFileWatcher();
      const relevant = ['template', 'templateFile', 'mode', 'enabled']
        .some(k => e.affectsConfiguration(`${SECTION}.${k}`));
      if (relevant && cfg().get('enabled')) applyToAll();
    }),
    { dispose: () => fileWatcher?.dispose() }
  );

  setupFileWatcher();
  if (cfg().get('enabled')) applyToAll();
}

function deactivate() {}

module.exports = { activate, deactivate, _test: { parseJsonc, deepMerge } };
