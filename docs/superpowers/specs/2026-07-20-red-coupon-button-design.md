# Red Coupon Button Design

## Goal

Increase the visibility of the existing square coupon action without changing its size, position, link, or behavior.

## Approved Design

- Keep the reward button to the right of the grade badge.
- Keep the existing 148px desktop square and 116px compact-mobile square.
- Replace the gold background with a deep red gradient from `#ff5a5f` to `#c91f32`.
- Change the button text from `領券` to `點我領券`.
- Keep `NT$<amount>` on the second line.
- Use white button text for clear contrast.
- Update the focus ring to a dark red color while preserving the existing white outline.
- Keep the grade-specific coupon URL, accessible name, new-tab behavior, and all other results content unchanged.

## Verification And Release

Add a source-contract test for the exact copy and red gradient, observe it fail, then implement the minimum JSX and CSS changes. Run the complete test suite, rebuild and export the standalone HTML, publish main and GitHub Pages, synchronize the company-network HTML, and compare SHA-256 hashes.
