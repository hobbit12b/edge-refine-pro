
# SpriteMaster v5 + Edge Refine & Color Removal

## Eerst even je BRIA-vraag beantwoorden

Nee — de tool gebruikt op dit moment **geen BRIA**. In `backgroundRemovalService.ts` staat:

```ts
import { removeBackground as removeBackgroundImgly } from '@imgly/background-removal';
const config = { model: 'isnet', ... }
```

Dus het draait volledig op de open-source **@imgly/background-removal** library met het **ISNet**-model, lokaal in de browser via WASM. Het label "BRIA BG REMOVER" is puur cosmetisch en klopt niet. We hernoemen dat naar **"AI BG Remover (ISNet)"**.

`geminiService.ts` bevat wél `detectSubject()` die chromaColor + tolerance + edge refinement teruggeeft, maar die wordt nergens aangeroepen. Die gaan we koppelen aan de nieuwe color-removal flow (zie hieronder).

---

## Wat ik ga bouwen

### Stap 1 — Volledige v5 importeren
Alle bestanden uit je zip overzetten naar het Lovable-project: `App.tsx`, `types.ts`, `utils.ts`, alle componenten (`SpriteAnalyzer`, `LeftSidebar`, `RightSidebar`, `MainPreview`, `FrameManualEditor`, `ExportPanel`, `SheetSlicer`, `AnimationTester`, `PlaybackControls`, `TopHeader`, `FileUpload`), beide services, en `index.css`. Routes in `App.tsx` (Lovable-shell) wijzen naar de SpriteMaster app als index.

Dependencies die geïnstalleerd moeten worden: `@imgly/background-removal`, `@google/generative-ai`, `framer-motion`, plus alles wat de v5 al gebruikt.

### Stap 2 — Nieuwe feature: Kleurverwijdering (aanbevolen aanpak)

Mijn advies: **hybride** — handmatige eyedropper als basis, met optionele Gemini-auto. Reden:

- **Pure kleur-removal** (flood fill vanaf randen + tolerantie) is voor egale spritesheet-achtergronden 10× sneller en strakker dan ISNet, en is volledig deterministisch.
- **Gemini auto** is handig als je 200 frames hebt met wisselende achtergronden — laat AI per frame de juiste kleur + tolerantie kiezen, daarna doet de chroma-engine het zware werk lokaal.
- **ISNet** blijft de fallback voor complexe/foto-achtige achtergronden.

Nieuwe sectie **"Kleur verwijderen"** in de LeftSidebar, onder de AI BG Remover knop:

- **Eyedropper-knop** → cursor wordt pipet, klik op een pixel in de preview → kleur wordt opgeslagen + voorbeeld-swatch.
- **Tolerantie-slider** (0–100, default 12) — live preview op huidig frame.
- **Modus-toggle**: `Verbonden vanaf rand` (flood fill, beste voor sprites met losse pixels in subject) vs `Alle pixels` (globale kleurmatch).
- **Zachte rand toggle** (anti-alias 1px aan de overgang).
- **"Toepassen op selectie"** knop — verwerkt alle geselecteerde frames met dezelfde kleur+tolerantie.
- **"Auto per frame (Gemini)"** knop — roept `detectSubject()` aan, vult chromaColor + tolerance + edge refinement automatisch in per frame, voert dan de chroma-removal lokaal uit. Toont per frame een mini-preview van de gekozen kleur.

### Stap 3 — Nieuwe feature: Rand verfijnen

Nieuwe collapsible sectie **"Rand verfijnen"** onder Kleur verwijderen, met vier knoppen + slider voor sterkte (1–3 px):

| Knop | Wat het doet |
|---|---|
| Rand krimpen | Alpha-erode N px — vreet vuile achtergrondrandjes weg |
| Rand uitbreiden | Alpha-dilate N px — herstelt te agressief weggeknipte sprites |
| Rand verzachten | Feather/Gaussian blur op alpha-kanaal (default uit, niet voor pixelart) |
| Halo verwijderen | Decontaminate: voor elke semi-transparante randpixel, schat de "echte" subject-kleur door de achtergrondkleur (eyedropper-kleur of Gemini-detected) eruit te rekenen |

Werkt op huidige selectie. Niet-destructief stapelbaar (undo/redo via bestaande history). Pure canvas, geen externe libs.

### Stap 4 — Editor toolbar herschikken

Op dit moment staan **Penseel / Lasso / Poly Lasso / Magnetic** in de LeftSidebar en **Gum / Herstel** in de FrameManualEditor — voelt gescheiden.

We voegen ze samen in **één bovenbalk** binnen `FrameManualEditor`:

```text
[ Penseel | Lasso | Poly Lasso | Magnetic | Gum | Herstel ]   |   Brush size [——•——] 12px   Anti-Alias [✓]   Ghosting [✓]
```

De LeftSidebar-tools verwijzen naar dezelfde `interactionMode` state, zodat alles synchroon blijft. De duplicate rij in de LeftSidebar wordt verwijderd (of ingeklapt tot één label "Bewerk in editor →"), zodat de gebruiker direct snapt: tools zitten in de editor.

---

## Technische details

- **Color removal** = `ImageData.data` loop: voor elke pixel `dist = √(Δr² + Δg² + Δb²)`, vergelijken met `tolerance × 4.42` (schaal naar 0–442). Modus "verbonden vanaf rand" = BFS flood fill startend vanaf alle 4 randen.
- **Erode/dilate** = morfologische operatie op alpha-kanaal met N-iteraties van 3×3 min/max kernel.
- **Decontaminate** = per pixel met `0 < alpha < 255`: `c_out = (c_in − bg × (1 − alpha/255)) / (alpha/255)`, geclamped op 0–255.
- **Eyedropper** = klik-event op preview canvas → `ctx.getImageData(x,y,1,1).data` → hex.
- **Gemini auto** = bestaand `detectSubject()` per frame, `chromaColor` + `tolerance` doorgeven aan chroma-engine, `edgeRefinement.erosion` + `.blur` doorgeven aan rand-stap.
- **GEMINI_API_KEY**: huidige code leest `process.env.GEMINI_API_KEY` direct in de browser — onveilig. Ik verplaats Gemini-calls naar een Lovable Cloud edge function en gebruik **Lovable AI Gateway** met `google/gemini-3-flash-preview` (geen losse key nodig, automatisch geconfigureerd).
- **BRIA-knop**: label wordt `AI BG Remover (ISNet)`, tooltip licht toe dat het `@imgly/background-removal` met ISNet-model is, lokaal via WASM.
- Alle nieuwe features integreren met bestaande `pushToHistory()` zodat undo/redo werkt.

## Wat ik niet doe (tenzij je vraagt)
- Echte BRIA API integratie (commerciële key vereist).
- Pen tool / vector masks.
- Refactor van de 1231-regel `App.tsx` — werkt en focus ligt op features.
