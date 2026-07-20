# Coupon Typography Design QA

- Source visual truth: `C:/Users/DK-EC-~1/AppData/Local/Temp/codex-clipboard-05db068f-acc5-4979-85e8-1a5223cb0edc.png`
- Implementation screenshot: `artifacts/coupon-typography-390x844.png`
- Viewport: 390 x 844 CSS pixels
- State: compact-mobile results screen, D grade, NT$10 reward

## Full-view Comparison Evidence

The source reference and browser-rendered implementation were opened together for direct comparison. The implementation reproduces the requested hierarchy: a small `NT$` shares the first line and baseline with a much larger numeric amount, while `點我領券` is a smaller second line. The existing project constraints intentionally remain different from the neutral reference canvas: the control stays red, square, white-text, and beside the grade badge.

Browser measurements confirm the compact button remains exactly 116 x 116 px with zero horizontal or vertical overflow. Computed font sizes are 14.4 px (10.8 pt) for `NT$`, 35.1 px (26.3 pt) for the amount, and 15.04 px (11.28 pt) for `點我領券`.

## Focused-region Evidence

A separate crop was not required because the supplied source is already an isolated typography reference and the 116 px button text is legible at original resolution in the mobile implementation screenshot. The browser DOM and computed-style measurements independently confirm the baseline grouping, font hierarchy, and absence of clipping.

## Required Fidelity Surfaces

- Fonts and typography: passed. The amount remains dominant while the currency prefix and CTA are now large enough to read comfortably at compact-mobile size.
- Spacing and layout rhythm: passed. The two-line group is centered inside the unchanged square and does not overflow.
- Colors and visual tokens: passed. The approved red gradient, white text, border, shadow, hover, and focus treatment are preserved.
- Image quality and asset fidelity: passed. This change introduces no new image assets and does not alter existing imagery.
- Copy and content: passed. `NT$`, the dynamic reward amount, and `點我領券` are preserved exactly.

## Findings

No actionable P0, P1, or P2 differences were found.

## Open Questions

None.

## Implementation Checklist

- [x] Small currency prefix and dominant numeric amount share one baseline.
- [x] CTA label appears below at a secondary size.
- [x] Existing red square button and reward link remain unchanged.
- [x] Compact-mobile button fits without clipping or overflow.
- [x] Browser console checked for errors.

## Comparison History

- Earlier pass: the currency prefix and CTA measured 11.52 px and 12.48 px; user review identified them as too small.
- Fix applied: increased the two supporting levels to 14.4 px and 15.04 px without changing the amount.
- Post-fix evidence: the revised 390 x 844 browser capture shows both labels clearly, and the 116 x 116 control still has zero overflow with no console warnings or errors.

## Follow-up Polish

None required for this request.

final result: passed
