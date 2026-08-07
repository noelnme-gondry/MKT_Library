---
title: "Ad Creative Specs Guide: Platform Sizes and Safe Zones"
description: "Ignore each platform's image and video specs and UI safe zones, and creative gets rejected in review or has its core message cropped."
date: "2026-07-18"
slug: "ad-creative-specs-guide"
keywords: "ad creative specs, creative sizes by platform, video safe zone, playable ad specs, creative review rejection, app ad creative guide"
tags: ["Ad Creative", "Metrics Basics"]
draft: false
---

Upload the same video to several platforms without thinking, and some crop it automatically while others reject it outright in review. Each platform demands different ratios, file sizes, and UI safe zones. However good the creative is, if the spec blocks it, it never serves.

## Specs differ by platform

Image and video ratios (1:1, 4:5, 9:16), minimum resolution, and file-size caps vary by platform. And within one platform, feed, stories, and reels have different recommended ratios.

These specs **change often**, so memorizing them isn't worth much. Checking the platform's current official spec each time you set up a campaign is safer. Instead, master the original at the **largest resolution with room to spare** and crop per placement — then a spec change won't force a reshoot.

## Video has regions hidden by the UI

Vertical (9:16) video gets platform UI — like button, username, CTA — overlaid on top. That overlap is the safe zone, and if you put key captions or price info there, users never see it.

The **bottom** of the screen especially is where many platforms park the CTA button and account name. So text you can't afford to lose belongs in the middle to upper area. If you run in multiple countries, set the safe zone against the **longest-translating language** so it doesn't get clipped where the copy runs long.

## Playable ads have tight size limits

Interactive (playable) ads carry an industry-standard (IAB) size cap. It counts HTML, JS, and images all together, so it's exceeded faster than you'd expect. In practice:

- Replace bundled fonts with **system fonts**.
- Compress images and drop unnecessary frames.
- External server calls are often blocked, so **inline every resource** inside the file.

## Why creative fails review

- **Size over cap**: playables especially often re-measure over the limit on a decompressed basis even when you thought there was room.
- **External domain calls**: calling an outside API from inside a playable is usually rejected.
- **Auto-redirect / auto-click**: sending users to the store with no user action is a policy violation.
- **Key info outside the safe zone**: this passes review but underperforms — a quiet failure that's easy to miss.

## Let's be honest

Exact pixel and size numbers change constantly, so the moment you carve them into a post they risk going stale. Remember only the principle — that ratios, safe zones, and size caps exist — and check current numbers in the [creative specs by platform guide](/guide/creative-specs) or the platform's official docs right before you set up.
