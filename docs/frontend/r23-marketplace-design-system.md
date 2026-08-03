# R23 — Marketplace design system

## Visual concept

The Market Hall is Editorial Freight applied to commerce: considered editorial composition paired with direct product facts.

## Foundations

| Token / rule | R23 application |
| --- | --- |
| Canvas | White with `#f4f6f4` cool neutral sections |
| Text | Carbon `#0a0b0a`; quiet supporting text only |
| Action | Signal red `#d83a2e`, reserved for primary submit/action and underlines |
| Support | Mineral teal `#174c4a` narrow availability marker |
| Type | Mona Sans interface; Newsreader display headings |
| Rules | Thin neutral dividers; no elevated glossy cards |

## Grid, cards and media

The content max is 82rem with 20px/32px/48px responsive gutters. Category cards are compact orientation objects, stores are 1:1.45 cover-led records, product cards use 1:1.15 imagery, and product detail uses a square primary image. Images have fixed geometry before load; missing media is a labelled neutral plane. Seller identity is a logo/name relationship where the DTO supplies it, never a fake verification marker.

## Interaction and responsive behavior

Rails use native horizontal scroll only on compact layouts; desktop resolves them into grids. Hover only changes borders/underlines, while touch and keyboard states retain the same essential information. Detail metadata can be sticky only on desktop. The system prohibits broad gradients, glass, purple, ivory, rainbow categories, oversized pills, fake promotional badges, auto-rotating carousels and decorative icon sets.

## Cart and checkout composition

No R23 cart/checkout composition is invented because the current public DTO and production state cannot support it truthfully. Locked pages remain clear, quiet boundary pages using the public system rather than dashboard UI.
