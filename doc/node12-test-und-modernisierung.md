# Node12-Testumgebung und Modernisierungsplan

Dieses Dokument beschreibt einen sicheren Weg, das Projekt zuerst **stabil mit Node 12** zu testen und danach schrittweise auf moderne Versionen zu heben.

## 1) Ist-Stand im Repository

Aus `package.json`:

- Angular 9 (`@angular/* 9.1.x`)
- Electron `^11.1.0`
- TypeScript `3.8.3`
- Node-Engine `>=10.13.0`

Damit passt eine Testbasis mit Node 12 sehr gut.

## 2) Lokale Testumgebung mit Node 12 (ohne Docker)

### Voraussetzungen

- Linux/macOS: `nvm`
- Windows: `nvm-windows` oder alternativ Docker (siehe unten)

### Schritte

```bash
# 1) Node 12 installieren und aktivieren
nvm install 12.22.12
nvm use 12.22.12

# 2) im Projekt installieren
npm ci

# 3) Build + Smoke-Checks
npm run lint
npm run build:prod
```

Optional lokal starten:

```bash
npm run start
```

> Hinweis: `npm ci` ist für reproduzierbare Tests besser als `npm install`.

## 3) Virtuelle Testumgebung mit Docker Desktop (empfohlen)

Ja, das geht gut. Für erste Kompatibilitätschecks reicht ein Container ohne GUI.

### Einmaliger Test mit offiziellem Node-12-Image

```bash
docker run --rm -it \
  -v "$PWD":/app \
  -w /app \
  node:12.22.12-buster \
  bash -lc "npm ci && npm run lint && npm run build:prod"
```

### Warum Docker hier hilft

- reproduzierbare Umgebung für alle Entwickler
- kein „kaputtes“ globales Node/NPM Setup
- einfache Parallel-Tests mit mehreren Node-Versionen

## 4) Warum Grafana/WhatsApp „Browser zu alt“ melden

Die Anzeige in deiner App nutzt Electron/Chromium. Die Chromium-Version hängt an der Electron-Version.

Bei Electron 11 ist Chromium deutlich veraltet. Moderne Web-Apps (WhatsApp Web, aktuelle Grafana-Versionen) erwarten neuere Browser-Features und TLS-/Security-Standards.

## 5) Sicherer Update-Plan auf aktuellen Stand

Wichtig: **nicht alles in einem großen Sprung**. Besser in kleinen, testbaren Schritten.

### Phase A – Stabilisieren und einfrieren

1. Node-12-Basis lauffähig machen (siehe oben).
2. Lockfile committen und reproduzierbar bauen.
3. Optional: kleines E2E-Smoke-Szenario definieren (z. B. App startet, mindestens ein Frame lädt).

### Phase B – Electron zuerst modernisieren

Ziel: schnell neueres Chromium bekommen, damit Seiten wieder laufen.

Empfohlene Etappen:

1. `electron` + `electron-builder` auf eine moderne LTS-nahe Version heben (z. B. Electron 28/30, abhängig von Plugin-Kompatibilität).
2. Build/Start prüfen.
3. Sicherheitsrelevante BrowserWindow-Optionen prüfen (`contextIsolation`, `sandbox`, `nodeIntegration`).

> Vorteil: Schon vor einem Angular-Upgrade verbessert sich oft die Website-Kompatibilität deutlich.

### Phase C – Angular/Toolchain stufenweise upgraden

Von Angular 9 direkt auf 17/18 zu springen ist riskant. Besser:

- 9 → 10 → 11 → 12 ... (via `ng update` pro Major)
- pro Schritt: Build + Lint + Smoke-Test
- TypeScript-Version jeweils passend zur Angular-Version anheben

Hilfsbefehl pro Stufe (Beispiel):

```bash
npx ng update @angular/core@10 @angular/cli@10
```

Dann je Stufe testen und committen.

### Phase D – Node modernisieren

Wenn Electron/Angular aktualisiert sind:

- Node 12 → 18 LTS (oder 20 LTS)
- CI und Docker ebenfalls auf gleiche LTS-Version stellen

## 6) Praktische Reihenfolge für dein Projekt

1. Node-12-Testbasis fixieren (`npm ci`, `lint`, `build:prod`).
2. Electron modernisieren, bis WhatsApp/Grafana wieder sauber laden.
3. Erst danach Angular hochziehen.
4. Zum Schluss Node-LTS vereinheitlichen.

So minimierst du Risiko und bekommst früh sichtbaren Nutzen.

## 7) Typische Stolpersteine

- Native Abhängigkeiten bauen unter neuer Node-Version nicht mehr.
  - Lösung: pro Upgrade-Schritt `rm -rf node_modules package-lock.json && npm install` testen (nicht in jedem Commit nötig, aber bei Problemen hilfreich).
- Alte Test-Tools (z. B. Spectron) sind deprecated.
  - Mittelfristig auf Playwright/Electron-Tests migrieren.
- Zu großer Versionssprung auf einmal.
  - Immer pro Major-Version committen.

## 8) Minimale Checkliste je Upgrade-Schritt

- `npm ci` (oder bei Bedarf `npm install`)
- `npm run lint`
- `npm run build:prod`
- App manuell starten und mindestens Grafana + WhatsApp Frame prüfen
- Commit mit klarer Versionsaussage
