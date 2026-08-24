---
name: view-localhost
description: Use whenever making or reviewing frontend/UI changes to a local dev server, or when the user asks to "check", "see", "view", or "verify" how a page looks/renders. Covers taking screenshots of localhost, reading rendered DOM/content, checking console errors, and interacting with the page (click, scroll, fill forms) via Playwright MCP.
---

# Viewing localhost

This project has a live dev server. Use the Playwright MCP tools to actually
look at pages instead of assuming code changes worked.

## Workflow
1. Identify the dev server port (check package.json scripts, .env, or ask 
   the user if unclear — common defaults: 3000, 5173, 8080).
2. Navigate to the relevant URL with the browser tool.
3. Take a screenshot before AND after making a change, when the change is 
   visual — this is your verification step, not optional.
4. Check the browser console/network tab for errors after navigation.
5. If something looks wrong, read the DOM/text content of the page to 
   debug before guessing.

## Rules
- Never claim a UI change "works" without having screenshotted it.
- If the dev server isn't running, tell the user and offer to start it 
  (check package.json for the dev script) rather than skipping verification.
- Prefer reading actual rendered text/DOM over re-reading source files when 
  debugging a rendering bug — the bug might be between the two.
---
