# IntelliSource — Demo Video Production Guide
**Duration target:** 3 min 00 sec  
**Audience:** Client CPO / CFO / CXO — decision makers  
**Representing:** KPMG India  
**Tools:** NotebookLM (voiceover) · Google Veo 3 (AI B-roll clips) · Canva (editing + assembly)  
**Output format:** 1920×1080 MP4 · KPMG branding

---

## VIDEO STRUCTURE AT A GLANCE

| Segment | Duration | Content | Tool |
|---------|----------|---------|------|
| 0:00–0:40 | 40 sec | Problem Statement | Veo 3 AI clips |
| 0:40–1:00 | 20 sec | Solution intro + KPMG brand | Veo 3 + Canva text |
| 1:00–2:30 | 90 sec | App Demo (live screen recording) | Screen record + Canva |
| 2:30–3:00 | 30 sec | Impact numbers + Close | Veo 3 + Canva |

---

## FULL SCRIPT + VISUAL DIRECTIONS

---

### SEGMENT 1 — THE PROBLEM (0:00 – 0:40)

**[Veo 3 Clip 1 — 8 sec]**  
Prompt: *"Cinematic aerial shot of a corporate office at night, hundreds of windows glowing, financial documents and spreadsheets visible on screens, moody blue and navy color grade, photorealistic"*  

> **NARRATOR:**  
> Every year, large enterprises process tens of thousands of purchase orders, invoices, and vendor payments. Most of it — invisible.

---

**[Veo 3 Clip 2 — 8 sec]**  
Prompt: *"Close-up of hands frantically flipping through printed spreadsheets and Excel reports on a messy office desk, fluorescent office lighting, stressed professional, realistic"*  

> **NARRATOR:**  
> Procurement teams spend hours hunting for data across disconnected systems — SAP, Excel files, shared drives. By the time a report is ready, the decision is already late.

---

**[Veo 3 Clip 3 — 8 sec]**  
Prompt: *"Split screen: on the left a vendor sending a fraudulent duplicate invoice, on the right a finance team unaware, looking at paper files, cinematic, dark corporate aesthetic"*  

> **NARRATOR:**  
> Maverick spend goes undetected. Duplicate invoices slip through. Compliance breaches are discovered weeks after they happen.

---

**[Veo 3 Clip 4 — 8 sec]**  
Prompt: *"A CFO sitting in a boardroom looking stressed, large screen behind showing red financial charts dropping, dramatic corporate lighting, cinematic"*  

> **NARRATOR:**  
> Leadership has no real-time view. No early warning. No way to act — only react.

---

**[Veo 3 Clip 5 — 8 sec]**  
Prompt: *"Simple bold white text on black background reading 'What if you could see everything — in real time?' dramatic cinematic fade in"*  

> **NARRATOR:**  
> What if your entire Procure-to-Pay process was visible — in real time — with AI telling you exactly where to look?

---

### SEGMENT 2 — THE SOLUTION (0:40 – 1:00)

**[Veo 3 Clip 6 — 10 sec]**  
Prompt: *"Futuristic digital command center with glowing blue dashboards, procurement data flowing as light streams, KPMG-inspired navy and blue palette, premium cinematic"*  

> **NARRATOR:**  
> Introducing **IntelliSource** — KPMG's P2P Intelligence and Analytics Platform. Built to give procurement leaders complete, real-time visibility across every stage of the Procure-to-Pay cycle.

---

**[Canva: Static KPMG brand card — 10 sec]**  
Design: KPMG Navy background · White "IntelliSource" in large bold · Blue underline · Subtitle: "P2P Intelligence & Analytics Platform" · KPMG logo bottom-right

> **NARRATOR:**  
> Powered by AI. Integrated with your ERP. Deployable in days.

---

### SEGMENT 3 — APP DEMO (1:00 – 2:30)

> **NOTE:** This segment uses actual screen recordings of the running app.  
> Run app at localhost:8080. Use browser zoom 90%. Full-screen the browser. Record with QuickTime / OBS.

---

**[Screen Recording A — All 5 Dashboards: 30 sec]**  
Navigate rapidly: `/dashboard` → `/financial` → `/leadership` → `/vendors` → `/utilization`  
Spend ~5–6 sec per dashboard. On each — pause briefly on the KPI row, scroll down slightly to show charts, then navigate to next.  

> **NARRATOR:**  
> IntelliSource delivers five role-specific dashboards — Procurement, Financial, Leadership, Vendor Performance, and Utilization — each computing live KPIs directly from your ERP data. Total spend, invoice aging, vendor compliance, CAPEX vs OPEX split — all in one place, updated the moment data is uploaded.

---

**[Screen Recording B — Profit Center Management: 15 sec]**  
Navigate to: `/profit-center`  
Scroll through the profit center table — show PC codes, CAPEX/OPEX classification, budget vs. actuals columns. Hover on an Edit button briefly.  

> **NARRATOR:**  
> Profit Centers are managed directly within IntelliSource — mapped to departments, plants, and material groups, with CAPEX and OPEX classification automatically cascading across all PO data.

---

**[Screen Recording C — Vendor Repository + Add Vendor: 20 sec]**  
Navigate to: `/vendor-repo`  
Show the grid of vendor cards briefly, then click "Add Vendor" → Sheet slides in → slowly scroll through the form fields (Vendor Code, Name, Address, PAN, MSME Flag, Payment Terms, SPOC, Service Description) → close without submitting.  

> **NARRATOR:**  
> The Vendor Repository is your centralized vendor master. New vendors can be onboarded in seconds — capturing code, PAN, MSME status, contact details, and payment terms — instantly available across every dashboard and report.

---

**[Screen Recording D — P2P Lifecycle Tracker: 25 sec]**  
Navigate to: `/p2p`  
Show the funnel at the top — highlight the stage counts (PR → PO → GRN → Invoice → Payment). Scroll down to the process mining events table — pause on a row with anomaly flags highlighted in red/orange.  

> **NARRATOR:**  
> The P2P Lifecycle Tracker maps every transaction end-to-end — from Purchase Requisition to final payment. IntelliSource automatically detects bottlenecks and flags anomalies — a Maverick Buy, a payment made before GRN, a duplicate invoice — surfaced before they reach audit.

---

### SEGMENT 4 — IMPACT + CLOSE (2:30 – 3:00)

**[Veo 3 Clip 7 — 15 sec]**  
Prompt: *"Confident CFO smiling in a modern boardroom, large screen behind showing green financial charts trending upward, warm professional lighting, cinematic"*  

> **NARRATOR:**  
> Our clients see — 40% reduction in invoice processing time. 3× faster procurement cycle. Compliance issues caught before they become audit findings.

---

**[Canva: Animated stat cards — 10 sec]**  
Three cards fly in:
- `40%` faster invoice processing  
- `3×` procurement cycle speed  
- `100%` P2P visibility  

---

**[Veo 3 Clip 8 — 5 sec]**  
Prompt: *"KPMG-style professional logo reveal on deep navy background, clean, premium, corporate"*  

> **NARRATOR:**  
> IntelliSource. From KPMG. Because procurement intelligence shouldn't be optional.

---

## STEP-BY-STEP PRODUCTION PROCESS

---

### STEP 1 — Generate Voiceover in NotebookLM

1. Go to [notebooklm.google.com](https://notebooklm.google.com)
2. Create new notebook → Upload this file as a source
3. Click **Audio Overview** → Customize prompt:  
   *"Generate a professional, authoritative voiceover narration for a 3-minute corporate product demo video. Tone: confident, urgent, premium. Audience: CFO/CPO. Read the script sections in order, pausing naturally between segments."*
4. Download the generated MP3
5. **Alternative if NotebookLM audio doesn't match tone:**  
   Paste each narrator block into **ElevenLabs** (free tier) with voice "Adam" or "Rachel" — better for corporate narration

---

### STEP 2 — Generate B-Roll Clips in Google Veo 3

1. Go to [labs.google/veo](https://labs.google/veo) (or VideoFX)
2. For each **Veo 3 Clip** above, paste the exact prompt
3. Generate 2-3 variants per clip, pick best
4. Download all clips (MP4)
5. **Pro tips for Veo 3:**  
   - Always end prompts with "cinematic, photorealistic" for quality
   - Add "KPMG navy and blue color grade" to corporate clips for brand consistency
   - For text-only clips (Clip 5), Canva text animation works better than Veo

---

### STEP 3 — Record App Screen Recordings

**Setup:**
- Run backend: `cd backend && uvicorn main:app --port 8001`
- Run frontend: `cd kpmg-intelliflow && bun run dev`
- Open browser at `localhost:8080`, set zoom to 90%
- Use **QuickTime Player** (Mac) → File → New Screen Recording → select browser window
- Or use **OBS Studio** (free) for more control

**Record these 4 clips separately:**

| Clip | Route(s) | Duration | What to do |
|------|----------|----------|------------|
| A | `/dashboard` → `/financial` → `/leadership` → `/vendors` → `/utilization` | ~35 sec | Navigate through all 5 dashboards, ~6 sec each — pause on KPI row, scroll to charts, move on |
| B | `/profit-center` | ~20 sec | Scroll profit center table, show CAPEX/OPEX columns and budget vs actuals, hover Edit |
| C | `/vendor-repo` | ~25 sec | Show vendor grid briefly, click "Add Vendor", scroll all form fields slowly, close sheet |
| D | `/p2p` | ~30 sec | Show funnel stage counts at top, scroll to events table, pause on anomaly-flagged row |

**After recording:**
- Trim clips in QuickTime (Edit → Trim) to exact needed duration
- Export as MP4 1080p

---

### STEP 4 — Assemble in Canva

1. Open Canva → **Video** → **1920×1080 (HD)** blank project
2. **Timeline assembly order:**

```
[Clip1 Veo] [Clip2 Veo] [Clip3 Veo] [Clip4 Veo] [Clip5 Veo]
    → [Clip6 Veo] → [KPMG Brand Card]
    → [ScreenRec A: 5 Dashboards] → [ScreenRec B: Profit Centers]
    → [ScreenRec C: Add Vendor] → [ScreenRec D: P2P Lifecycle]
    → [Clip7 Veo] → [Stat Cards] → [Clip8 Veo Logo]
```

3. **Add voiceover:**  
   Upload the NotebookLM MP3 → Place on audio track → Sync timing to clip cuts

4. **Add background music:**  
   Canva Audio library → search "corporate cinematic" → pick instrumental track  
   Set volume to 15% (voiceover must dominate)

5. **Text overlays to add in Canva (per segment):**

| Segment | Text overlay | Font | Color |
|---------|-------------|------|-------|
| Seg 1 start | "The Problem" | Bold, 48px | White on dark |
| Seg 2 start | "IntelliSource" | Bold, 64px | White on KPMG Navy |
| Each screen rec | Feature name label (e.g. "Leadership Dashboard") | Medium, 24px | White pill overlay bottom-left |
| Seg 4 | Impact numbers | Bold, 72px | White |

6. **KPMG branding:**  
   Add KPMG logo (PNG with transparent background) to bottom-right corner on every slide as a persistent overlay element

7. **Transitions:**  
   Between Segments 1→2→3→4: use **Fade to Black** (0.5 sec)  
   Between screen recording clips: use **Smooth** or **Fade** (0.3 sec)

8. **Export:**  
   Download → MP4 → 1080p → Quality: High

---

## ASSETS CHECKLIST

| Asset | Source | Status |
|-------|--------|--------|
| Narration MP3 | NotebookLM | Generate from this file |
| Veo 3 Clip 1–8 | Google Veo 3 | Generate per prompts above |
| Screen Recording A–E | QuickTime/OBS | Record from running app |
| KPMG logo PNG | KPMG brand kit | Get from team |
| Background music | Canva Audio Library | Free, pick corporate instrumental |
| KPMG Brand card slide | Canva | Design in Canva |
| Stat cards slide | Canva | Design in Canva (3 animated tiles) |

---

## CANVA DESIGN SPECS

**Colors:**
- Primary background: `#0D1F35` (KPMG Navy)
- Accent: `#0057A8` (KPMG Blue)
- Highlight / stats: `#C9A84C` (Gold)
- Text: `#FFFFFF` (White)

**Fonts:**
- Headings: **Gill Sans Bold** or **Montserrat ExtraBold**
- Body/labels: **Montserrat Regular**

**Brand card layout:**
```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│         IntelliSource                                   │
│         ──────────────                                  │
│         P2P Intelligence & Analytics Platform           │
│                                         [KPMG logo]    │
└─────────────────────────────────────────────────────────┘
```

---

## TIMELINE ESTIMATE

| Task | Time needed |
|------|-------------|
| Generate 8 Veo 3 clips (2-3 variants each) | 45 min |
| NotebookLM voiceover generation | 10 min |
| App screen recordings (5 clips) | 20 min |
| Canva assembly + sync + text | 60-90 min |
| Export + review | 15 min |
| **Total** | **~3 hours** |

---

## QUICK NOTES

- **Veo 3 has audio**: Veo 3 generates clips with ambient sound — mute those tracks in Canva, keep only your voiceover + background music
- **Screen recording resolution**: Record at native 1080p or 2x retina, Canva will handle scaling
- **NotebookLM limitation**: Audio Overview generates a conversational podcast format. If it doesn't match corporate tone, use ElevenLabs or Google TTS Studio instead
- **App must be seeded**: Before recording screen clips, upload the sample CSVs so dashboards show real data, not empty states
