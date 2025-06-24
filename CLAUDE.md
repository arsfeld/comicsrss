# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ComicsRSS is a static site generator that scrapes comic strips from various websites and generates RSS feeds. The site is hosted on GitHub Pages at comicsrss.com.

## Architecture

The system works in two stages:
1. **Scrapers** fetch comic data from websites and cache it as JSON files in `_generator/tmp/`
2. **Site Generator** reads the cached JSON and generates static HTML/RSS files

Key design principles:
- Incremental scraping: Only fetch new comics since last cached entry
- 90-day expiration for old comics
- Priority system when multiple scrapers have the same comic
- No framework dependencies - pure Node.js

## Common Commands

```bash
# Navigate to generator directory first
cd _generator

# Install dependencies
npm ci

# Re-generate site using cached data (fast, for development)
node bin --generate

# Full scrape and generate (slow, fetches all comic data)
node bin --scrape --generate

# See all options
node bin --help

# Run tests (minimal test coverage)
node scrapers/lib/query-html.test.js
```

## Development Workflow

1. Most development work involves either:
   - Adding/fixing scrapers in `_generator/scrapers/`
   - Modifying site generation in `_generator/site-generator/`

2. When developing scrapers:
   - Use `arcamax.js` as template for multi-comic sites
   - Use `dilbert.js` as template for single-comic sites
   - Test locally with `node bin --scrape --generate --verbose`
   - Scrapers must handle incremental updates and expiration

3. Deployment is automatic via GitHub Actions every 6 hours

## Important Files and Directories

- `_generator/bin.js` - CLI entry point and argument parsing
- `_generator/scrapers/` - Individual website scrapers
- `_generator/scrapers/lib/` - Shared scraper utilities (HTTP, HTML parsing, merging)
- `_generator/site-generator/` - Static site generation logic
- `_generator/site-generator/template/` - HTML templates for site
- `_generator/tmp/` - Cached scraper data (JSON files, gitignored)
- `.github/workflows/scrape-and-generate.yml` - GitHub Actions deployment

## Key Implementation Details

- No linting or type checking configured
- Minimal dependencies: art-template, css-select, htmlparser2, json-stable-stringify
- Tests use Node.js assert module directly (no test framework)
- GitHub Actions uses caching to preserve scraper data between runs
- Generated files (index.html, rss/*.rss) are committed to gh-pages branch