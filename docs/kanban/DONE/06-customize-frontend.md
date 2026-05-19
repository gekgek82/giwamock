# Customize Frontend

- **Status**: DONE
- **Priority**: Low
- **Created**: 2025-01-01

## Description

Replace the default landing page with your own design. Customize the look and feel of the application.

## Checklist

- [ ] Replace the default `apps/web/src/app/page.tsx` with your own landing page
- [ ] Update `apps/web/src/app/globals.css` with your brand colors
- [ ] Update `apps/web/src/app/layout.tsx` with your app title and metadata
- [ ] Add a navigation component
- [ ] Create main application pages

## Notes

- The default page includes a Live Status Panel — you can remove it once everything is confirmed working.
- Tailwind CSS is pre-configured. Use `tailwind.config.ts` to customize your theme.
- Components are Server Components by default. Add `'use client'` for interactive components.
