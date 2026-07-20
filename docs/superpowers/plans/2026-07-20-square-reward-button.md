# Square Reward Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the grade-specific coupon link beside the results grade badge and render it as an equally sized, responsive square button.

**Architecture:** Keep reward selection in `Results.jsx` and the existing pure rules module unchanged. Add one presentational wrapper around the existing grade badge and reward anchor, then make its two children responsive peers through CSS. Lock the approved placement, copy, accessibility, and compact sizing into source-contract tests.

**Tech Stack:** React 19, CSS, Vite 6, JavaScript ES modules, Node `node:test`

## Global Constraints

- The circular grade badge stays on the left; the square reward action stays on the right.
- Regular layouts use matching 148px footprints; compact mobile layouts use matching 116px footprints.
- The button displays `領券` and `NT$<amount>` on separate lines.
- Existing grade-specific URLs, new-tab behavior, security attributes, text sizes, and results-page height behavior remain unchanged.
- Do not add dependencies or change scoring, leaderboard, golden-mode, or Apps Script behavior.
- Run `npm.cmd test` and `npm.cmd run build` before publishing.

---

### Task 1: Lock the approved results contract

**Files:**
- Modify: `tests/contract.test.mjs`
- Test: `tests/contract.test.mjs`

**Interfaces:**
- Consumes: `Results.jsx` source text and `styles.css` source text through the existing `readSource()` helper.
- Produces: Contract coverage for `results-reward-row`, short reward copy, accessible reward label, and 148px/116px square sizing.

- [ ] **Step 1: Write the failing tests**

Replace the existing reward-ordering test with assertions that require the combined row, then add a CSS contract:

```js
test('Results places the square reward action beside the grade before the leaderboard', async () => {
  const source = await readSource('components', 'Results.jsx');

  assert.match(source, /className="results-reward-row"[\s\S]*className=\{`results-grade[\s\S]*className="reward-action"/);
  assert.match(source, /aria-label=\{`領取 \$\{grade\.id\} 級獎勵，官網購物金 NT\$\$\{reward\.amount\}`\}/);
  assert.match(source, /<span>領券<\/span>[\s\S]*<strong>NT\$\{reward\.amount\}<\/strong>/);

  const rowIndex = source.indexOf('className="results-reward-row"');
  const leaderboardIndex = source.indexOf('<Leaderboard');
  const actionsIndex = source.indexOf('className="results-actions"');

  assert.ok(rowIndex >= 0);
  assert.ok(leaderboardIndex > rowIndex);
  assert.ok(actionsIndex > leaderboardIndex);
});

test('reward action matches the grade footprint on regular and compact results layouts', async () => {
  const source = await readSource('styles.css');

  assert.match(source, /\.results-reward-row\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*148px\)/s);
  assert.match(source, /\.reward-action\s*\{[^}]*width:\s*148px[^}]*min-height:\s*148px/s);
  assert.match(source, /@media \(max-width: 539px\) and \(max-height: 900px\)[\s\S]*\.results-reward-row\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*116px\)[\s\S]*\.reward-action\s*\{[^}]*width:\s*116px[^}]*min-height:\s*116px/s);
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `node --test --test-name-pattern="square reward|reward action matches" tests/contract.test.mjs`

Expected: FAIL because `results-reward-row`, the short copy, and square dimensions do not exist yet.

- [ ] **Step 3: Commit the failing contract**

```powershell
git add tests/contract.test.mjs
git commit -m "test: define square reward button contract"
```

### Task 2: Implement the paired grade and reward layout

**Files:**
- Modify: `src/components/Results.jsx`
- Modify: `src/styles.css`
- Test: `tests/contract.test.mjs`

**Interfaces:**
- Consumes: `grade.id`, `grade.label`, `reward.url`, and `reward.amount` already produced inside `Results`.
- Produces: `.results-reward-row` containing `.results-grade` and the conditional `.reward-action` anchor.

- [ ] **Step 1: Move the reward anchor into the grade row**

Use this structure before `results-summary` and remove the old full-width reward anchor after `results-progress`:

```jsx
<div className="results-reward-row">
  <div
    className={`results-grade results-grade--${grade.id.toLowerCase()}`}
    aria-label={`此次遊玩等級 ${grade.id}，${grade.label}`}
  >
    <span>此次遊玩等級</span>
    <strong>{grade.id}</strong>
    <small>{grade.label}</small>
  </div>

  {reward !== null && (
    <a
      aria-label={`領取 ${grade.id} 級獎勵，官網購物金 NT$${reward.amount}`}
      className="reward-action"
      href={reward.url}
      rel="noopener noreferrer"
      target="_blank"
    >
      <span>領券</span>
      <strong>NT${reward.amount}</strong>
    </a>
  )}
</div>
```

- [ ] **Step 2: Convert the results layout to matching responsive footprints**

Add the row and replace the existing grade/reward layout rules with:

```css
.results-reward-row {
  display: grid;
  margin: 20px auto 0;
  grid-template-columns: repeat(2, 148px);
  justify-content: center;
  align-items: stretch;
  gap: 16px;
}

.results-grade {
  display: grid;
  width: 148px;
  min-height: 148px;
  margin: 0;
  padding: 14px;
  place-content: center;
}

.reward-action {
  display: grid;
  width: 148px;
  min-height: 148px;
  padding: 14px;
  margin: 0;
  place-content: center;
  gap: 6px;
  border: 4px solid #ffffff;
  border-radius: 24px;
}

.reward-action span {
  font-weight: 900;
}

.reward-action strong {
  font-size: 1.2rem;
  line-height: 1;
}
```

Inside the existing compact-height media query, replace the grade margin override and full-width reward overrides with:

```css
.results-reward-row {
  margin-top: 8px;
  grid-template-columns: repeat(2, 116px);
  gap: 10px;
}

.results-grade,
.reward-action {
  width: 116px;
  min-height: 116px;
  padding: 8px;
}
```

- [ ] **Step 3: Run the focused contract tests**

Run: `node --test --test-name-pattern="square reward|reward action matches" tests/contract.test.mjs`

Expected: PASS.

- [ ] **Step 4: Run the full suite and build**

Run: `npm.cmd test`

Expected: all tests pass.

Run: `npm.cmd run build`

Expected: Vite production build completes without errors.

- [ ] **Step 5: Commit the implementation**

```powershell
git add src/components/Results.jsx src/styles.css
git commit -m "feat: place square reward button beside grade"
```

### Task 3: Export, verify, and publish

**Files:**
- Regenerate: `export/DKEC氣球特攻隊-單檔版.html`
- Synchronize: `\\10.10.1.252\電子商務部\07_個人資料夾\＊ALICE\DKEC呼吸小氣球\氣球特攻隊\DKEC氣球特攻隊-單檔版.html`

**Interfaces:**
- Consumes: Tested React/CSS production source.
- Produces: GitHub main, GitHub Pages, and company-network HTML containing the same verified build.

- [ ] **Step 1: Export the standalone HTML**

Run: `npm.cmd run export:html`

Expected: Vite build succeeds and `export/DKEC氣球特攻隊-單檔版.html` is regenerated.

- [ ] **Step 2: Verify the production artifact**

Run: `npm.cmd run verify:production`

Expected: production verification completes successfully.

- [ ] **Step 3: Commit the regenerated export**

```powershell
git add export/DKEC氣球特攻隊-單檔版.html
git commit -m "release: refresh square reward standalone HTML"
```

- [ ] **Step 4: Push the tested release branch and update the public pages branch**

Push the release branch to the remote main branch:

```powershell
git push origin HEAD:main
```

Replace the contents of the existing `deploy/golden-gh-pages` worktree with the verified `dist/` files using PowerShell `Copy-Item`, commit only the resulting page files, and push that worktree:

```powershell
Copy-Item -Path "C:\Users\DK-EC-PC3\Desktop\小精靈ip\balloon-game\.worktrees\golden-mode-public\dist\*" -Destination "C:\Users\DK-EC-PC3\Desktop\小精靈ip\balloon-game\.worktrees\golden-gh-pages" -Recurse -Force
git -C "C:\Users\DK-EC-PC3\Desktop\小精靈ip\balloon-game\.worktrees\golden-gh-pages" add -A
git -C "C:\Users\DK-EC-PC3\Desktop\小精靈ip\balloon-game\.worktrees\golden-gh-pages" commit -m "Deploy square reward button"
git -C "C:\Users\DK-EC-PC3\Desktop\小精靈ip\balloon-game\.worktrees\golden-gh-pages" push origin HEAD:gh-pages
```

Expected: remote `main` and `gh-pages` point to commits containing the square reward layout.

- [ ] **Step 5: Synchronize and compare the company HTML**

Copy the regenerated standalone HTML to the exact network path above, then compute SHA-256 hashes for the export and network copy.

Expected: both SHA-256 values are identical.
