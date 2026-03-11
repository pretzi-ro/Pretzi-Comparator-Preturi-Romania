# Pretzi Source-Available

Versiunea publica, source-available, a extensiei Pretzi pentru Chromium.

Licenta: Pretzi Source-Available License v1.0. Vezi `LICENSE` si `TRADEMARKS.md`.

## Ce face

- detecteaza magazine suportate direct in tabul activ
- extrage local titlu, pret, pret vechi, stoc, identificatori si alte metadate
- ruleaza doar cand deschizi popup-ul extensiei
- nu depinde de backend, auth, analytics, queue-uri sau API-ul Pretzi
- este disponibila public pentru transparenta si audit

## Ce nu include

- comparatii cross-store din backend
- istoric de preturi din server
- alerte, conturi, onboarding, telemetrie
- widget injectat permanent in pagina

## Structura

- `extractor.js`: motorul de extractie multi-strategy
- `store-configs.js`: fallback-urile locale pentru magazine
- `scan-page.js`: scanner on-demand pentru tabul activ
- `popup.html`, `popup.css`, `popup.js`: interfata OSS

## Instalare locala

1. Deschide `chrome://extensions/`
2. Activeaza `Developer mode`
3. Alege `Load unpacked`
4. Selecteaza folderul `chrome-extension-oss`

## Model de rulare

Extensia nu are `background` si nu injecteaza continuu `content scripts`.
Cand deschizi popup-ul, foloseste `activeTab` + `scripting` pentru a incarca local scannerul doar in tabul curent.

## Publicare pe GitHub

Folderul este pregatit pentru un repo public.

Checklist scurt:

- include licenta custom din `LICENSE`
- include restrictiile de brand din `TRADEMARKS.md`
- extensia este self-contained si nu foloseste backend
- poate fi incarcata unpacked direct din `chrome-extension-oss`
