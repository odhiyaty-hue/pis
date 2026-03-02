# eFootball Tourney

A static web application for managing eFootball tournaments with group stages, match tracking, and knockout brackets.

## Architecture

- **Frontend**: Pure HTML/CSS/JavaScript (no build step required)
- **Database**: Firebase Firestore (cloud-hosted, config in `js/app.js`)
- **Server**: `serve` npm package serving static files on port 5000

## Project Structure

```
index.html          - Main entry point (SPA shell with bottom nav)
css/style.css       - All styles
js/
  app.js            - Firebase init, router, UI utilities
  controllers.js    - Page controllers and Firestore interactions
  ui.js             - UI helper functions
  db.js             - Stub (merged into controllers.js)
  firebase.js       - Stub (merged into app.js)
pages/
  home.html         - Home page
  register.html     - Player registration
  groups.html       - Group stage view
  matches.html      - Match listing
  bracket.html      - Knockout bracket
  admin.html        - Admin panel
  login.html        - Login page
firestore.rules     - Firestore security rules
package.json        - npm config with serve dependency
```

## Running the App

```bash
npm start
```

Serves all static files on `http://localhost:5000`.

## Firebase Configuration

Firebase config is embedded in `js/app.js`. The app uses Firestore for all data storage. Security rules are in `firestore.rules`.

## Deployment

Configured as a static site deployment (publicDir: ".").
