# AFDA Help Section Design

## Summary

Add an "AFDA" tab to the existing `HelpModal.tsx` that introduces the AFDA feature and guides users through both usage modes.

## Changes Required

### 1. `HelpModal.tsx`
- Add a fifth tab button: `AFDA` (value `'afda'`)
- Add tab content block for `activeTab === 'afda'` with four `AccordionSection` components
- Translation keys sourced from `t('helpModal.afda.*')`

### 2. `src/locales/en/downlodr.json`
Add `helpModal.afda` block with the following structure:

```
helpModal.afda.tabs.afda         — "AFDA"
helpModal.afda.whatIsAfda        — accordion 1
helpModal.afda.singleArticle     — accordion 2
helpModal.afda.websiteSubscription — accordion 3
helpModal.afda.managingSubscriptions — accordion 4
```

## Tab Structure

**Tab label:** `AFDA`  
**Tab value:** `'afda'`

### Accordion 1 — What is AFDA
Intro bullet list:
- AFDA (Article Feed Download Automation) finds and saves article content from news and blog websites.
- Two modes: single article download (one URL at a time) or website subscription (auto-downloads new articles on a schedule).
- Articles are saved as DOCX files to a folder of your choice.

### Accordion 2 — Downloading a Single Article
Numbered steps:
1. Paste an article URL into the search bar at the top of the app.
2. AFDA detects the URL as an article automatically.
3. Click the Article Installer button (document icon) that appears.
4. Choose a save folder if prompted.
5. The article is downloaded and saved as a DOCX file.

### Accordion 3 — Setting Up a Website Subscription
Numbered steps:
1. Navigate to the AFDA section from the sidebar.
2. Click "Add Website" to open the setup modal.
3. Paste the URL of the news or blog website.
4. Wait for the frequency analysis to complete — it detects how often the site publishes.
5. Configure your subscription:
   - Sub-bullets: Interval (Every 15 minutes / Every 1 hour / Every 6 hours / Daily), Category (News, Sports, Technology, etc.), Save folder.
6. Click Confirm — the website is added and monitoring begins.

### Accordion 4 — Managing Your Subscriptions
Bullet list:
- Pause or resume a subscription from the context menu or the detail page.
- Edit the check interval, category, or save folder from the Settings tab inside the subscription detail.
- Delete a subscription from the context menu — this removes monitoring but does not delete already-downloaded files.
- View per-subscription download history from the Downloads tab.
- View check history and activity from the Activity Log tab.

## Scope

- No new components — reuses `AccordionSection` already in `HelpModal.tsx`.
- Translation strings added to `en/downlodr.json` only (other locales follow existing pattern of being updated separately).
- No routing or state changes required.
