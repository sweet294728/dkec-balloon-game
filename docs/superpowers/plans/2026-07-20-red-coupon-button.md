# Red Coupon Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the existing square coupon action in red and change its visible call to action to `點我領券`.

**Architecture:** Keep the established results component structure and coupon data flow intact. Change only the visible copy in `Results.jsx` and the reward-action color tokens in `styles.css`, protected by a source-contract test.

**Tech Stack:** React 19, CSS, Vite 6, JavaScript ES modules, Node `node:test`

## Global Constraints

- Use the exact gradient `linear-gradient(135deg, #ff5a5f, #c91f32)`.
- Use the exact visible text `點我領券` above the unchanged `NT$<amount>` line.
- Preserve the 148px desktop square, 116px compact square, coupon URL, accessible name, and new-tab behavior.
- Do not change scoring, leaderboard, golden mode, Apps Script, or typography sizing.

---

### Task 1: Red coupon action

**Files:**
- Modify: `tests/contract.test.mjs`
- Modify: `src/components/Results.jsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: Existing `.reward-action` markup and styles.
- Produces: Exact `點我領券` visible copy and approved red gradient.

- [ ] **Step 1: Write the failing contract**

Replace the visible-copy assertion and add the color assertion:

```js
assert.match(source, /<span>點我領券<\/span>[\s\S]*<strong>NT\$\{reward\.amount\}<\/strong>/);
assert.match(styles, /\.reward-action\s*\{[^}]*color:\s*#ffffff[^}]*background:\s*linear-gradient\(135deg,\s*#ff5a5f,\s*#c91f32\)/s);
```

- [ ] **Step 2: Verify the contract fails**

Run: `node --test --test-name-pattern="square reward action" tests/contract.test.mjs`

Expected: FAIL because the source still contains `領券` and the gold gradient.

- [ ] **Step 3: Implement the approved copy and colors**

Use this JSX:

```jsx
<span>點我領券</span>
<strong>NT${reward.amount}</strong>
```

Use these CSS declarations in `.reward-action`:

```css
color: #ffffff;
background: linear-gradient(135deg, #ff5a5f, #c91f32);
box-shadow: 0 8px 20px rgba(143, 20, 36, 0.34);
```

Use this focus ring color:

```css
box-shadow: 0 0 0 7px #8f1424;
```

- [ ] **Step 4: Verify and publish**

Run:

```powershell
npm.cmd test
npm.cmd run export:html
npm.cmd run verify:production
```

Expected: all tests pass, the production build succeeds, and the standalone export verifies with twelve embedded images. Commit the changed source, test, export, design, and plan files; push `HEAD:main`; replace GitHub Pages `index.html` with the verified standalone export and push `HEAD:gh-pages`; synchronize the same export to the approved company-network path and compare SHA-256 hashes.
