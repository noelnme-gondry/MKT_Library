---
# Blog post template (frontmatter contract)
# WARNING: once published, the title is overridden by src/lib/blogSeo.js
# (EN_TITLES). blog.js resolves `seo?.title || data.title`, so the title below
# acts as a fallback only and never reaches the page or search results. Edit
# blogSeo.js to change a published post's title.
# The description is the opposite: the value below is used as-is (unless
# blogSeo has a DESCRIPTION_OVERRIDES entry). Over 160 chars fails
# contentRegistry.test.js.
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
# General sites are rarely eligible for Google's FAQ rich results, so add FAQs only when they answer real reader questions.
---

## First section

Write the article here. Keep the first section useful without requiring a click,
then link readers to the related tool or glossary term when it helps them act.
