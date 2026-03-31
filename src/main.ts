import './style.css'
import { getSupabase } from './supabaseClient'

type Member = {
  id: string
  name: string
}

type ExpenseSplitType = 'equal' | 'custom'

type Expense = {
  id: string
  description: string
  amount: number
  paidBy: string
  splitType: ExpenseSplitType
  splits: Record<string, number>
  category: string
  createdAt: string
}

type Group = {
  id: string
  name: string
  description?: string
  members: Member[]
  expenses: Expense[]
}

type Balance = {
  memberId: string
  amount: number
}

type Settlement = {
  from: string
  to: string
  amount: number
}

type View = 'groups' | 'group-detail'
type Tab = 'expenses' | 'balances' | 'settle' | 'insights'

type Recommendation = {
  id: string
  type: 'split' | 'settlement' | 'budget' | 'member'
  title: string
  description: string
  action?: string
  priority: 'high' | 'medium' | 'low'
  groupId: string
}

const uid = () => Math.random().toString(36).slice(2, 9)

const STORAGE_KEY_BASE = 'smart-expense-splitter-v1'
const STORAGE_USER_KEY = 'smart-expense-splitter-user'

const smartCategorize = (description: string): string => {
  const text = description.toLowerCase()
  if (/(uber|taxi|bus|train|flight|fuel|petrol|diesel|cab|travel)/.test(text)) return 'Travel'
  if (/(hotel|airbnb|rent|room|stay|accommodation)/.test(text)) return 'Stay'
  if (/(lunch|dinner|breakfast|pizza|burger|food|restaurant|cafe|meal|coffee|snacks)/.test(text)) return 'Food'
  if (/(movie|party|club|ticket|museum|activity|entertainment|game)/.test(text)) return 'Entertainment'
  if (/(shopping|groceries|market|clothes|mall|store)/.test(text)) return 'Shopping'
  return 'Other'
}

const computeBalances = (group: Group): Balance[] => {
  const map = new Map<string, number>()
  group.members.forEach((m) => map.set(m.id, 0))

  for (const e of group.expenses) {
    map.set(e.paidBy, (map.get(e.paidBy) ?? 0) + e.amount)
    for (const [memberId, share] of Object.entries(e.splits)) {
      map.set(memberId, (map.get(memberId) ?? 0) - share)
    }
  }

  return Array.from(map.entries()).map(([memberId, amount]) => ({ memberId, amount }))
}

const simplifySettlements = (balances: Balance[]): Settlement[] => {
  const debtors: Balance[] = []
  const creditors: Balance[] = []

  balances.forEach((b) => {
    if (b.amount < -0.01) debtors.push({ ...b, amount: Math.abs(b.amount) })
    else if (b.amount > 0.01) creditors.push({ ...b })
  })

  debtors.sort((a, b) => b.amount - a.amount)
  creditors.sort((a, b) => b.amount - a.amount)

  const settlements: Settlement[] = []
  let i = 0
  let j = 0

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i]
    const creditor = creditors[j]
    const amount = Math.min(debtor.amount, creditor.amount)

    settlements.push({ from: debtor.memberId, to: creditor.memberId, amount })

    debtor.amount -= amount
    creditor.amount -= amount

    if (debtor.amount <= 0.01) i++
    if (creditor.amount <= 0.01) j++
  }

  return settlements
}

const currency = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value)

const totalExpenses = (group: Group) => group.expenses.reduce((sum, e) => sum + e.amount, 0)

const initialsForName = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

// AI Recommendation Engine
const generateRecommendations = (group: Group): Recommendation[] => {
  const recommendations: Recommendation[] = []
  
  if (group.expenses.length === 0) {
    recommendations.push({
      id: uid(),
      type: 'split',
      title: 'Start tracking expenses',
      description: 'No expenses yet. Add the first expense to start tracking group spending and get smart recommendations.',
      priority: 'medium',
      groupId: group.id,
    })
    return recommendations
  }

  // Analyze spending patterns and provide recommendations
  const totalSpent = totalExpenses(group)
  const avgExpense = totalSpent / group.expenses.length
  const membersSet = new Set(group.expenses.map((e) => e.paidBy))

  // Recommendation: High spender alert
  const spenderCounts: Record<string, number> = {}
  group.expenses.forEach((e) => {
    spenderCounts[e.paidBy] = (spenderCounts[e.paidBy] || 0) + e.amount
  })
  
  const topSpender = Object.entries(spenderCounts).sort(([, a], [, b]) => b - a)[0]
  if (topSpender && topSpender[1] > totalSpent * 0.4) {
    const spenderName = group.members.find((m) => m.id === topSpender[0])?.name || 'Someone'
    recommendations.push({
      id: uid(),
      type: 'settlement',
      title: `${spenderName} is covering most expenses`,
      description: `${spenderName} has paid ${currency(topSpender[1])} (${((topSpender[1] / totalSpent) * 100).toFixed(0)}% of total). Consider settling soon.`,
      priority: 'high',
      groupId: group.id,
    })
  }

  // Recommendation: Expense categorization
  const categories: Record<string, number> = {}
  group.expenses.forEach((e) => {
    categories[e.category] = (categories[e.category] || 0) + 1
  })
  
  const topCategory = Object.entries(categories).sort(([, a], [, b]) => b - a)[0]
  if (topCategory && topCategory[1] > group.expenses.length * 0.3) {
    recommendations.push({
      id: uid(),
      type: 'budget',
      title: `High ${topCategory[0]} spending`,
      description: `${((topCategory[1] / group.expenses.length) * 100).toFixed(0)}% of expenses are for ${topCategory[0]}. Consider budgeting this category.`,
      priority: 'medium',
      groupId: group.id,
    })
  }

  // Recommendation: Add missing members
  if (membersSet.size < group.members.length) {
    const inactiveMembers = group.members.filter((m) => !membersSet.has(m.id))
    recommendations.push({
      id: uid(),
      type: 'member',
      title: `${inactiveMembers.length} inactive member(s)`,
      description: `${inactiveMembers.map((m) => m.name).join(', ')} haven't spent anything yet. Encourage them to add expenses.`,
      priority: 'low',
      groupId: group.id,
    })
  }

  return recommendations
}

const App = () => {
  const root = document.querySelector<HTMLDivElement>('#app')
  if (!root) return

  let view: View = 'groups'
  let activeTab: Tab = 'expenses'
  let selectedGroupId: string | null = null
  let showCreateGroupModal = false
  let showSignin = false
  let showOtpModal = false
  let showSigninChoice = false
  let otpPhone = ''
  let lastSentOtp: { phone: string; code: string; expires: number } | null = null
  let currentSplitType: ExpenseSplitType = 'equal'
  let quoteRotatorStarted = false
  let signinMethod: 'phone' | 'email' | null = null

  const getDateTime = () => {
    const now = new Date()
    const date = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    return `${date} • ${time}`
  }
  let currentUserEmail: string | null =
    typeof window === 'undefined'
      ? null
      : window.localStorage.getItem(STORAGE_USER_KEY)?.toLowerCase() ?? null

  const defaultGroups = (): Group[] => [
    {
      id: uid(),
      name: 'Flat 4B',
      description: 'Shared apartment expenses',
      members: [
        { id: uid(), name: 'Aditya' },
        { id: uid(), name: 'Kavya' },
        { id: uid(), name: 'Rohan' },
      ],
      expenses: [],
    },
    {
      id: uid(),
      name: 'Goa Trip 2026',
      description: 'Beach vacation with the gang',
      members: [
        { id: uid(), name: 'Rahul' },
        { id: uid(), name: 'Priya' },
        { id: uid(), name: 'Arjun' },
        { id: uid(), name: 'Sneha' },
      ],
      expenses: [],
    },
  ]

  const storageKeyForEmail = (email: string | null) => {
    if (!email) return `${STORAGE_KEY_BASE}-groups-anonymous`
    return `${STORAGE_KEY_BASE}-groups-${email.trim().toLowerCase()}`
  }

  const loadState = (email: string | null): Group[] => {
    if (typeof window === 'undefined') return defaultGroups()
    try {
      const raw = window.localStorage.getItem(storageKeyForEmail(email))
      if (!raw) return defaultGroups()
      const parsed = JSON.parse(raw) as { groups?: Group[] }
      if (!parsed.groups || !Array.isArray(parsed.groups) || parsed.groups.length === 0) return defaultGroups()
      return parsed.groups
    } catch {
      return defaultGroups()
    }
  }

  let groups: Group[] = loadState(currentUserEmail)

  const saveState = () => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(
        storageKeyForEmail(currentUserEmail),
        JSON.stringify({
          groups,
        }),
      )
    } catch {
      // ignore storage errors
    }
  }

  const cloudEnabled = () => !!getSupabase() && !!currentUserEmail

  const syncToCloud = async () => {
    const supabase = getSupabase()
    if (!supabase || !currentUserEmail) return
    await supabase.from('expense_groups').upsert(
      {
        email: currentUserEmail,
        data: { groups },
      },
      { onConflict: 'email' },
    )
  }

  const loadFromCloud = async () => {
    const supabase = getSupabase()
    if (!supabase || !currentUserEmail) return
    const { data } = await supabase.from('expense_groups').select('data').eq('email', currentUserEmail).maybeSingle()
    if (data?.data?.groups) {
      groups = data.data.groups as Group[]
      saveState()
      render()
    }
  }

  const currentGroup = () => groups.find((g) => g.id === selectedGroupId) ?? groups[0]

  const render = () => {
    if (view === 'groups') {
      root.innerHTML = renderGroupsView()
    } else {
      const group = currentGroup()
      root.innerHTML = renderGroupDetail(group)
    }

    bindEvents()
  }

  const renderGroupsView = () => {
    return `
      <div class="app-shell">
        <div class="antigravity">
          <div class="orb" style="left:5%; top:10%; width:80px; height:80px; background: linear-gradient(135deg,#ffd6a5,#ffafcc);"></div>
          <div class="orb" style="left:70%; top:5%; width:60px; height:60px; background: linear-gradient(135deg,#cfe8ff,#bde4c7);"></div>
          <div class="orb" style="left:40%; top:35%; width:44px; height:44px; background: linear-gradient(135deg,#f3e8ff,#c7d2fe);"></div>
        </div>
        <section class="admin-hero">
          <div>
            <h1 class="admin-greet">Yo! 👋 Admin</h1>
            <div class="quote" id="rotating-quote">"Split smart, live easy."</div>
            <div class="datetime-display" id="datetime"></div>
          </div>
        </section>
        <header class="top-bar">
          <div class="brand">
            <div class="brand-icon">≋</div>
            <span class="brand-name">SplitSmart</span>
          </div>
          <div class="auth-area">
            ${
              currentUserEmail
                ? `<span class="auth-email">${currentUserEmail}</span>
                   <button class="btn ghost" id="cloud-sync"${cloudEnabled() ? '' : ' disabled'}>Sync cloud</button>
                   <button class="btn ghost" id="sign-out">Sign out</button>`
                : `<button class="btn ghost" id="open-signin">Sign in</button>`
            }
            <button class="btn primary" id="open-create-group">+ Create Group</button>
          </div>
        </header>

        <main class="page">
          <section class="page-header">
            <h1>Your Groups</h1>
            <p>Keep track of shared expenses with friends and family.</p>
          </section>

          <section class="group-grid">
            ${groups
              .map(
                (g) => `
              <article class="group-card" data-group-id="${g.id}">
                <header>
                  <div class="avatar soft">
                    <span>👥</span>
                  </div>
                  <div>
                    <h2>${g.name}</h2>
                    <p class="muted">${g.description ?? 'Shared expenses'}</p>
                  </div>
                </header>
                <div class="group-total">
                  <span class="label">Total expenses</span>
                  <span class="amount">${currency(totalExpenses(g))}</span>
                </div>
                <footer>
                  <div class="member-chips">
                    ${g.members
                      .slice(0, 3)
                      .map(
                        (m) => `
                      <span class="avatar tiny">${initialsForName(m.name)}</span>
                    `,
                      )
                      .join('')}
                    ${
                      g.members.length > 3
                        ? `<span class="avatar tiny more">+${g.members.length - 3}</span>`
                        : ''
                    }
                  </div>
                  <span class="muted">${g.members.length} members</span>
                </footer>
              </article>
            `,
              )
              .join('')}
          </section>
        </main>

        ${showCreateGroupModal ? renderCreateGroupModal() : ''}
        ${showSigninChoice ? renderSigninChoice() : ''}
        ${showSignin ? renderSigninModal() : ''}
        ${showOtpModal ? renderOtpModal() : ''}
      </div>
    `
  }

  const renderOtpModal = () => `
    <div class="overlay">
      <div class="modal otp-modal">
        <header class="modal-header">
          <h2>Phone OTP</h2>
          <button class="icon-button" id="close-otp">×</button>
        </header>
        <div class="modal-body">
          <label class="field">
            <span>Phone number</span>
            <input id="otp-phone" placeholder="+91XXXXXXXXXX" />
          </label>
          <div class="field">
            <button class="btn primary" id="send-otp">Send OTP</button>
            <div id="otp-status" class="muted small"></div>
          </div>
          <label class="field">
            <span>Enter OTP</span>
            <input id="otp-code" placeholder="123456" />
          </label>
          <div class="field">
            <button class="btn primary" id="verify-otp">Verify OTP</button>
          </div>
        </div>
      </div>
    </div>
  `

  const sendOtp = (phone: string) => {
    const code = (Math.floor(100000 + Math.random() * 900000)).toString()
    const expires = Date.now() + 5 * 60 * 1000 // 5 minutes
    lastSentOtp = { phone, code, expires }
    try {
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem('mock-otp', JSON.stringify(lastSentOtp))
      }
    } catch {}
    const status = root.querySelector<HTMLDivElement>('#otp-status')
    if (status) status.textContent = `OTP sent to ${phone} — code: ${code} (mock)`
    // keep OTP visible in console for developer
    // eslint-disable-next-line no-console
    console.info('Mock OTP sent', lastSentOtp)
  }

  const verifyOtp = (phone: string, code: string) => {
    let stored: typeof lastSentOtp | null = lastSentOtp
    try {
      if (typeof window !== 'undefined') {
        const raw = window.sessionStorage.getItem('mock-otp')
        if (raw) stored = JSON.parse(raw)
      }
    } catch {
      stored = lastSentOtp
    }
    if (!stored || stored.phone !== phone) return false
    if (Date.now() > stored.expires) return false
    return stored.code === code
  }

  const renderCreateGroupModal = () => `
    <div class="overlay">
      <div class="modal">
        <header class="modal-header">
          <h2>Start a new group</h2>
          <button class="icon-button" id="close-create-group">×</button>
        </header>
        <div class="modal-body">
          <label class="field">
            <span>Group name</span>
            <input id="new-group-name" placeholder="e.g. Miami Trip 2026" />
          </label>
          <label class="field">
            <span>Description (optional)</span>
            <textarea id="new-group-description" rows="3" placeholder="What is this group for?"></textarea>
          </label>
        </div>
        <footer class="modal-footer">
          <button class="btn ghost" id="cancel-create-group">Cancel</button>
          <button class="btn primary" id="create-group">Create Group</button>
        </footer>
      </div>
    </div>
  `

  const renderSigninChoice = () => `
    <div class="overlay">
      <div class="modal signin-choice-modal">
        <header class="modal-header">
          <h2>Let's get you in! ✨</h2>
          <button class="icon-button" id="close-signin-choice">×</button>
        </header>
        <div class="modal-body">
          <p class="muted small" style="text-align:center; margin-bottom:16px;">Pick your vibe:</p>
          <button class="choice-btn" id="choice-email" style="margin-bottom:10px;">
            <span style="font-size:24px;">📧</span>
            <span>Email</span>
          </button>
          <button class="choice-btn" id="choice-phone">
            <span style="font-size:24px;">📱</span>
            <span>Phone OTP</span>
          </button>
        </div>
      </div>
    </div>
  `

  const renderSigninModal = () => `
    <div class="overlay">
      <div class="modal">
        <header class="modal-header">
          <h2>${signinMethod === 'email' ? '📧 Email Sign In' : '📱 Phone OTP'}</h2>
          <button class="icon-button" id="close-signin">×</button>
        </header>
        <div class="modal-body">
          ${signinMethod === 'email' ? `
            <label class="field">
              <span>Your email</span>
              <input id="signin-email" type="email" placeholder="you@example.com" />
            </label>
          ` : `
            <label class="field">
              <span>Phone number</span>
              <input id="otp-phone" placeholder="+91XXXXXXXXXX" />
            </label>
            <div class="field">
              <button class="btn primary" id="send-otp-modal">Send OTP</button>
              <div id="otp-status" class="muted small"></div>
            </div>
            <label class="field">
              <span>Enter OTP</span>
              <input id="otp-code" placeholder="123456" />
            </label>
          `}
        </div>
        <footer class="modal-footer">
          <button class="btn ghost" id="cancel-signin">Cancel</button>
          <button class="btn primary" id="signin-btn">${signinMethod === 'email' ? 'Continue' : 'Verify'}</button>
        </footer>
      </div>
    </div>
  `


  const renderGroupDetail = (group: Group) => {
    const balances = computeBalances(group)
    const settlements = simplifySettlements(balances)

    return `
      <div class="app-shell">
        <header class="top-bar">
          <button class="link-button" id="back-to-groups">← Back to Groups</button>
          <div class="auth-area">
            ${
              currentUserEmail
                ? `<span class="auth-email">${currentUserEmail}</span><button class="btn ghost" id="sign-out">Sign out</button>`
                : `<button class="btn ghost" id="open-signin">Sign in</button>`
            }
          </div>
        </header>

        <main class="page soft">
          <section class="group-hero">
            <div class="hero-main">
              <div class="avatar large soft">
                <span>👥</span>
              </div>
              <div>
                <h1>${group.name}</h1>
                <p class="muted">${group.description ?? 'Shared expenses with your people.'}</p>
                <div class="member-row">
                  ${group.members
                    .map(
                      (m) => `
                    <span class="avatar tiny">${initialsForName(m.name)}</span>
                  `,
                    )
                    .join('')}
                  <span class="muted">${group.members.length} members</span>
                </div>
              </div>
            </div>
            <div class="hero-actions">
              <button class="btn ghost" id="add-member">Add Member</button>
              <button class="btn primary" id="scroll-to-add-expense">+ Add Expense</button>
            </div>
          </section>

          <nav class="tab-strip">
            ${renderTab('expenses', 'Expenses')}
            ${renderTab('balances', 'Balances')}
            ${renderTab('settle', 'Settle Up')}
            ${renderTab('insights', 'Insights')}
          </nav>

          <section class="tab-content">
            ${activeTab === 'expenses' ? renderExpensesTab(group) : ''}
            ${activeTab === 'balances' ? renderBalancesTab(group, balances) : ''}
            ${activeTab === 'settle' ? renderSettleTab(group, settlements) : ''}
            ${activeTab === 'insights' ? renderInsightsTab(group) : ''}
          </section>
        </main>
      </div>
    `
  }

  const renderTab = (tab: Tab, label: string) =>
    `<button class="tab ${activeTab === tab ? 'active' : ''}" data-tab="${tab}">${label}</button>`

  const renderExpensesTab = (group: Group) => `
    <div class="tab-layout">
      <section class="card">
        <h2>Add expense</h2>
        <div class="field">
          <span>Description</span>
          <input id="expense-desc" placeholder="e.g. Hotel booking at Palolem Beach" />
        </div>
        <div class="field inline">
          <label>
            <span>Amount</span>
            <input id="expense-amount" type="number" min="0" step="0.01" />
          </label>
          <label>
            <span>Paid by</span>
            <select id="expense-paid-by">
              ${group.members.map((m) => `<option value="${m.id}">${m.name}</option>`).join('')}
            </select>
          </label>
        </div>
        <div class="field">
          <span>Split type</span>
          <div class="segmented" id="split-type">
            <button data-type="equal" class="${currentSplitType === 'equal' ? 'active' : ''}">Equally</button>
            <button data-type="custom" class="${currentSplitType === 'custom' ? 'active' : ''}">Custom</button>
          </div>
        </div>
        <div class="field" id="custom-splits" style="display: ${currentSplitType === 'custom' ? 'block' : 'none'}">
          ${group.members
            .map(
              (m) => `
              <label class="inline">
                <span>${m.name}</span>
                <input data-custom-share="${m.id}" type="number" min="0" step="0.01" />
              </label>
            `,
            )
            .join('')}
        </div>
        <button id="add-expense-btn" class="btn primary">Add Expense</button>
      </section>

      <section class="card">
        <h2>Expenses</h2>
        ${
          group.expenses.length === 0
            ? '<p class="muted">No expenses yet. Add your first one on the left.</p>'
            : `
          <ul class="expense-list">
            ${group.expenses
              .map((e) => {
                const payer = group.members.find((m) => m.id === e.paidBy)?.name ?? 'Someone'
                return `
                  <li>
                    <div>
                      <strong>${e.description}</strong>
                      <p class="muted small">${payer} paid ${currency(e.amount)}</p>
                      <div class="pill-row">
                        <span class="pill">${e.category}</span>
                        <span class="pill">${e.splitType === 'equal' ? 'Split equally' : 'Custom split'}</span>
                      </div>
                    </div>
                    <div class="expense-meta">
                      <span class="date">${e.createdAt}</span>
                      <button class="icon-button" data-remove-expense="${e.id}">🗑</button>
                    </div>
                  </li>
                `
              })
              .join('')}
          </ul>
        `
        }
      </section>
    </div>
  `

  const renderBalancesTab = (group: Group, balances: Balance[]) => `
    <section class="card">
      <h2>Balances</h2>
      <div class="balances">
        ${balances
          .map((b) => {
            const member = group.members.find((m) => m.id === b.memberId)
            if (!member) return ''
            const cls = b.amount > 0 ? 'positive' : b.amount < 0 ? 'negative' : 'neutral'
            return `
              <div class="balance-row ${cls}">
                <div class="member">
                  <span class="avatar tiny">${initialsForName(member.name)}</span>
                  <span>${member.name}</span>
                </div>
                <span>${currency(b.amount)}</span>
              </div>
            `
          })
          .join('')}
      </div>
    </section>
  `

  const renderSettleTab = (group: Group, settlements: Settlement[]) => `
    <section class="card">
      <h2>Suggested Repayments</h2>
      ${
        settlements.length === 0
          ? '<p class="muted">Everything looks settled. Enjoy your time together.</p>'
          : `
        <ul class="settlements list">
          ${settlements
            .map((s) => {
              const from = group.members.find((m) => m.id === s.from)
              const to = group.members.find((m) => m.id === s.to)
              if (!from || !to) return ''
              return `
                <li class="settle-row">
                  <div class="person">
                    <span class="avatar tiny soft">${initialsForName(from.name)}</span>
                    <div>
                      <div>${from.name}</div>
                      <div class="muted xs">owes</div>
                    </div>
                  </div>
                  <div class="amount">${currency(s.amount)}</div>
                  <div class="person">
                    <div class="muted xs">gets</div>
                    <span class="avatar tiny soft">${initialsForName(to.name)}</span>
                    <div>${to.name}</div>
                  </div>
                  <button class="btn small">Record Payment</button>
                </li>
              `
            })
            .join('')}
        </ul>
      `
      }
    </section>
  `

  const renderInsightsTab = (group: Group) => {
    if (group.expenses.length === 0) {
      return `
        <section class="card">
          <h2>Insights</h2>
          <p class="muted">Add a few expenses to unlock smart insights.</p>
        </section>
      `
    }

    const byCategory = new Map<string, number>()
    let total = 0
    for (const e of group.expenses) {
      total += e.amount
      byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount)
    }
    const sorted = Array.from(byCategory.entries()).sort((a, b) => b[1] - a[1])
    const top = sorted[0]

    const recommendations = generateRecommendations(group)

    return `
      <section class="card">
        <h2>Spending insights</h2>
        <ul class="insights">
          <li>Total spent: <strong>${currency(total)}</strong></li>
          ${
            top
              ? `<li>Biggest category: <strong>${top[0]}</strong> (${currency(top[1])})</li>`
              : ''
          }
        </ul>
      </section>

      ${
        recommendations.length > 0
          ? `
      <section class="card">
        <h2>🤖 AI Recommendations</h2>
        <div class="recommendations-list">
          ${recommendations
            .map(
              (rec) => `
            <div class="recommendation-item priority-${rec.priority}">
              <div class="rec-header">
                <h3>${rec.title}</h3>
                <span class="priority-badge">${rec.priority}</span>
              </div>
              <p class="rec-desc">${rec.description}</p>
              ${rec.action ? `<button class="btn ghost small" id="rec-action-${rec.id}">${rec.action}</button>` : ''}
            </div>
          `,
            )
            .join('')}
        </div>
      </section>
      `
          : ''
      }
    `
  }

  const bindEvents = () => {
    const groupsEl = root.querySelectorAll<HTMLElement>('.group-card')
    groupsEl.forEach((card) => {
      card.addEventListener('click', () => {
        const id = card.getAttribute('data-group-id')
        if (!id) return
        selectedGroupId = id
        view = 'group-detail'
        activeTab = 'expenses'
        render()
      })
    })

    const openCreateBtn = root.querySelector<HTMLButtonElement>('#open-create-group')
    if (openCreateBtn) {
      openCreateBtn.addEventListener('click', () => {
        showCreateGroupModal = true
        render()
      })
    }

    const openSigninBtn = root.querySelector<HTMLButtonElement>('#open-signin')
    openSigninBtn?.addEventListener('click', () => {
      showSigninChoice = true
      signinMethod = null
      render()
    })

    const cloudSyncBtn = root.querySelector<HTMLButtonElement>('#cloud-sync')
    cloudSyncBtn?.addEventListener('click', () => {
      syncToCloud()
    })

    const signOutBtn = root.querySelector<HTMLButtonElement>('#sign-out')
    signOutBtn?.addEventListener('click', () => {
      currentUserEmail = null
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(STORAGE_USER_KEY)
      }
      groups = loadState(null)
      render()
    })

    const closeCreate = root.querySelector<HTMLButtonElement>('#close-create-group')
    const cancelCreate = root.querySelector<HTMLButtonElement>('#cancel-create-group')
    const createBtn = root.querySelector<HTMLButtonElement>('#create-group')

    const closeModal = () => {
      showCreateGroupModal = false
      render()
    }

    closeCreate?.addEventListener('click', closeModal)
    cancelCreate?.addEventListener('click', closeModal)

    createBtn?.addEventListener('click', () => {
      const nameInput = root.querySelector<HTMLInputElement>('#new-group-name')
      const descInput = root.querySelector<HTMLTextAreaElement>('#new-group-description')
      const name = nameInput?.value.trim()
      if (!name) return

      const group: Group = {
        id: uid(),
        name,
        description: descInput?.value.trim() || undefined,
        members: [],
        expenses: [],
      }
      groups.push(group)
      saveState()
      selectedGroupId = group.id
      view = 'group-detail'
      showCreateGroupModal = false
      render()
    })

    const closeSigninChoice = root.querySelector<HTMLButtonElement>('#close-signin-choice')
    closeSigninChoice?.addEventListener('click', () => {
      showSigninChoice = false
      render()
    })

    const choiceEmail = root.querySelector<HTMLButtonElement>('#choice-email')
    choiceEmail?.addEventListener('click', () => {
      signinMethod = 'email'
      showSigninChoice = false
      showSignin = true
      render()
    })

    const choicePhone = root.querySelector<HTMLButtonElement>('#choice-phone')
    choicePhone?.addEventListener('click', () => {
      signinMethod = 'phone'
      showSigninChoice = false
      showSignin = true
      render()
    })

    const sendOtpModalBtn = root.querySelector<HTMLButtonElement>('#send-otp-modal')
    sendOtpModalBtn?.addEventListener('click', () => {
      const phoneInput = root.querySelector<HTMLInputElement>('#otp-phone')
      const phone = phoneInput?.value.trim()
      if (!phone) return
      sendOtp(phone)
    })

    const closeSignin = root.querySelector<HTMLButtonElement>('#close-signin')
    const cancelSignin = root.querySelector<HTMLButtonElement>('#cancel-signin')
    const signinBtn = root.querySelector<HTMLButtonElement>('#signin-btn')

    const closeSigninModal = () => {
      showSignin = false
      render()
    }

    closeSignin?.addEventListener('click', closeSigninModal)
    cancelSignin?.addEventListener('click', closeSigninModal)

    signinBtn?.addEventListener('click', async () => {
      if (signinMethod === 'email') {
        const emailInput = root.querySelector<HTMLInputElement>('#signin-email')
        const email = emailInput?.value.trim()
        if (!email) return
        currentUserEmail = email.toLowerCase()
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(STORAGE_USER_KEY, currentUserEmail)
        }
        groups = loadState(currentUserEmail)
        showSignin = false
        await loadFromCloud()
        render()
      } else if (signinMethod === 'phone') {
        const phoneInput = root.querySelector<HTMLInputElement>('#otp-phone')
        const codeInput = root.querySelector<HTMLInputElement>('#otp-code')
        const phone = phoneInput?.value.trim() ?? ''
        const code = codeInput?.value.trim() ?? ''
        if (!phone || !code) return
        const ok = verifyOtp(phone, code)
        if (ok) {
          currentUserEmail = phone
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(STORAGE_USER_KEY, currentUserEmail)
          }
          groups = loadState(currentUserEmail)
          showSignin = false
          await loadFromCloud()
          render()
        } else {
          alert('OTP verification failed or expired')
        }
      }
    })

    const backToGroups = root.querySelector<HTMLButtonElement>('#back-to-groups')
    backToGroups?.addEventListener('click', () => {
      view = 'groups'
      render()
    })

    const tabButtons = root.querySelectorAll<HTMLButtonElement>('.tab')
    tabButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab') as Tab | null
        if (!tab) return
        activeTab = tab
        render()
      })
    })

    const addMemberBtn = root.querySelector<HTMLButtonElement>('#add-member')
    addMemberBtn?.addEventListener('click', () => {
      const name = prompt('Member name')
      if (!name) return
      const group = currentGroup()
      group.members.push({ id: uid(), name: name.trim() })
      saveState()
      render()
    })

    const scrollToAddExpense = root.querySelector<HTMLButtonElement>('#scroll-to-add-expense')
    scrollToAddExpense?.addEventListener('click', () => {
      const formCard = root.querySelector<HTMLElement>('.tab-layout .card')
      formCard?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })

    const openOtpBtn = root.querySelector<HTMLButtonElement>('#open-otp')
    openOtpBtn?.addEventListener('click', () => {
      showOtpModal = true
      render()
    })

    const closeOtpBtn = root.querySelector<HTMLButtonElement>('#close-otp')
    closeOtpBtn?.addEventListener('click', () => {
      showOtpModal = false
      render()
    })

    const sendOtpBtn = root.querySelector<HTMLButtonElement>('#send-otp')
    sendOtpBtn?.addEventListener('click', () => {
      const phoneInput = root.querySelector<HTMLInputElement>('#otp-phone')
      const phone = phoneInput?.value.trim()
      if (!phone) return
      sendOtp(phone)
    })

    const verifyOtpBtn = root.querySelector<HTMLButtonElement>('#verify-otp')
    verifyOtpBtn?.addEventListener('click', async () => {
      const phoneInput = root.querySelector<HTMLInputElement>('#otp-phone')
      const codeInput = root.querySelector<HTMLInputElement>('#otp-code')
      const phone = phoneInput?.value.trim() ?? ''
      const code = codeInput?.value.trim() ?? ''
      if (!phone || !code) return
      const ok = verifyOtp(phone, code)
      if (ok) {
        // Treat phone as the user's identifier for local state
        currentUserEmail = phone
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(STORAGE_USER_KEY, currentUserEmail)
        }
        groups = loadState(currentUserEmail)
        showOtpModal = false
        await loadFromCloud()
        render()
      } else {
        alert('OTP verification failed or expired')
      }
    })

    // Start rotating quotes and datetime
    if (!quoteRotatorStarted) {
      quoteRotatorStarted = true
      const quotes = [
        'Split smart, live easy.',
        'Share costs, not drama.',
        'Friends who split together, stay together.',
        'No cap, splitting is caring.',
        'It\'s giving shared expenses vibes.',
      ]
      let qi = 0
      setInterval(() => {
        const el = document.querySelector<HTMLDivElement>('#rotating-quote')
        if (!el) return
        qi = (qi + 1) % quotes.length
        el.textContent = `"${quotes[qi]}"`
      }, 3500)

      // Update datetime every second
      setInterval(() => {
        const dtEl = document.querySelector<HTMLDivElement>('#datetime')
        if (!dtEl) return
        dtEl.textContent = getDateTime()
      }, 1000)

      const dtEl = document.querySelector<HTMLDivElement>('#datetime')
      if (dtEl) dtEl.textContent = getDateTime()
    }

    const splitButtons = root.querySelectorAll<HTMLButtonElement>('#split-type button')
    const customSplitsEl = root.querySelector<HTMLDivElement>('#custom-splits')

    splitButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const type = btn.getAttribute('data-type') as ExpenseSplitType | null
        if (!type) return
        currentSplitType = type
        render()
      })
    })

    const addExpenseBtn = root.querySelector<HTMLButtonElement>('#add-expense-btn')
    addExpenseBtn?.addEventListener('click', () => {
      const group = currentGroup()
      const descInput = root.querySelector<HTMLInputElement>('#expense-desc')
      const amountInput = root.querySelector<HTMLInputElement>('#expense-amount')
      const paidBySelect = root.querySelector<HTMLSelectElement>('#expense-paid-by')
      if (!descInput || !amountInput || !paidBySelect) return

      const description = descInput.value.trim()
      const amount = parseFloat(amountInput.value)
      const paidBy = paidBySelect.value
      if (!description || !amount || isNaN(amount)) return

      let splits: Record<string, number> = {}
      if (currentSplitType === 'equal') {
        const share = amount / group.members.length
        group.members.forEach((m) => {
          splits[m.id] = parseFloat(share.toFixed(2))
        })
      } else {
        let totalCustom = 0
        root.querySelectorAll<HTMLInputElement>('[data-custom-share]').forEach((input) => {
          const id = input.getAttribute('data-custom-share')
          if (!id) return
          const v = parseFloat(input.value)
          if (!isNaN(v) && v > 0) {
            splits[id] = v
            totalCustom += v
          }
        })
        if (Math.abs(totalCustom - amount) > 0.05) {
          alert('Custom shares must sum to the total amount.')
          return
        }
      }

      const category = smartCategorize(description)
      const today = new Date()
      const createdAt = `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`

      group.expenses.push({
        id: uid(),
        description,
        amount,
        paidBy,
        splitType: currentSplitType,
        splits,
        category,
        createdAt,
      })

      descInput.value = ''
      amountInput.value = ''
      if (customSplitsEl) {
        customSplitsEl.querySelectorAll<HTMLInputElement>('input').forEach((i) => (i.value = ''))
      }
      saveState()
      render()
    })

    root.querySelectorAll<HTMLButtonElement>('[data-remove-expense]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const group = currentGroup()
        const id = btn.getAttribute('data-remove-expense')
        if (!id) return
        group.expenses = group.expenses.filter((e) => e.id !== id)
        saveState()
        render()
      })
    })
  }

  render()
}

App()
