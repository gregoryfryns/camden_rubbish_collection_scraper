# 🗑️ Camden Rubbish Collection Scraper

A professional Google Apps Script automation that fetches waste collection schedules directly from the Camden Council API and sends automated email reminders to residents.

## 🚀 Features

- **Direct API Integration**: Bypasses the website to fetch accurate JSON data from the council's backend.
- **Automated Reminders**: Sends detailed email notifications when a collection is scheduled for the next day.
- **Emoji-Rich Status**: Quick-glance status updates using emojis (🍌 for food, 🗑️ for refuse, ♻️ for recycling, etc.).
- **Privacy First**: Sensitive data (property IDs and email recipients) is externalized and protected from version control.
- **Clasp Ready**: Fully configured for local development and deployment via `@google/clasp`.

## 🛠️ Setup & Deployment

### 1. Prerequisites

- [Node.js](https://nodejs.org/) installed.
- [clasp](https://github.com/google/clasp) installed globally: `npm install -g @google/clasp`.
- Google Apps Script API enabled in your [User Settings](https://script.google.com/home/usersettings).

### 2. Installation

Clone this repository and install dependencies:

```bash
npm install
```

### 3. Configuration

Create a file named `src/env.gs` (this file is excluded from Git via `.gitignore`). Add your property details and recipient emails:

```javascript
const PROPERTIES_LIST = [
  {
    recipients: 'your.email@example.com',
    propertyId: '123456' // Your Camden PointAddress ID
  }
];
```

*Note: You can find your `propertyId` by navigating to the [Camden Property Search](https://recyclingandrubbishcollections.camden.gov.uk/recycling-rubbish/property-search/), entering your address, and extracting the ID from the resulting URL:*
`.../property-search/{{propertyId}}/your-collection-days`

### 4. Deployment

Login to your Google account:

```bash
npx clasp login
```

Push the code to your Apps Script project:

```bash
npm run deploy
```

## 📅 Scheduling

Once the code is pushed:
1. Open your script in the [Google Apps Script Editor](https://script.google.com/).
2. Set up a **Time-driven trigger** for the `sendEmailReminders` function (e.g., daily between 6 PM and 7 PM).

## 🔒 Security

This repository is configured with `.gitignore` and `.claspignore` to ensure that `src/env.gs` and other sensitive configuration files are never committed to your public repository or pushed to the Apps Script project accidentally.

---

*Made with 🗑️ in London.*
