## Smart Expense Splitter

Lightweight web app to manage shared expenses in trips, flats, or teams. Create a group, add members, log expenses, and instantly see who owes whom with suggested minimal settlements.

### Tech stack

- **Frontend**: Vite + TypeScript (single-page app)
- **State**: In-memory in `src/main.ts` (no backend required)
- **Styling**: Modern, responsive CSS (no UI framework)
- **Deploy targets**: Works on Vercel or Netlify as a static site

### Core features

- **Groups & members**
  - One group per session (e.g. “Trip to Goa”), editable name
  - Add/remove members dynamically
  - Removing a member also removes their related expenses

- **Expenses**
  - Add expense with **description**, **amount**, **payer**, and **split type**
  - Split **equally** across all members or **custom** by amount per person
  - Validation so custom shares must sum to the total amount
  - Delete existing expenses

- **Balances & settlements**
  - Real-time per-member balances:
    - Positive = this member should **receive**
    - Negative = this member **owes**
  - Minimal settlement suggestions computed from balances (who pays whom and how much)

### AI-like features (no external API required)

- **Smart expense categorization**
  - Expenses are auto-tagged into categories (e.g. `Food`, `Travel`, `Stay`, `Shopping`, `Entertainment`, `Other`)
  - Categorization is based on keywords in the description (e.g. “uber”, “flight”, “pizza”, “rent”)

- **Spending insights**
  - Shows total amount spent
  - Highlights the largest spending category and its total

These run locally and don’t require any API keys, so the app remains easy to run and deploy.

### Running locally

```bash
cd smart-expense-splitter
npm install
npm run dev
```

Then open the printed local URL (usually `http://localhost:5173`) in your browser.

### Build & deploy

#### Build

```bash
npm run build
```

This generates a static bundle in the `dist` folder.

#### Deploy to Vercel

1. Push this project to a **public GitHub repository**.
2. Go to Vercel and **Import Project** from GitHub.
3. Framework preset: **Vite** (or “Other” with the settings below).
4. Build command: `npm run build`
5. Output directory: `dist`
6. Deploy. Vercel will give you a public URL you can share.

#### Deploy to Netlify

1. Push this project to a **public GitHub repository**.
2. On Netlify, choose **New site from Git** and select the repo.
3. Build command: `npm run build`
4. Publish directory: `dist`
5. Deploy to get a public URL.

### Architecture overview

- All core logic lives in `src/main.ts`:
  - **Types**: `Member`, `Group`, `Expense`, `Balance`, `Settlement`
  - **Core functions**:
    - `smartCategorize(description)` – rule-based categorization
    - `computeBalances(group)` – aggregate what each member paid vs. owes
    - `simplifySettlements(balances)` – greedy algorithm to generate minimal “A pays B” transfers
  - **UI logic**:
    - `render()` renders the full UI from the current `group` state
    - `bindEvents()` wires up inputs/buttons to update state and re-render

This keeps the app small, easy to reason about, and ideal for a 24‑hour implementation.

### Suggested demo flow (for your 3–5 min video)

1. **Intro (10–20s)**
   - Briefly say what Smart Expense Splitter solves and the tech stack.
2. **Create group & members (30–40s)**
   - Rename the default group.
   - Add a couple of new members.
3. **Add expenses (1–2 min)**
   - Add a **Food** expense split equally.
   - Add a **Travel** expense split with **custom** shares.
   - Show automatic categorization chips on the expense list.
4. **Show balances & settlements (40–60s)**
   - Point out positive vs negative balances.
   - Highlight the “who pays whom” settlement list.
5. **Insights (20–30s)**
   - Show total spend and top category.
6. **Close (10–20s)**
   - Mention deployment (Vercel/Netlify) and GitHub repo link.

### Notes on extensibility

- You can later:
  - Persist state using `localStorage` or a backend API.
  - Support multiple named groups with a group switcher.
  - Replace the rule-based categorization with a real LLM API if allowed.

