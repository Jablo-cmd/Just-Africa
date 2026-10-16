# Just Africa

**Discover the continent. Experience the extraordinary.**

Just Africa is an Africa-wide tourism discovery platform featuring destinations, travel inspiration, accommodation and safari experiences, and future tourism-business partnerships.

## Current MVP

- Responsive editorial homepage with destination discovery sections
- Searchable destination directory with text search and travel-style filters
- Travel guides landing page
- Early-stage tourism partner information page
- Mobile navigation, accessible controls, reduced-motion support and responsive layouts
- Page-specific metadata and lightweight static HTML for search-engine accessibility
- GitHub Actions workflow for static deployment to GitHub Pages

## Technology

The first version uses semantic HTML, CSS and vanilla JavaScript. It has no build step, framework dependency, database, API key or backend requirement.

## Run locally

Open `index.html` in a browser, or serve the repository root with any static HTTP server.

## Deployment

The workflow in `.github/workflows/deploy-pages.yml` deploys the repository root when changes reach `main`.

After merging the initial site, open **Settings → Pages** and select **GitHub Actions** as the build and deployment source. The workflow will then publish the site on pushes to `main`. A custom domain can be connected after domain ownership and DNS settings have been confirmed.

## Before public launch

- Verify all destination facts, image rights and image attribution requirements
- Replace or confirm imagery and add descriptive, country-specific editorial content
- Configure the production domain, canonical URLs, sitemap and robots rules
- Add a privacy policy and cookie disclosure if required by analytics or advertising tools
- Connect and test any contact, newsletter, affiliate or booking workflows before advertising them
- Apply for advertising and affiliate programmes only after the site meets their current requirements
- Test mobile performance, accessibility, broken links and Core Web Vitals

## Business model direction

Potential future revenue streams include display advertising, accommodation and tour referrals, clearly labelled sponsored placements, and direct tourism partnerships. No booking, payment, lead-capture or advertising integration is active in this MVP.
