# stock-watchers

**Browser userscripts for monitoring retail inventory, restocks, product availability, and online waiting rooms.**

`stock-watchers` is a collection of experimental [Tampermonkey](https://www.tampermonkey.net/) scripts that help you keep an eye on hard-to-find products. The goal is simple: provide configurable product monitoring, a visible status dashboard, and timely alerts when something changes.

> [!IMPORTANT]
> These scripts are personal-use monitoring tools, **not guaranteed inventory or queue-entry solutions**. Retail websites change frequently. Always test a script against the current site before relying on it for a release.

## Features

- **Product monitoring** — Watch product pages or search results for relevant changes.
- **Randomized polling** — Configure a minimum and maximum interval between page refreshes.
- **On-page dashboard** — Track monitoring status, refresh counts, countdowns, and recent activity.
- **Availability alerts** — Get notified when a supported page appears to offer a product for purchase.
- **Queue awareness** — Detect some visible waiting-room states and official queue-entry controls.
- **Pause and reset controls** — Manage monitoring from the page without editing the script.

Features vary by script and retailer; see the source of each script for its actual behavior.

## Getting started

1. Install [Tampermonkey](https://www.tampermonkey.net/) in a supported browser.
2. Open the desired `.user.js` file in this repository and copy its source.
3. In Tampermonkey, select **Create a new script**, replace the template, and save.
4. Edit the script's configuration (such as product URL/SKU and polling intervals).
5. Navigate to the matching retailer page and check the on-page status dashboard.

For easy future updates, keep each script in a file ending in `.user.js` and retain its userscript metadata header (`// ==UserScript==`).

## Planned improvements

- [ ] Independently configured monitors for multiple product URLs
- [ ] More robust product availability and queue-state detection
- [ ] Verified selectors and integration tests against supported retailer flows
- [ ] Per-product monitoring history and alert preferences
- [ ] Cleaner shared dashboard components across scripts
- [ ] Additional retailers

## Responsible use

Please respect retailer terms, rate limits, and access controls. These scripts should not circumvent captchas, queue admission rules, or anti-bot protections, and should not generate excessive traffic. Availability information is best-effort and can be outdated or incorrect.

## Contributing

Contributions, bug reports, and retailer-specific selector updates are welcome. When filing an issue, include the script version, a non-sensitive example URL, the expected behavior, and the observed behavior. Remove any cookies, tokens, account details, or other personal information from logs and screenshots.
