# Design System Guide: Obsidian Flux (for DevHub / Marketing Library)

## 1. Product Vision & Aesthetic
- **Reference:** Combines the high-fidelity aesthetic of Linear with the functional clarity of Tailwind CSS documentation. 
- **Theme:** Dark Mode First. Deep charcoal/obsidian surfaces with neon accents for reduced eye strain.
- **Surface Architecture:** Depth is communicated entirely through tonal layering rather than heavy drop shadows.

## 2. Visual Identity & Typography
- **Primary Color:** Electric Blue (#adc6ff) for primary actions and status.
- **Typography:** 
  - Sans-serif: `Inter` for high legibility across technical content.
  - Monospace: `JetBrains Mono` for code blocks and data tables.
- **Shape:** 0.125rem to 0.75rem border radius for a modern, precise feel.

## 3. Tailwind Design Tokens (Strictly enforce these values)

Use the following configuration extending the Tailwind theme. Do not invent new colors or spacing values.

```javascript
// tailwind.config.js (Theme Extension)
module.exports = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "background": "#121315",
        "surface-base": "#08090A",
        "surface-raised": "#111827",
        "surface-overlay": "#1F2937",
        "surface-container-lowest": "#0d0e0f",
        "surface-container-low": "#1b1c1d",
        "surface-container": "#1f2021",
        "surface-container-high": "#292a2b",
        "surface-container-highest": "#343536",
        "primary": "#adc6ff",
        "primary-container": "#4d8eff",
        "secondary": "#4cd7f6",
        "text-primary": "#F9FAFB",
        "text-secondary": "#9CA3AF",
        "text-muted": "#6B7280",
        "border-subtle": "rgba(255, 255, 255, 0.08)"
      },
      borderRadius: {
        "DEFAULT": "0.125rem",
        "lg": "0.25rem",
        "xl": "0.5rem",
        "full": "0.75rem"
      },
      spacing: {
        "sidebar-width": "280px",
        "container-max": "1280px",
        "gutter": "1.5rem",
        "section-gap": "2rem"
      },
      fontFamily: {
        "sans": ["Inter", "sans-serif"],
        "mono": ["JetBrains Mono", "monospace"]
      },
      fontSize: {
        "headline-xl": ["36px", {"lineHeight": "44px", "letterSpacing": "-0.02em", "fontWeight": "700"}],
        "headline-lg": ["24px", {"lineHeight": "32px", "letterSpacing": "-0.01em", "fontWeight": "600"}],
        "body-md": ["16px", {"lineHeight": "24px", "fontWeight": "400"}],
        "body-sm": ["14px", {"lineHeight": "20px", "fontWeight": "400"}],
        "label-mono": ["13px", {"lineHeight": "16px", "letterSpacing": "0.02em", "fontWeight": "500"}],
        "button": ["14px", {"lineHeight": "20px", "fontWeight": "500"}]
      }
    }
  }
}