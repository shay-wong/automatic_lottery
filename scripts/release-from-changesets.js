#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const args = process.argv.slice(2);
const outIndex = args.indexOf('--out');
const outPath = outIndex !== -1 && args[outIndex + 1]
  ? args[outIndex + 1]
  : 'release-info.json';

const repoRoot = path.resolve(__dirname, '..');
const changesetDir = path.join(repoRoot, 'changesets');

const SCRIPTS = {
  windhub: {
    script: 'auto-windhub.user.js',
    name: 'WindHub 自动化助手',
    prefix: 'windhub',
  },
  'card-draw': {
    script: 'auto-card-draw.user.js',
    name: '自动抽卡',
    prefix: 'card-draw',
  },
  'slot-machine': {
    script: 'auto-slot-machine.user.js',
    name: '自动老虎机',
    prefix: 'slot-machine',
  },
};

const readFile = (filePath) => fs.readFileSync(filePath, 'utf8');

const parseVersion = (version) => {
  const match = version.trim().match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) throw new Error(`Invalid version: ${version}`);
  return match.slice(1).map(Number);
};

const formatVersion = ([major, minor, patch]) => `${major}.${minor}.${patch}`;

const bumpVersion = (version, bump) => {
  const [major, minor, patch] = parseVersion(version);
  if (bump === 'major') return formatVersion([major + 1, 0, 0]);
  if (bump === 'minor') return formatVersion([major, minor + 1, 0]);
  if (bump === 'patch') return formatVersion([major, minor, patch + 1]);
  throw new Error(`Unknown bump type: ${bump}`);
};

const compareVersions = (a, b) => {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  for (let i = 0; i < pa.length; i += 1) {
    if (pa[i] > pb[i]) return 1;
    if (pa[i] < pb[i]) return -1;
  }
  return 0;
};

const readScriptVersion = (scriptPath) => {
  const content = readFile(scriptPath);
  const match = content.match(/^\/\/\s*@version\s+([0-9.]+)\s*$/m);
  if (!match) throw new Error(`@version not found in ${scriptPath}`);
  return match[1];
};

const updateScriptVersion = (scriptPath, version) => {
  const content = readFile(scriptPath);
  const updated = content.replace(
    /^\/\/\s*@version\s+.*$/m,
    `// @version      ${version}`
  );
  fs.writeFileSync(scriptPath, updated);
};

const updateWindHubRequires = (version) => {
  const scriptPath = path.join(repoRoot, 'auto-windhub.user.js');
  const content = readFile(scriptPath);
  const updated = content.replace(/\?v=[0-9.]+/g, `?v=${version}`);
  fs.writeFileSync(scriptPath, updated);
};

const parseChangeset = (filePath) => {
  const lines = readFile(filePath).split(/\r?\n/);
  const entries = [];
  let current = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const scriptMatch = line.match(/^\s*-\s*script:\s*(\S+)\s*$/);
    if (scriptMatch) {
      if (current) entries.push(current);
      current = { script: scriptMatch[1] };
      continue;
    }

    if (!current) continue;

    const bumpMatch = line.match(/^\s*bump:\s*(\S+)\s*$/);
    if (bumpMatch) {
      current.bump = bumpMatch[1];
      continue;
    }

    const versionMatch = line.match(/^\s*version:\s*([0-9.]+)\s*$/);
    if (versionMatch) {
      current.version = versionMatch[1];
    }
  }

  if (current) entries.push(current);
  return entries;
};

const changesetFiles = fs.existsSync(changesetDir)
  ? fs.readdirSync(changesetDir)
    .filter(file => file.endsWith('.yml') || file.endsWith('.yaml'))
    .map(file => path.join(changesetDir, file))
  : [];

if (changesetFiles.length === 0) {
  process.exit(0);
}

const releasePlan = [];
const newVersions = {};

changesetFiles.sort().forEach((filePath) => {
  const entries = parseChangeset(filePath);
  if (entries.length === 0) {
    throw new Error(`No entries found in ${filePath}`);
  }
  for (const entry of entries) {
    const scriptKey = entry.script;
    const scriptInfo = SCRIPTS[scriptKey];
    if (!scriptInfo) {
      throw new Error(`Unknown script key: ${scriptKey}`);
    }
    if (!entry.bump && !entry.version) {
      throw new Error(`Missing bump/version in ${filePath} for ${scriptKey}`);
    }

    const scriptPath = path.join(repoRoot, scriptInfo.script);
    const currentVersion = newVersions[scriptKey] || readScriptVersion(scriptPath);
    const nextVersion = entry.version || bumpVersion(currentVersion, entry.bump);

    if (compareVersions(nextVersion, currentVersion) <= 0) {
      throw new Error(`Version ${nextVersion} is not newer than ${currentVersion} for ${scriptKey}`);
    }

    newVersions[scriptKey] = nextVersion;
    releasePlan.push({
      scriptKey,
      version: nextVersion,
      sourceFile: filePath,
    });
  }
});

Object.entries(newVersions).forEach(([scriptKey, version]) => {
  const scriptInfo = SCRIPTS[scriptKey];
  updateScriptVersion(path.join(repoRoot, scriptInfo.script), version);
  if (scriptKey === 'windhub') {
    updateWindHubRequires(version);
  }
});

if (newVersions.windhub) {
  execSync('node scripts/gen-windhub-userscripts.js', {
    cwd: repoRoot,
    stdio: 'inherit',
  });
}

const notesDir = path.join(repoRoot, 'release-notes');
fs.mkdirSync(notesDir, { recursive: true });

const changelogFor = (prefix, scriptPath) => {
  const tagOutput = execSync(
    `git tag -l "${prefix}-v*" --sort=-v:refname`,
    { cwd: repoRoot }
  ).toString().trim();
  const prevTag = tagOutput.split('\n').filter(Boolean)[0];
  if (!prevTag) return 'Initial release';

  const log = execSync(
    `git log --pretty=format:"- %s" ${prevTag}..HEAD -- ${scriptPath} src/`,
    { cwd: repoRoot }
  ).toString().trim();

  return log || '- No changes';
};

const releases = Object.entries(newVersions).map(([scriptKey, version]) => {
  const scriptInfo = SCRIPTS[scriptKey];
  const tag = `${scriptInfo.prefix}-v${version}`;
  const changelog = changelogFor(scriptInfo.prefix, scriptInfo.script);
  const body = [
    `## ${scriptInfo.name} v${version}`,
    '',
    '### Changes',
    changelog,
    '',
    '### Installation',
    'Click below to install via Tampermonkey:',
    `- [${scriptInfo.script}](https://raw.githubusercontent.com/${process.env.GITHUB_REPOSITORY || 'shay-wong/automatic_lottery'}/main/${scriptInfo.script})`,
  ].join('\n');
  const notesFile = path.join(notesDir, `${tag}.md`);
  fs.writeFileSync(notesFile, `${body}\n`);
  return {
    scriptKey,
    script: scriptInfo.script,
    name: scriptInfo.name,
    version,
    tag,
    notesFile,
  };
});

const summary = releases
  .map(entry => `${entry.scriptKey} v${entry.version}`)
  .join(', ');

const commitMessage = `chore: release ${summary}`;

const uniqueSources = Array.from(new Set(releasePlan.map(item => item.sourceFile)));
uniqueSources.forEach((filePath) => {
  fs.unlinkSync(filePath);
});

const releaseInfo = {
  releases,
  commitMessage,
};

fs.writeFileSync(path.join(repoRoot, outPath), JSON.stringify(releaseInfo));
