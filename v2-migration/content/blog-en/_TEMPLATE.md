---
# Blog post template (frontmatter contract)
# WARNING: once published, title and description are overridden by
# src/lib/blogSeo.js (KO_TITLES / EN_TITLES). blog.js resolves `seo?.title ||
# data.title`, so the values below act as fallbacks only and never reach the
# page or search results. Edit blogSeo.js to change a published post's title.
title: "Example article title"
description: "A concise search-result summary of this article."
date: "2026-08-01"
slug: "example-post"
keywords: "performance marketing, measurement"
tags: ["Measurement & analysis"]
draft: true
primaryTool: "5-18"
relatedGlossary: ["roas"]
# AAO/GEO editorial contract — shown in the opening answer block and SSR output.
answer: "Give the direct answer to the search question in no more than two sentences."
conditions: "State when the answer applies and its important exceptions."
reviewedAt: "2026-08-01"
reviewer: "Growth Opt Playbook editorial review"
# sources:
#   - title: "Primary or authoritative source title"
#     url: "https://example.com/source"
# faq is optional and appears as a visible accordion plus standard FAQPage data.
# Google stopped showing FAQ rich results in May 2026, so do not add FAQs only for search appearance.
---

## First section

Write the article here. Keep the first section useful without requiring a click,
then link readers to the related tool or glossary term when it helps them act.
