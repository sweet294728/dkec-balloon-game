# Square Reward Button Design

## Goal

Make the reward claim action immediately visible on the results screen by moving it beside the grade badge and presenting it as a square button.

## Approved Layout

- Group the circular grade badge and reward action in one centered horizontal row.
- Keep the grade badge on the left and place the reward action on the right.
- Give both items matching responsive footprints: approximately 148px on regular layouts and 116px on compact mobile layouts.
- Preserve the existing grade badge colors and contents.
- Style the reward action as a rounded square with the existing gold gradient, white border, shadow, hover feedback, and visible keyboard focus.
- Show two short lines inside the reward action: `領券` and `NT$<amount>`.
- Remove the old full-width reward banner below the score-progress message.
- Keep the existing grade-specific coupon URL, new-tab behavior, and security attributes.
- Keep the pair side by side on compact phones without reducing the existing text sizes or increasing the results screen height.

## Component Changes

`src/components/Results.jsx` will introduce a wrapper around the grade badge and conditional reward link. The existing reward calculation remains unchanged. The link will keep the `reward-action` class so its behavior and contract stay stable while its placement and copy change.

`src/styles.css` will style the new wrapper as a centered two-column layout. The reward link will become a square grid item instead of a full-width banner. The existing compact-height media query will reduce both items to 116px.

## Accessibility

- The reward remains a semantic anchor.
- Its accessible name will include the achieved grade and exact shopping-credit amount.
- Keyboard focus styling remains clearly visible.
- The visual text is kept short so it does not wrap unpredictably on narrow screens.

## Testing And Release

- Add a source-contract test that requires the grade and reward to share the new wrapper and requires the short reward copy.
- Update the ordering test to assert that the combined grade/reward block remains before the leaderboard and results actions.
- Add responsive-style assertions for the square dimensions on regular and compact layouts.
- Run the complete test suite and production build.
- Export the standalone HTML, verify the production artifact, publish the current branch to GitHub, update GitHub Pages, and synchronize the company-network HTML copy.
