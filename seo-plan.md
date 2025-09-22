Below is a complete, **SEO‑first** campaign for the keyword family **“chatgpt exporter.”** It’s structured as a sequence of concrete steps you can execute. I’ve included page blueprints, exact metadata, schema, internal links, and a lightweight outreach plan. Where it matters, I ground decisions in today’s SERP and official docs.

---

## 0) Objective, constraints, and positioning

* **Primary goal:** Rank a dedicated landing page for the exact‑match head term **“ChatGPT exporter.”**
* **Conversion:** Clicks to install (GreasyFork userscripts) and/or open the GitHub repo.
* **Moat / angle:** “**No extension, open‑source, works from the browser**; exports **Markdown & PDF**; supports **Gemini** too.” (Your repo confirms Markdown, PDF, HTML, and Gemini support. Use that directly.) ([GitHub][1])
* **What users compare against:** Chrome extensions (“ChatGPT Exporter,” ExportGPT, etc.) and OpenAI’s built‑in account export (which dumps a ZIP/JSON and isn’t per‑chat). ([Chrome Web Store][2])

---

## 1) Information architecture (the “pages you need”)

Create a tight cluster. One **canonical landing page** + 6 support pages:

1. **/chatgpt-exporter** (Canonical landing page — BOFU)

   * Purpose: Rank for **chatgpt exporter** and convert.
   * H1: *ChatGPT Exporter — Export chats to Markdown & PDF (no extension)*
   * CTA buttons (primary): **Install Markdown userscript** → GreasyFork; **Install PDF userscript** → GreasyFork; **View on GitHub**. ([Greasy Fork][3])

2. **/how-to/export-chatgpt-to-markdown** (Tutorial — MOFU)

   * Target: “export ChatGPT to markdown”, “chatgpt markdown exporter”.
   * Include **HowTo** schema and a short 90‑sec clip/GIF.

3. **/how-to/export-chatgpt-to-pdf** (Tutorial — MOFU)

   * Target: “export ChatGPT to pdf”, “chatgpt pdf exporter”.
   * Emphasize your **print‑optimized HTML → PDF** pipeline. ([GitHub][1])

4. **/compare/chatgpt-exporter-vs-extensions** (Comparison — MOFU)

   * Compare your userscript/console approach vs popular extensions (privacy, no background permissions, smaller surface area; output quality). Link examples (ChatGPT Exporter extension, ExportGPT). ([Chrome Web Store][2])

5. **/guide/export-all-chatgpt-data** (Informational — TOFU/MOFU)

   * Explain OpenAI’s **Account → Settings → Data Controls → Export** flow; show how that bulk JSON differs from per‑chat exports (your tool). ([OpenAI Help Center][4])

6. **/how-to/export-gemini-to-markdown** (Tutorial — MOFU)

   * Capture “Gemini exporter” tail with a concrete guide based on your v0.4+ support. ([GitHub][1])

7. **/docs/chatgpt-exporter** (Developer‑style docs — Support)

   * Quick Start (Userscript + Console), Troubleshooting, Known Limitations, Changelog (mirror GitHub Releases), Security/Privacy.

> Internal links: Each tutorial links **up** to `/chatgpt-exporter` and **laterally** to each other. The landing page points **down** to the tutorials, docs, and comparison.

---

## 2) Exact on‑page details (copy blocks, titles, metas, CTAs)

**Landing page (/chatgpt-exporter)**

* **Title tag (≤60):** ChatGPT Exporter — Export chats to Markdown & PDF (Open‑source)
* **Meta description (≤155):** Export ChatGPT conversations to Markdown or PDF in one click — no extension needed. Open‑source userscripts; preserves code blocks; Gemini supported.
* **H1:** ChatGPT Exporter — Export chats to Markdown & PDF (no extension)
* **Subhead (one sentence):** A lightweight, open‑source exporter that runs in your browser: clean Markdown, print‑ready PDF, proper code blocks — and Gemini support.
* **Primary CTAs (buttons):**

  * Install Markdown (GreasyFork) → *“Install userscript”*
  * Install PDF (GreasyFork) → *“Install userscript”*
  * View on GitHub → *“Star the repo”*
    (These tie directly to your GreasyFork entries and repo.) ([Greasy Fork][3])
* **Section: Why this over extensions?**

  * Works client‑side, no store install.
  * Minimal permissions footprint.
  * Cleaner Markdown, stable PDF (print‑optimized HTML → PDF). ([GitHub][1])
  * Link examples of extension approaches for contrast. ([Chrome Web Store][2])
* **Section: How it works (tabs)**

  * **Userscript method** (Tampermonkey/Violentmonkey) with 3 steps + screenshots. ([Greasy Fork][3])
  * **Console method** (paste snippet; one‑file download). (You’ve already published this flow on your blog; link it.) ([Rashid Azarang][5])
* **Section: Formats & platforms**

  * Markdown (.md), PDF (via print‑ready HTML), HTML (.html), Gemini Markdown. ([GitHub][1])
* **Section: Privacy & security**

  * “Runs in your browser. No servers. Open‑source (MIT).” Link LICENSE and repo. ([GitHub][1])
* **Section: Compare with OpenAI’s built‑in export** (short explainer + link to full guide). ([OpenAI Help Center][4])
* **FAQ (5–7 Qs)** — see §6.

**Tutorial pages**
Use action verbs in H1, include a short “Requirements,” and add **HowTo** schema (example JSON‑LD below). Cross‑link to the userscripts and repo each time. ([Greasy Fork][3])

**Comparison page**
A simple matrix: **Userscript (yours)** vs **Extension A (ChatGPT Exporter)** vs **OpenAI account export**. Cite specific claims sparingly and neutrally. ([Chrome Web Store][2])

---

## 3) Keyword map (head → mid → long tail)

* **Head (primary):** chatgpt exporter (LP)
* **Core variants (LP + internal H2s):** chat gpt exporter, chatgpt export, chatgpt export tool
* **Format intent:** export chatgpt to markdown (/how‑to/export‑chatgpt‑to‑markdown), export chatgpt to pdf (/how‑to/export‑chatgpt‑to‑pdf)
* **Platform tail:** export gemini to markdown (/how‑to/export‑gemini‑to‑markdown)
* **Workflow tail:** export chatgpt with code blocks; export chatgpt history; chatgpt account export vs per‑chat export (/guide/ & /compare/)

Keep URLs short and literal; repeat the exact phrase “chatgpt exporter” in the LP H1, first paragraph, and one subheading—naturally.

---

## 4) Technical SEO & tracking checklist (fast wins)

* Add **canonical** on all support pages pointing to themselves; only the LP targets the head term directly.
* **hreflang** if/when you add Spanish (see §9).
* **Schema:** `SoftwareApplication` on LP; `HowTo` on both tutorials; `FAQPage` on LP.
* **GSC:** Create a **page group** for this cluster; define conversions as outbound click events (GreasyFork installs, GitHub stars).
* **UTM tagging:** Add `?utm_source=site&utm_medium=cta&utm_campaign=chatgpt_exporter` to GreasyFork and GitHub links to measure.

---

## 5) Concrete schema you can paste

**a) SoftwareApplication (LP)**

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "ChatGPT Chat Exporter",
  "alternateName": "ChatGPT Exporter",
  "applicationCategory": "BrowserApplication",
  "operatingSystem": "Web",
  "softwareVersion": "0.5.0",
  "license": "https://opensource.org/licenses/MIT",
  "isAccessibleForFree": true,
  "description": "Export ChatGPT conversations as clean Markdown or print-ready PDF directly from your browser. No extension required. Open-source userscripts; Gemini supported.",
  "url": "https://rashidazarang.com/chatgpt-exporter",
  "sameAs": [
    "https://github.com/rashidazarang/chatgpt-chat-exporter",
    "https://greasyfork.org/en/scripts/530789-chatgpt-chat-exporter-markdown",
    "https://greasyfork.org/en/scripts/530790-chatgpt-chat-exporter-pdf"
  ],
  "creator": {
    "@type": "Person",
    "name": "Rashid Azarang"
  }
}
</script>
```

(Features and version reflected from your repo.) ([GitHub][1])

**b) HowTo (Markdown tutorial)**

```html
<script type="application/ld+json">
{
 "@context":"https://schema.org",
 "@type":"HowTo",
 "name":"How to Export ChatGPT Conversations to Markdown",
 "description":"Use an open-source userscript or console snippet to export any ChatGPT chat as Markdown.",
 "step":[
  {"@type":"HowToStep","name":"Install a userscript manager","text":"Install Tampermonkey or Violentmonkey in your browser."},
  {"@type":"HowToStep","name":"Install the Markdown exporter","url":"https://greasyfork.org/en/scripts/530789-chatgpt-chat-exporter-markdown"},
  {"@type":"HowToStep","name":"Open a conversation in ChatGPT","text":"Navigate to the chat you want to export."},
  {"@type":"HowToStep","name":"Click 'Export as Markdown'","text":"The .md file will download automatically."}
 ]
}
</script>
```

(Flow aligned to your userscript method.) ([Greasy Fork][3])

**c) FAQPage (LP)** — see §6 for Q/A content; wrap 5–7 items into one `FAQPage` object.

---

## 6) LP FAQ (captures People‑Also‑Ask style questions)

* **How is this different from OpenAI’s data export?**
  OpenAI’s export delivers a ZIP with all history in JSON via email; it’s not a per‑chat Markdown/PDF export. This exporter saves **the current conversation** directly from your browser. ([OpenAI Help Center][4])

* **Do I need a Chrome extension?**
  No. Use a userscript (Tampermonkey/Violentmonkey) or paste a console snippet. ([Greasy Fork][3])

* **What formats are supported?**
  Markdown (.md), print‑ready PDF (via HTML), and HTML; Gemini Markdown is also supported. ([GitHub][1])

* **Does it preserve code blocks and formatting?**
  Yes — code blocks and structure are preserved in both Markdown and PDF. ([GitHub][1])

* **Is it safe?**
  It runs locally in your browser; the code is open‑source (MIT). ([GitHub][1])

* **Why not use an extension instead?**
  Extensions exist (e.g., ChatGPT Exporter, ExportGPT), but they add permissions and background code. If you value minimal footprint and transparency, a userscript or console‑only approach is simpler. ([Chrome Web Store][2])

---

## 7) Strengthen the repo & GreasyFork for SEO assist

* **GitHub README/H1:** “**ChatGPT Chat Exporter (Markdown & PDF, no extension)**” — put “ChatGPT Exporter” in the first 140 characters and the repository description.
* **Topics:** `chatgpt-exporter`, `chatgpt`, `markdown`, `pdf`, `userscript`, `tampermonkey`, `greasyfork`, `gemini`.
* **Releases:** Maintain descriptive release notes and link back to `/docs/chatgpt-exporter` and the LP. (You already have v0.5.0 release notes; keep this rhythm.) ([GitHub][1])
* **GreasyFork pages:** Add the site LP under “Support” and the GitHub Releases link. (They already show author and install info; keep them tidy.) ([Greasy Fork][3])

---

## 8) Comparison content (one page, one table)

Columns: **Your userscript** | **Popular extension** | **OpenAI account export**

* Install footprint: *Userscript / Console* vs *Chrome Web Store* vs *No install*
* Output: Per‑chat **MD/PDF/HTML** vs similar formats vs **ZIP/JSON**
* Privacy: Local script vs Extension permissions vs Emailed link to ZIP
* Use case: Publishable docs; code blocks; Gemini vs extension UI niceties vs archival/transfer use cases
  Cite example extension pages neutrally. ([Chrome Web Store][2]) and link OpenAI’s help for the account export. ([OpenAI Help Center][4])

---

## 9) Internationalization (quick win)

Add **Spanish** mirrors for LP and the two tutorials:

* `/es/exportador-chatgpt`
* `/es/como-exportar-chatgpt-a-markdown`
* `/es/como-exportar-chatgpt-a-pdf`

Use proper **hreflang** between EN/ES pairs. (Your audience spans EN/ES; Spanish queries like *exportar ChatGPT a PDF/Markdown* are active.)

---

## 10) Distribution that feeds SEO (lightweight, targeted)

Backlinks and mentions raise authority. Seed a few durable links:

* **Your existing post** — keep it, but **add a banner link** to the new LP + tutorials. ([Rashid Azarang][5])
* **Reddit follow‑ups** — post an update in the same thread with v0.5.0 notes and the LP (one comment; non‑spam), and optionally cross‑post to relevant subreddits where allowed (e.g., r/ObsidianMD for the Markdown tutorial). ([Reddit][6])
* **“Show HN”** once the LP/docs are live (clear demo GIF + code link).
* **Awesome lists / curated repos** (e.g., “awesome‑userscripts”, “awesome‑chatgpt”).
* **Click‑through snippets** on X/LinkedIn with a 10‑sec demo GIF.

---

## 11) Measurement & targets

* **Primary KPIs (30/60/90‑day):**

  * Rank movement for “chatgpt exporter” (Top 3 in 60–90d is realistic with this cluster and your GitHub footprint).
  * LP CTR & **install clicks** (GreasyFork) and **repo stars** (GTM outbound events).
* **Diagnostic KPIs:**

  * Tutorial impressions for “export chatgpt to pdf/markdown”.
  * Average position of the comparison page for “chatgpt export extension” queries.

---

## 12) Execution timeline (4 weeks)

**Week 1 — Build the core**

* Ship LP + both tutorials + docs page.
* Implement SoftwareApplication, HowTo, FAQ schema.
* Wire GTM events for outbound clicks.

**Week 2 — Comparison & OpenAI guide**

* Publish the comparison page and the “Export all data” guide (with OpenAI help center citations). ([OpenAI Help Center][4])
* Add cross‑links everywhere. Update your blog post with “See the exporter” callouts. ([Rashid Azarang][5])

**Week 3 — i18n + demos**

* Publish Spanish mirrors.
* Add short GIFs and a 60–90s video to each tutorial.

**Week 4 — Distribution**

* Reddit update in your original thread + one allowed cross‑post. ([Reddit][6])
* “Show HN” post.
* Submit to 1–2 relevant awesome lists.

---

## 13) Content blueprints (you can paste and tune)

**LP opening (above the fold):**

> **ChatGPT Exporter — Markdown & PDF, no extension**
> Export any ChatGPT conversation as clean Markdown or a print‑ready PDF. Runs in your browser, open‑source (MIT), preserves code blocks, and supports Gemini.
> **\[Install Markdown userscript]** • **\[Install PDF userscript]** • **\[View on GitHub]**
> *(Works on ChatGPT; Gemini Markdown supported.)* ([Greasy Fork][3])

**Tutorial outline (Markdown):**

* H1: How to Export ChatGPT to Markdown (Free, Open‑Source)
* Summary: 1 paragraph; link to LP.
* Prereqs: userscript manager or use the console method. ([Greasy Fork][3])
* Steps (with screenshots/GIF): Install → Open chat → Click “Export as Markdown”.
* Verify output (show code block fidelity).
* Troubleshooting: selectors, long chats, images as placeholders (as in your blog). ([Rashid Azarang][5])
* CTA: “Prefer PDF? See Export to PDF.”

**Comparison table bullets:**

* **Userscript (yours):** No store install, local only, MD/PDF/HTML, Gemini MD. ([GitHub][1])
* **Extensions (examples):** Chrome Web Store install, more formats/UI, permissions footprint. ([Chrome Web Store][2])
* **OpenAI export:** Full‑account JSON via email (archive/transfer; not per‑chat docs). ([OpenAI Help Center][4])

---

## 14) SERP‑aware notes you can leverage in copy

* There are **commercial extensions** claiming multi‑format export (PDF/MD/TXT/JSON), positioned as quick one‑click tools. Your differentiator is **no extension** + **open‑source transparency** + **clean MD and stable print‑PDF**. Cite neutrally when comparing. ([Chrome Web Store][2])
* Users also search for **“export all data / move chats”**, which is OpenAI’s account‑level export. Your guide should clearly draw that line. ([OpenAI Help Center][4])

---

## 15) Maintain authority (E‑E‑A‑T signals)

* **Author box** on each page with link to repo, GreasyFork scripts, and release notes. ([GitHub][1])
* **Changelog** and **Known Limitations** (e.g., images handled as placeholders in MD; PDF path relies on print‑ready HTML). ([Rashid Azarang][5])
* **Security note:** “Runs locally; review the source” with direct links to the exact exporter files. ([GitHub][1])

---

## 16) Optional, high‑leverage additions

* **One consolidated “/download” page** that simply routes users to GreasyFork MD/PDF scripts and the repo (fast mobile path). ([Greasy Fork][3])
* **Programmatic long‑tail stubs** that you can fill as features grow:

  * `/how-to/export-chatgpt-to-html` (already supported). ([GitHub][1])
  * `/how-to/import-chatgpt-markdown-into-obsidian` (workflow guide).
* **Short YouTube walkthrough** (“Export ChatGPT to Markdown/PDF — Open‑source userscripts”). Link back to the LP in the description; it will rank in YouTube search and sometimes in Google video SERPs.

---

## 17) Minimal outreach copy you can reuse

**Reddit update (reply to your thread):**

> Update: v0.5.0 — smart file naming + true print‑ready PDF. Still no extension; just userscript/console. Markdown, PDF, HTML; preserves code blocks; Gemini supported. Write‑up + install links here → *LP URL*. Repo → *GitHub*. ([Reddit][6])

**Show HN title:**

> Show HN: ChatGPT Exporter — Open‑source userscripts to export chats to Markdown/PDF (no extension)

---

## 18) What to measure weekly

* Queries: **“chatgpt exporter”**, **“export chatgpt to markdown/pdf”** (GSC).
* Events: Outbound clicks to **GreasyFork** & **GitHub** (GTM). ([Greasy Fork][3])
* Page health: Indexing status, coverage, and rich‑results appearance for HowTo/FAQ.

---

### Why this plan will work

* It meets the query **with a single, canonical page** named exactly as the head term.
* It **fans out** into tutorials, a comparison, and an OpenAI‑export guide to harvest the long tail and internal‑link relevance.
* It leans on your **existing assets** (repo, blog post, GreasyFork) and aligns with how the current SERP frames the space (extensions vs scripts vs OpenAI export). ([Chrome Web Store][2])

If you want, I can draft the LP and both tutorials (including schema blocks and CTA wiring) in your voice next.

[1]: https://github.com/rashidazarang/chatgpt-chat-exporter "GitHub - rashidazarang/chatgpt-chat-exporter: A lightweight browser-based tool to export your ChatGPT conversations in beautiful Markdown or PDF format."
[2]: https://chromewebstore.google.com/detail/chatgpt-exporter-chatgpt/ilmdofdhpnhffldihboadndccenlnfll?utm_source=chatgpt.com "ChatGPT Exporter - ChatGPT to PDF, MD, and more"
[3]: https://greasyfork.org/en/scripts/530789-chatgpt-chat-exporter-markdown "ChatGPT Chat Exporter - Markdown"
[4]: https://help.openai.com/en/articles/7260999-how-do-i-export-my-chatgpt-history-and-data?utm_source=chatgpt.com "How do I export my ChatGPT history and data?"
[5]: https://rashidazarang.com/c/export-your-chatgpt-conversations-to-markdown-pdf "Export Your ChatGPT Chats"
[6]: https://www.reddit.com/r/ChatGPTPromptGenius/comments/1jjacr4/til_you_can_export_chatgpt_conversations_to/?utm_source=chatgpt.com "TIL You Can Export ChatGPT Conversations to Markdown ..."
