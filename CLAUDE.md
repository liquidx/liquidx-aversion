# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm run dev` - Start development server
- `npm run build` - Build production version
- `npm run preview` - Preview production build
- `npm run check` - Type check with Svelte
- `npm run check:watch` - Type check in watch mode
- `npm run lint` - Run linting (Prettier + ESLint)
- `npm run format` - Format code with Prettier
- `npm run test` - Run all tests once
- `npm run test:unit` - Run tests in watch mode

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

## Plan & review

### Before starting work

- Always start in plan mode to make a plan.
- After completing the plan, write the plan in .claude/tasks/TASK_NAME.md
- The plan should contain detailed implementation plan, the reasoning behind the plan and the tasks that are brokwn down.
- If the task require external knowledge or certain package, also research ot get the latest knowledge (Use Task Tool for research)
- Do not over plan, always think of the minimum viable product.
- Once you write the plan, first ask me to review it. Do no continue until I approve the plan.

## While working

- You should update the plan as you work.
- After you complete tasks in the plan, you should update and append detailed descriptions of the changes you made so following tasks can be easily handed over to other engineers.
