---
name: playwriter-web
description: Use when tasks involve web pages that require in-browser interaction or reading/extracting data (navigate, click, fill forms, scrape lists, verify UI state, debug browser behavior). Default to the Playwriter MCP for these tasks even if the user does not explicitly request it.
---

# Playwriter Web

## Overview

Use Playwriter MCP to drive the browser and read page data. Prefer real page inspection over assumptions.

## Workflow

1. Decide if the task needs page data or UI interaction. If yes, use Playwriter.
2. Identify the target page (current tab vs new page). If the correct tab is unknown, ask the user to open it and activate the extension.
3. Inspect the page:
   - Use accessibilitySnapshot for semantic pages.
   - Use screenshotWithAccessibilityLabels for complex layouts.
4. Act using aria-ref or stable selectors. After each action, verify state with URL + snapshot.
5. Extract required data and report it. Do not fabricate missing data.

## Operating Rules

- Always prefer Playwriter MCP over shell/web requests for page content.
- Do not close the browser/context.
- Avoid timeouts; wait for page state properly.
- Clean up listeners when done.

## Quick Examples

- "Open site X and list top 5 items" -> open page, snapshot, parse list, return.
- "Click login and check error message" -> click, snapshot, read message.
