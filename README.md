# 💸 SplitSmart - The GOAT of Expense Splitting

> **No cap,** splitting expenses with your crew just got easier. No more awkward conversations about who owes who. It's giving financial peace vibes ✨

---

## 🎯 What's This About?

You know that moment when you're on a trip with friends and someone paid for the hotel, someone else got dinner, and now nobody remembers who owes what? **Yeah, this app fixes that.**

SplitSmart is a lightweight web app that:
- 🤝 Lets you create groups (your apartment, your trip, your project crew)
- 💰 Tracks who paid for what
- 📊 Shows you exactly who owes who (with ZERO drama)
- 🤖 Uses AI to figure out smart recommendations
- ✨ Has smooth animations that hit different (Acerinity UI, fr fr)

**No backend, no API keys, no cap.** Just pure vibes and functionality.

---

## ✨ Features That Slap

### 🏠 Group Management
- Create groups for trips, apartments, or project teams
- Add/remove members on the fly
- Give your group a vibe with descriptions

### 💸 Smart Expense Tracking
- Log expenses with descriptions and amounts
- Split equally or customize splits per person
- Auto-categorize expenses (Food 🍕, Travel 🚗, Stay 🏨, Shopping 🛍️, Entertainment 🎬)
- Delete expenses if you made a goof

### 📊 Balances & Settlements
- Real-time balance tracking:
  - **Positive balance** = You're about to get paid back 📈
  - **Negative balance** = You owe someone (time to pay up 👀)
- Minimal settlement suggestions (the math works so you don't have to)
- No more complicated payment chains

### 🤖 AI Recommendations (No API Needed!)
- **High Spender Alert** 🚨 - When one person's covering everything
- **Budget Insights** 📈 - Spots which category is bleeding money
- **Member Engagement** 👥 - Reminds you who's not participating
- **Smart Suggestions** - Gets smarter as you use it

### 🎨 Gen Z UI That Hits Different
- Smooth Acerinity-style animations on hover
- Glassmorphism design (that blurred aesthetic)
- Dark-friendly color scheme
- Responsive AF (mobile, tablet, desktop all good)
- Real-time date/time display
- Rotating motivational quotes (no cap energy) 🌟

### 🔐 Multi-Auth Support
- Sign in with email
- Phone OTP verification
- Cloud sync with Supabase (optional)

---

## 🛠️ Tech Stack

| What | Tech |
|------|------|
| **Frontend** | Vite ⚡ + TypeScript 🦾 |
| **Styling** | Pure CSS (no bloat) |
| **Storage** | Browser localStorage + optional Supabase |
| **State** | In-memory management (fast AF) |
| **Deployment** | Vercel / Netlify (static site energy) |

**Zero dependencies on external APIs for core features.** Everything just works.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v16+)
- npm or yarn

### Installation

```bash
# Clone the repo
git clone https://github.com/Prajjaval08/smart-expense-splitter.git
cd smart-expense-splitter

# Install dependencies
npm install

# Start the dev server
npm run dev
```

Open **http://localhost:5173/** in your browser and start splitting! 🎉

### Build for Production

```bash
npm run build
```

Deploy the `dist/` folder to Vercel, Netlify, or any static host.

---

## 🎮 How to Use

1. **Create a Group** - Name it (e.g., "Goa Trip 2026")
2. **Add Members** - Who's in the squad?
3. **Log Expenses** - Someone paid for dinner? Log it
4. **Split Smart** - Equally or custom splits
5. **Check Balances** - See who's up and who's down
6. **Settle Up** - Follow the suggestions and you're golden
7. **Get AI Recommendations** - Insights tab shows smart tips

---

## 📦 What's Inside

```
src/
├── main.ts          # All the logic & UI (it's a glow up ✨)
├── style.css        # Pure CSS vibes (no frameworks)
├── supabaseClient.ts # Optional cloud sync
└── counter.ts       # Legacy stuff
```

### Core Functions That Matter

- `smartCategorize()` - Figures out if you're spending on food or travel
- `computeBalances()` - Does the math so you don't have to
- `simplifySettlements()` - Finds the minimal way to settle up
- `generateRecommendations()` - AI-powered spending insights

All the good stuff happens in `main.ts` - it's readable, it's clean, no cap.

---

## 🚀 Deploy to the World

### Vercel (Recommended)

```bash
# Push to GitHub first
git push origin main

# Go to vercel.com
# Click "New Project" → Select this repo
# Framework: Vite
# Build command: npm run build
# Output directory: dist
# Deploy! 🚀
```

### Netlify

```bash
# Same process but on netlify.com
# Build command: npm run build
# Publish directory: dist
```

Your app will be live in minutes. Share the link and flex on your friends 💪

---

## 🎨 Design Philosophy

- **No bloat** - Just what you need
- **No backend** - Run anywhere
- **Smooth UX** - Animations that feel premium
- **Dark mode ready** - Respects your preferences
- **Gen Z vibes** - Fun, fast, and actually useful

---

## 🤝 Contributing

Got ideas? Found a bug? PRs welcome! This is just the beginning fr fr.

```bash
git checkout -b feature/amazing-idea
git commit -m "no cap, this feature slaps"
git push origin feature/amazing-idea
```

---

## 📝 License

MIT - Do whatever you want with it

---

## 💬 Questions?

- 📧 Create an issue on GitHub
- 🐦 Tweet about it
- 💰 If this saves you money, buy me a coffee (jk... unless? 👀)

---

**Made with ❤️ and smooth animations by Prajjaval08**

*Split smart, live easy.* ✨

No cap, this repo hits different.

