# eFootball Tourney

A web-based management system for eFootball tournaments with an Arabic user interface.

## Features
- Tournament discovery and browsing
- Player registration with avatar upload (via ImgBB)
- Admin panel: create tournaments, approve players, manage group draws and match results
- AI-powered match analysis via Google Gemini (falls back to manual calculation)
- Single Page Application with client-side routing

## Tech Stack
- **Frontend**: HTML5, CSS3, JavaScript (ES6 Modules), Firebase JS SDK
- **Backend**: Node.js + Express (serves static files and proxies AI requests)
- **Database**: Firebase Firestore
- **External APIs**: Google Gemini AI (server-side proxy), ImgBB (image hosting)

## Architecture
- `server.js` — Express server on port 5000; serves static files and exposes `/api/ai/analyze` as a secure server-side proxy for Gemini
- `index.html` — SPA shell with bottom navigation bar
- `js/app.js` — Firebase init, client-side router, UI helpers
- `js/controllers.js` — Firestore CRUD operations and page init logic
- `js/ai.js` — Calls `/api/ai/analyze` (never exposes API keys to the browser)
- `pages/` — HTML fragments loaded by the router
- `css/style.css` — All styling (neon/glass aesthetic)

## Security Notes
- The Gemini API key is stored as an environment variable (`GEMINI_API_KEY`) and never sent to the browser
- AI requests are proxied through `/api/ai/analyze` on the server
- Firebase config in `js/app.js` is intentionally client-side (protected by Firestore security rules)

## Running the Project
```
npm start
```
Server runs on port 5000.

## Environment Variables
- `GEMINI_API_KEY` — Google Gemini API key (optional; AI falls back to manual calculation if absent)
