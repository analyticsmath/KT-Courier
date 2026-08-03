# R21 administration mobile architecture

R21 uses the R13 full-screen administration navigator and the existing grouped
navigation. It adds no second global navigation system.

- At 320–599px, protected financial and governance tables use
  `EditorialTable` `mobileMode="stack"`: each row becomes a labelled semantic
  record rather than a squeezed grid.
- Detail views use protected panels and definition lists; money is kept in
  tabular figures and never reduced to an unlabeled icon or colour alone.
- At 600–1024px, panels may form controlled two-column evidence layouts while
  filters and canonical action islands retain usable touch targets.
- At expanded widths, the R13 sidebar persists; tables may scroll only inside
  their own bounded container, never at the page root.
- The shared R21 administration boundary keeps focus outlines visible and
  constrains overflow. The R13 shell provides the skip link, main landmark,
  forced-colours, reduced-motion, safe-area and keyboard baseline.

Manual review remains required at 320, 360, 390, 430, 600, 768, 834, 1024,
1280, 1440 and 1920px, plus mobile landscape, 200% zoom and 400% reflow.

Recruitment review, developer oversight, notification attempts and permission
review use the same labelled-record principle. Existing filters and
confirmations remain their small client islands and must remain usable above the
software keyboard, inside safe areas and in mobile landscape. There are no
desktop-only financial actions; dense matrix/table detail moves to a dedicated
record route or a bounded local overflow container.
