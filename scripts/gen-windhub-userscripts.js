#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const repoRoot = path.resolve(__dirname, '..');
const basePath = path.join(repoRoot, 'auto-windhub.user.js');
const localPath = path.join(repoRoot, 'auto-windhub.local.user.js');

const content = fs.readFileSync(basePath, 'utf8');
const lines = content.split(/\r?\n/);

let inMeta = false;
let baseVersion = null;
const localLines = [];

for (const line of lines) {
  if (line.trim() === '// ==UserScript==') {
    inMeta = true;
    localLines.push(line);
    continue;
  }
  if (line.trim() === '// ==/UserScript==') {
    inMeta = false;
    localLines.push(line);
    localLines.push('// Generated from auto-windhub.user.js by scripts/gen-windhub-userscripts.js');
    continue;
  }

  if (!inMeta) {
    localLines.push(line);
    continue;
  }

  const match = line.match(/^\/\/\s*@(\S+)\s+(.*)$/);
  if (!match) {
    localLines.push(line);
    continue;
  }

  const key = match[1];
  const value = match[2];

  if (key === 'name') {
    localLines.push('// @name         WindHub 自动化助手 (local)');
    continue;
  }
  if (key === 'version') {
    baseVersion = value.trim();
    localLines.push(`// @version      ${baseVersion}-local`);
    continue;
  }
  if (key === 'description') {
    localLines.push('// @description  WindHub 福利站自动化脚本（本地调试版）');
    continue;
  }
  if (key === 'updateURL' || key === 'downloadURL' || key === 'supportURL') {
    continue;
  }
  if (key === 'require') {
    const matchSrc = value.match(/\/src\/([^?\s]+)/);
    if (matchSrc) {
      const relPath = path.join('src', matchSrc[1]);
      const fileUrl = pathToFileURL(path.join(repoRoot, relPath)).toString();
      localLines.push(`// @require      ${fileUrl}`);
      continue;
    }
  }

  localLines.push(line);
}

if (!baseVersion) {
  throw new Error('Missing @version in auto-windhub.user.js');
}

fs.writeFileSync(localPath, localLines.join('\n'), 'utf8');
console.log(`Generated ${path.relative(repoRoot, localPath)}`);
