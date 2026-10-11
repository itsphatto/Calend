
Calend is a free, open-source shared calendar for small groups. No accounts. No email. No ads. Make a board, share the code, and everyone pins notes to days in real time.


## Get Started

1. Go to [calend.itsphatto.site](https://calend.itsphatto.site)
2. Create a board or join one with a code
3. Pick a name and color
4. Pin notes to days
5. Share the code with your group

That's it. No sign-up. No password. Just open it and go.

---

## Features

- **Create or join boards** with an 8-character code
- **Real-time syncing** — everyone sees changes instantly
- **Pin notes to any day** (up to 100 characters each)
- **Edit, delete, or reorder** your notes anytime
- **Your name and color** on every note you pin
- **Delete entire boards** if you're the creator
- **Light and dark themes** — your choice, remembered
- **Mobile-friendly** — calendar on desktop, list on phones
- **Zero friction** — no accounts, no email, no setup

---

## How It Works

Calend uses **Firebase Realtime Database** and **anonymous authentication**. When you open the app, you get a random ID that stays with you (until you clear your browser data). Your name and color are stored with every note you pin.

**The code is the security.** Anyone with your board code can see and pin notes. Treat codes like passwords. Don't share them with people you don't trust, and don't put sensitive info in notes.

Ownership is by name within a group (so you can switch devices and still edit your notes). The creator can delete the entire board.

---

## Structure

```
Calend/
├── Website/                    # Landing page & main app
│   ├── index.html              # Homepage (scroll reveal design)
│   ├── landingpage.css         # Homepage styles
│   ├── landingpagescript.js    # Theme toggle, animations
│   ├── MainHub.html            # Join/create board page
│   ├── MainHubstyle.css        # Hub styles
│   ├── MainHubScript.js        # Board logic (code entry, recent boards)
│   ├── calendar.html           # Calendar/board view
│   ├── calendarstyle.css       # Calendar styles (light/dark theme)
│   ├── calendarBackEnd.js      # Firebase sync, note management
│   ├── Privacy.html            # Privacy policy
│   └── TermOfservice.html      # Terms of service
├── Software/                   # Mirror folder (same files, different paths)
└── sigmaboysixseven/           # Firebase rules & PWA config
    ├── FirebaseRule.json       # Database security rules
    └── manifest.webmanifest    # Web app manifest
```

---

## Tech Stack

- **Frontend:** Vanilla HTML, CSS, JavaScript (no frameworks)
- **Backend:** Firebase Realtime Database (Google Cloud)
- **Auth:** Firebase Anonymous Authentication
- **Hosting:** Static hosting (Vercel)
- **Design:** Custom CSS with light/dark theme support

---


##  Privacy & Security

We don't collect data. We don't track you. We don't sell anything.

- Your notes live in Firebase
- Your browser stores your theme, profile, and recent boards
- Firebase stores your anonymous ID, notes, and board metadata
- Google (Firebase provider) sees your IP address when you load fonts
- The developer can access the database

---


## Credits

Built by [itsphatto](https://github.com/itsphatto).




