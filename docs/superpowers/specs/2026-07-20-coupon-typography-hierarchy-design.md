# Coupon Typography Hierarchy Design

## Goal

Make the reward amount immediately readable inside the existing red square coupon button without changing its size, position, color, destination URL, or reward logic.

## Approved Visual Direction

- Keep the current red square reward button beside the grade badge.
- Place `NT$` and the numeric amount on the first line, aligned on their text baseline.
- Render `NT$` clearly smaller than the amount.
- Make the numeric amount the dominant visual element.
- Place `點我領券` on a second line at a smaller size.
- Keep all button text white and preserve the current hover and keyboard-focus behavior.

## Responsive Behavior

The same hierarchy must fit the existing 148 px desktop button and 116 px compact-mobile button. Typography is defined once outside compact media queries so the existing mobile rule continues to change only spacing and component dimensions.

## Implementation Boundary

- `src/components/Results.jsx` separates currency, value, and action label into named elements.
- `src/styles.css` controls the three text levels and their baseline alignment.
- `tests/contract.test.mjs` verifies the semantic order, named elements, font hierarchy, red treatment, and existing square dimensions.

No reward URLs, amounts, grading thresholds, leaderboard behavior, or game behavior will change.

## Verification

Run the focused contract test, the full test suite, the production build, the single-file export verification, and a rendered mobile result-screen check before publishing.

## Revision: Supporting Text Legibility

The first browser-rendered version made the two supporting text levels too small at compact-mobile size. Keep the amount unchanged, increase `NT$` from `0.72rem` to `0.9rem` (14.4 px / 10.8 pt), and increase `點我領券` from `0.78rem` to `0.94rem` (15.04 px / 11.28 pt). The 116 px square must still have zero horizontal and vertical overflow.
