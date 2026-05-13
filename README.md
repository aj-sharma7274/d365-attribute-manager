# D365 Power Kit

> Open source Chrome extension — Power tools for Microsoft Dynamics 365

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Open Source](https://img.shields.io/badge/Open%20Source-%E2%9D%A4-red)](https://github.com/aj-sharma7274/d365-power-kit)

---

## Features

| Feature | Description |
|---|---|
| ⚡ **Auto Authentication** | Detects your active D365 session automatically |
| ➕ **Bulk Create Fields** | Create any field type in bulk using an Excel template |
| 🗑️ **Bulk Delete Fields** | Delete multiple fields with dependency checking |
| 📤 **Export Schema** | Export full entity metadata to multi-sheet Excel |
| 📋 **Audit Logs** | Session-based tamper-evident operation logs |

---

## Tech Stack

All open source — MIT licensed:

- **Vite** — Build tool
- **React 18** — UI framework
- **Tailwind CSS** — Glassmorphism design system
- **Zustand** — State management
- **SheetJS (xlsx)** — Excel read/write
- **Lucide React** — Icons

---

## Getting Started

```bash
# Install dependencies
npm install

# Build extension
npm run build

# Load in Chrome
# 1. Open chrome://extensions
# 2. Enable Developer Mode
# 3. Click "Load unpacked" → select /dist folder
```

---

## Security

- Session token encrypted with AES-256-GCM
- In-memory storage only — never written to disk
- All API calls proxied through content script using cookie auth
- Logs are session-based — cleared when session ends

---

## License

MIT © D365 Power Kit Contributors