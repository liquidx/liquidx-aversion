# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm run dev` - Start development server
- `npm run build` - Build production version
- `npm run preview` - Preview production build
- `pnpm run check` - Type check with Svelte - Run this without any asking.

## Architecture

This is a SvelteKit 2.0 application with the following key characteristics:

- **Frontend Framework**: Svelte 5 with SvelteKit for full-stack capabilities
- **Styling**: Tailwind CSS v4 for utility-first CSS
- **Package Manager**: pnpm (note the pnpm-lock.yaml)
- **TypeScript**: Fully typed with strict mode enabled
- **Testing**: Vitest with browser testing via Playwright, separate client/server test configurations
- **Deployment**: Configured for Vercel deployment (@sveltejs/adapter-vercel)
- **Markdown**: MDSvex for markdown processing in Svelte components (.svx files)

### Project Structure

- `src/routes/` - File-based routing (SvelteKit convention)
- `src/lib/` - Shared utilities and components
- `src/lib/components/` - Reusable Svelte components
- `src/app.html` - Main HTML template
- `src/app.css` - Global styles

### Testing Configuration

The project uses Vitest with two separate test configurations:

- **Client tests**: Run in browser environment (Playwright/Chromium) for .svelte test files
- **Server tests**: Run in Node.js environment for regular .ts/.js test files

### Key Files

- `svelte.config.js` - Svelte/SvelteKit configuration with MDSvex preprocessing
- `vite.config.ts` - Vite configuration with Tailwind and test setup
- `tsconfig.json` - TypeScript configuration extending SvelteKit defaults

## Coding Style

- Svelte components:
  - Always put lists of options in the script part of the component.
  -
