# Coupon Typography Hierarchy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the text hierarchy inside the existing red square coupon button so the numeric reward amount is dominant and `點我領券` is secondary.

**Architecture:** Keep the existing reward link and data flow intact. Split its visible text into currency, numeric value, and action-label elements, then style those elements through focused component classes and protect the contract with source/CSS tests.

**Tech Stack:** React, CSS, Node test runner, Vite single-file export

## Global Constraints

- Keep the current red square button, dimensions, placement, link target, and reward data unchanged.
- Keep all reward-button text white.
- Render the first line as small `NT$` plus a much larger amount number; render `點我領券` below it.
- Do not add mobile-only font-size overrides.

---

### Task 1: Lock the hierarchy with a contract test

**Files:**
- Modify: `tests/contract.test.mjs`

**Interfaces:**
- Consumes: `Results.jsx` source and `styles.css` source.
- Produces: assertions for `.reward-amount`, `.reward-currency`, `.reward-value`, and `.reward-label`.

- [ ] **Step 1: Replace the old equal-weight text assertion**

Assert that `NT$` and `{reward.amount}` are separate elements inside `.reward-amount`, followed by `.reward-label` containing `點我領券`. Assert that `.reward-value` has the largest font size and currency/label use smaller fixed sizes.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `node --test --test-name-pattern="Results places the square reward action" tests/contract.test.mjs`

Expected: FAIL because the named hierarchy elements do not exist yet.

### Task 2: Implement the approved hierarchy

**Files:**
- Modify: `src/components/Results.jsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `reward.amount` from the existing grade reward lookup.
- Produces: the same outbound reward link with independently styled currency, amount, and CTA label.

- [ ] **Step 1: Split the link text into named elements**

Render `.reward-amount` first with `.reward-currency` containing `NT$` and `.reward-value` containing `{reward.amount}`. Render `.reward-label` with `點我領券` underneath.

- [ ] **Step 2: Add baseline and scale styles**

Use inline-flex baseline alignment for the first line, a responsive `clamp()` for the dominant number, and smaller fixed sizes for currency and label. Preserve the red gradient, square dimensions, white text, hover, and focus rules.

- [ ] **Step 3: Run the focused test and verify it passes**

Run: `node --test --test-name-pattern="Results places the square reward action" tests/contract.test.mjs`

Expected: PASS.

### Task 3: Verify, export, and publish

**Files:**
- Regenerate: `dist/DKEC氣球特攻隊-單檔版.html`
- Update: GitHub Pages branch root assets.
- Update: company standalone HTML copy.

**Interfaces:**
- Consumes: verified production source.
- Produces: matching local export, GitHub Pages deployment, and company-network copy.

- [ ] **Step 1: Run all checks**

Run: `npm.cmd test`, `npm.cmd run build`, `npm.cmd run export:html`, and `npm.cmd run verify:production`.

Expected: all tests pass and the production verifier reports success.

- [ ] **Step 2: Visually verify the result state**

Open the local app at a compact mobile viewport, reach the results screen, and confirm the 116 px button contains a small `NT$`, dominant amount, and secondary `點我領券` without clipping.

- [ ] **Step 3: Commit and publish**

Commit the source and generated standalone HTML, push `main`, update and push `gh-pages`, then copy the standalone HTML to the approved company path.

- [ ] **Step 4: Verify released bytes**

Download the public page and compare its SHA-256 with the local export and company copy. Expected: all three hashes match.
