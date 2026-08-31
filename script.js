/*
═════════════════════════════════════════════════════════
══════════
ARCTIX — script.js v5
─────────────────────────────────────────────────────────
──────────
INDEX
─────
01 DOM Shortcut
02 UI References
03 UI Validation
04 Storage Helpers
05 App State
05a Core state
05b Memory helpers
05c Name helpers & validation
06 Sound Engine
07 Theme Engine
08 Side Panel Controller
08a Open / close
08b Conversation management
08c Panel renderer
09 Screen & UI Helpers
09a Screen transitions
09b Scroll utilities
09c Input enable / disable
09d Name input flash
10 Snowflake Animation
11 Message Handling
11a add()
11b stream()
12 Math Engine
12a BigInt utilities
12b LCM solver
12c HCF / GCD solver
12d Multiplication table
12e Square root
12f Square
12g Expression normaliser ← BUG FIXED: * handling
12h Expression validator ← BUG FIXED
12i Recursive descent parser ← BUG FIXED
12j Combined entry points
13 Unit Converter
13a Rule factory
13b Rule table
13c tryConvert()
14 Input Normaliser
14a Replacement dictionary
14b normalise()
15 Intent Patterns (28 intents · 50+ regex each)
16 Response Bank (28 intents · 35+ natural responses each)
16a Emoji system
16b Response arrays
16c Smart picker & follow-ups
16d Date / time helpers
17 Intent Scoring
18 Response Generator
18a Name memory queries
18b Time / date routing
18c Unit & math routing
18d Intent routing + fallback
19 Greeting Handler
20 Send Handler
21 Event Listeners
22 Initialisation
═════════════════════════════════════════════════════════
══════════ */
/* ── 01 DOM SHORTCUT
─────────────────────────────────────────────── */
const $ = (id) => document.getElementById(id);
/* ── 02 UI REFERENCES
────────────────────────────────────────────── */
const UI = {
/* screens */
startScreen: $("startScreen"),
nameScreen: $("nameScreen"),
chatScreen: $("chatScreen"),
/* start / name */
startBtn: $("startBtn"),
continueBtn: $("continueBtn"),
nameInput: $("nameInput"),
snowStart: $("snowStart"),
snowName: $("snowName"),
/* top bar */
clearBtn: $("clearBtn"),
newChatBtn: $("newChatBtn") /* ✎ replaces settings gear */,
sideBtn: $("sideBtn") /* ☰ hamburger */,
/* side panel */
sidePanel: $("sidePanel"),
sideBackdrop: $("sideBackdrop"),
sideClose: $("sideClose"),
convList: $("convList"),
sideUserName: $("sideUserName"),
sideUserInitial: $("sideUserInitial"),
/* settings — live inside side panel */
themeBtn: $("themeBtn"),
soundBtn: $("soundBtn"),
/* chat */
chat: $("chat"),
userInput: $("userInput"),
sendBtn: $("sendBtn")
};
/* ── 03 UI VALIDATION
────────────────────────────────────────────── */
(function validateUI() {
const missing = Object.keys(UI).filter((k) => !UI[k]);
if (missing.length) console.warn("[Arctix] Missing DOM elements:", missing);
})();
/* ── 04 STORAGE HELPERS
──────────────────────────────────────────── */
const KEYS = {
memory: "arctix_memory",
name: "arctix_name",
theme: "arctix_theme",
sound: "arctix_sound",
convs: "arctix_convs"
};
const safeGet = (k) => {
try {
return localStorage.getItem(k);
} catch {
return null;
}
};
const safeSet = (k, v) => {
try {
localStorage.setItem(k, v);
} catch (e) {
console.warn("[Arctix] Store write:", e);
}
};
const safeRemove = (k) => {
try {
localStorage.removeItem(k);
} catch (e) {
console.warn("[Arctix] Store remove:", e);
}
};
const safeParseArray = (raw) => {
try {
const p = JSON.parse(raw || "[]");
return Array.isArray(p) ? p : [];
} catch {
return [];
}
};
/* ── 05 APP STATE
────────────────────────────────────────────────── */
/* 05a · Core state */
const App = {
busy: false,
streamId: 0,
screenTimer: null,
memory: safeParseArray(safeGet(KEYS.memory)).slice(-30),
userName: (safeGet(KEYS.name) || "").trim(),
greeted: false,
turnCount: 0,
darkMode: safeGet(KEYS.theme) === "dark",
soundOn: safeGet(KEYS.sound) !== "off",
convs: safeParseArray(safeGet(KEYS.convs)),
currentConvId: null
};
/* 05b · Memory helpers */
function saveMemory() {
App.memory = App.memory.slice(-30);
safeSet(KEYS.memory, JSON.stringify(App.memory));
}
function clearMemory() {
App.memory = [];
App.turnCount = 0;
safeRemove(KEYS.memory);
}
/* 05c · Name helpers & validation */
function saveName(n) {
App.userName = String(n || "").trim();
safeSet(KEYS.name, App.userName);
}
function isValidName(name) {
const v = String(name || "").trim();
if (v.length < 2 || v.length > 32) return false;
if (!/\p{L}/u.test(v)) return false;
if (!/^[\p{L}' -]+$/u.test(v)) return false;
if (/^(.)\1{4,}$/u.test(v)) return false;
if (looksLikeConversation(normalise(v))) return false;
return true;
}
/* ── 06 SOUND ENGINE
─────────────────────────────────────────────── */
let _audioCtx = null,
_lastSound = 0;
function getAudioCtx() {
if (_audioCtx) return _audioCtx;
try {
_audioCtx = new (window.AudioContext || window.webkitAudioContext)();
} catch {
_audioCtx = null;
}
return _audioCtx;
}
async function playClick() {
if (!App.soundOn) return;
const now = performance.now();
if (now - _lastSound < 120) return;
_lastSound = now;
const ctx = getAudioCtx();
if (!ctx) return;
if (ctx.state === "suspended") {
try {
await ctx.resume();
} catch {
return;
}
}
try {
const t = ctx.currentTime;
const o1 = ctx.createOscillator(),
g1 = ctx.createGain(),
f1 = ctx.createBiquadFilter();
o1.type = "sine";
o1.frequency.setValueAtTime(260, t);
o1.frequency.exponentialRampToValueAtTime(175, t + 0.08);
f1.type = "lowpass";
f1.frequency.setValueAtTime(1100, t);
f1.Q.value = 0.7;
g1.gain.setValueAtTime(0.0001, t);
g1.gain.linearRampToValueAtTime(0.05, t + 0.008);
g1.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
o1.connect(f1);
f1.connect(g1);
g1.connect(ctx.destination);
o1.start(t);
o1.stop(t + 0.09);
const o2 = ctx.createOscillator(),
g2 = ctx.createGain();
o2.type = "triangle";
o2.frequency.setValueAtTime(520, t);
o2.frequency.exponentialRampToValueAtTime(340, t + 0.04);
g2.gain.setValueAtTime(0.0001, t);
g2.gain.linearRampToValueAtTime(0.014, t + 0.004);
g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.055);
o2.connect(g2);
g2.connect(ctx.destination);
o2.start(t);
o2.stop(t + 0.06);
} catch {
/* silent */
}
}
function syncSoundUI() {
UI.soundBtn?.setAttribute("aria-checked", App.soundOn ? "true" : "false");
}
function toggleSound() {
App.soundOn = !App.soundOn;
syncSoundUI();
safeSet(KEYS.sound, App.soundOn ? "on" : "off");
}
/* ── 07 THEME ENGINE
─────────────────────────────────────────────── */
function applyTheme(dark) {
document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
const meta = document.querySelector('meta[name="theme-color"]');
if (meta) meta.content = dark ? "#1a1614" : "#f5f0eb";
UI.themeBtn?.setAttribute("aria-checked", dark ? "true" : "false");
}
function toggleTheme() {
App.darkMode = !App.darkMode;
applyTheme(App.darkMode);
safeSet(KEYS.theme, App.darkMode ? "dark" : "light");
}
/* ── 08 SIDE PANEL CONTROLLER
────────────────────────────────────── */
/* 08a · Open / close */
let _sideOpen = false;
function openSidePanel() {
if (_sideOpen) return;
_sideOpen = true;
renderConvList();
UI.sidePanel.classList.remove("hidden", "closing");
UI.sideBackdrop.classList.remove("hidden");
UI.sideBtn?.setAttribute("aria-expanded", "true");
syncSideUser();
setTimeout(() => UI.sideClose?.focus(), 60);
}
function closeSidePanel() {
if (!_sideOpen) return;
UI.sidePanel.classList.add("closing");
UI.sideBtn?.setAttribute("aria-expanded", "false");
setTimeout(() => {
_sideOpen = false;
UI.sidePanel.classList.add("hidden");
UI.sidePanel.classList.remove("closing");
UI.sideBackdrop.classList.add("hidden");
UI.sideBtn?.focus();
}, 240);
}
/* 08b · Conversation management */
const MAX_CONVS = 20;
function genId() {
return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}
function convTitle(msgs) {
const first = msgs.find((m) => m.type === "user");
if (!first) return "New Chat";
const t = first.text.trim().replace(/\s+/g, " ").slice(0, 38);
return t.length < first.text.trim().length ? t + "…" : t;
}
function saveConvs() {
App.convs = App.convs.slice(-MAX_CONVS);
safeSet(KEYS.convs, JSON.stringify(App.convs));
}
function syncCurrentConv() {
if (!App.currentConvId) return;
const conv = App.convs.find((c) => c.id === App.currentConvId);
if (!conv) return;
conv.messages = [...App.memory];
conv.timestamp = Date.now();
conv.title = convTitle(conv.messages);
saveConvs();
}
function startNewChat() {
syncCurrentConv();
const id = genId();
App.currentConvId = id;
App.convs.push({
id,
title: "New Chat",
messages: [],
timestamp: Date.now()
});
saveConvs();
if (UI.chat) UI.chat.replaceChildren();
App.streamId++;
App.busy = false;
App.greeted = false;
clearMemory();
setSendEnabled(true);
closeSidePanel();
greetIfNeeded();
}
function loadConv(id) {
syncCurrentConv();
const conv = App.convs.find((c) => c.id === id);
if (!conv) return;
App.currentConvId = id;
App.memory = [...(conv.messages || [])];
App.greeted = App.memory.length > 0;
App.streamId++;
App.busy = false;
if (UI.chat) {
UI.chat.replaceChildren();
for (const m of App.memory) {
const b = document.createElement("div");
b.className = m.type === "user" ? "msg user" : "msg bot";
b.textContent = String(m.text || "");
UI.chat.appendChild(b);
}
scrollToBottom();
}
closeSidePanel();
setSendEnabled(true);
UI.userInput?.focus();
}
function deleteConv(id) {
App.convs = App.convs.filter((c) => c.id !== id);
saveConvs();
if (App.currentConvId === id) {
App.currentConvId = null;
if (App.convs.length) loadConv(App.convs[App.convs.length - 1].id);
else startNewChat();
} else {
renderConvList();
}
}
function syncSideUser() {
const name = App.userName || "User";
if (UI.sideUserName) UI.sideUserName.textContent = name;
if (UI.sideUserInitial)
UI.sideUserInitial.textContent = name.charAt(0).toUpperCase();
}
/* 08c · Panel renderer */
function renderConvList() {
if (!UI.convList) return;
UI.convList.innerHTML = "";
const sorted = [...App.convs].sort((a, b) => b.timestamp - a.timestamp);
if (!sorted.length) {
const el = document.createElement("div");
el.className = "conv-empty";
el.innerHTML =
'<span class="conv-empty__icon">💬</span>No conversations yet.<br>Start chatting!';
UI.convList.appendChild(el);
return;
}
const now = new Date();
const todayMs = new Date(now).setHours(0, 0, 0, 0);
const yestMs = todayMs - 864e5;
const weekMs = todayMs - 6 * 864e5;
const groups = { Today: [], Yesterday: [], "This Week": [], Older: [] };
for (const c of sorted) {
const ts = c.timestamp;
if (ts >= todayMs) groups["Today"].push(c);
else if (ts >= yestMs) groups["Yesterday"].push(c);
else if (ts >= weekMs) groups["This Week"].push(c);
else groups["Older"].push(c);
}
for (const [label, convs] of Object.entries(groups)) {
if (!convs.length) continue;
const gl = document.createElement("p");
gl.className = "conv-group";
gl.textContent = label;
UI.convList.appendChild(gl);
for (const c of convs) {
const item = document.createElement("div");
item.className =
"conv-item" + (c.id === App.currentConvId ? " active" : "");
item.setAttribute("role", "listitem");
item.setAttribute("tabindex", "0");
const txt = document.createElement("span");
txt.className = "conv-item__title";
txt.textContent = c.title || "New Chat";
const del = document.createElement("button");
del.className = "conv-item__del";
del.type = "button";
del.textContent = "✕";
del.setAttribute("aria-label", "Delete conversation");
del.addEventListener("click", (e) => {
e.stopPropagation();
deleteConv(c.id);
});
item.append(txt, del);
item.addEventListener("click", () => loadConv(c.id));
item.addEventListener("keydown", (e) => {
if (e.key === "Enter" || e.key === " ") {
e.preventDefault();
loadConv(c.id);
}
});
UI.convList.appendChild(item);
}
}
}
/* ── 09 SCREEN & UI HELPERS
──────────────────────────────────────── */
/* 09a · Screen transitions */
function show(screen, onShown) {
if (!screen) return;
const all = [UI.startScreen, UI.nameScreen, UI.chatScreen].filter(Boolean);
if (App.screenTimer) {
clearTimeout(App.screenTimer);
App.screenTimer = null;
}
all.forEach((s) => s.classList.remove("active"));
App.screenTimer = setTimeout(() => {
all.forEach((s) => {
if (s !== screen) s.classList.add("hidden");
});
screen.classList.remove("hidden");
requestAnimationFrame(() =>
requestAnimationFrame(() => {
screen.classList.add("active");
if (typeof onShown === "function") onShown();
})
);
}, 80);
}
/* 09b · Scroll utilities */
function isNearBottom() {
if (!UI.chat) return true;
return UI.chat.scrollHeight - UI.chat.scrollTop - UI.chat.clientHeight < 80;
}
function scrollToBottom() {
if (UI.chat) UI.chat.scrollTop = UI.chat.scrollHeight;
}
/* 09c · Input enable / disable */
function setSendEnabled(on) {
if (UI.sendBtn) UI.sendBtn.disabled = !on;
if (UI.userInput) UI.userInput.disabled = !on;
}
/* 09d · Name input flash */
function flashNameInput() {
if (!UI.nameInput) return;
UI.nameInput.style.borderColor = "#c0392b";
UI.nameInput.focus();
setTimeout(() => {
if (UI.nameInput && !UI.nameScreen.classList.contains("hidden"))
UI.nameInput.style.borderColor = "";
}, 800);
}
/* ── 10 SNOWFLAKE ANIMATION
──────────────────────────────────────── */
function startSnowSpin(el) {
if (!el || el.dataset.spinning === "1") return;
el.dataset.spinning = "1";
el.style.animation = "none";
el.style.opacity = "1";
el.style.transform = "translateY(0)";
void el.offsetWidth;
el.style.animation = "snow-spin 16s linear infinite";
}
function stopSnowSpin(el) {
if (!el) return;
delete el.dataset.spinning;
el.style.animation = "";
el.style.opacity = "";
el.style.transform = "";
}
/* ── 11 MESSAGE HANDLING
─────────────────────────────────────────── */
/* 11a · add() — create & append bubble */
function add(text, role, save = true) {
if (!UI.chat) return null;
const b = document.createElement("div");
b.className = role === "user" ? "msg user" : "msg bot";
b.textContent = String(text || "");
UI.chat.appendChild(b);
if (isNearBottom()) scrollToBottom();
if (role === "user" && save) {
App.memory.push({ type: "user", text: String(text || "") });
saveMemory();
}
return b;
}
/* 11b · stream() — character-by-character reveal */
async function stream(bubble, text) {
if (!bubble || typeof text !== "string") return false;
if (!text.length) {
bubble.textContent = "";
return true;
}
const id = App.streamId;
const chars = Array.from(text);
const delay = Math.max(8, Math.min(22, Math.floor(420 / chars.length)));
bubble.textContent = "";
for (let i = 0; i < chars.length; i++) {
if (App.streamId !== id) return false;
bubble.textContent += chars[i];
if (i % 3 === 0) playClick();
if (i % 4 === 0 && isNearBottom()) scrollToBottom();
await new Promise((r) => setTimeout(r, delay));
}
if (isNearBottom()) scrollToBottom();
return App.streamId === id;
}
/*
═════════════════════════════════════════════════════════
═════════
12 MATH ENGINE
═════════════════════════════════════════════════════════
═════════ */
/* 12a · BigInt utilities */
function gcd(a, b) {
a = a < 0n ? -a : a;
b = b < 0n ? -b : b;
while (b) [a, b] = [b, a % b];
return a;
}
function lcm(a, b) {
a = a < 0n ? -a : a;
b = b < 0n ? -b : b;
if (!a || !b) return 0n;
return (a / gcd(a, b)) * b;
}
function intTokens(text) {
const m = String(text ?? "").match(/[+-]?\d[\d,]*/g);
if (!m || m.length < 2) return null;
const t = [];
for (const x of m) {
const c = x.replace(/,/g, "").trim();
if (/^[+-]?\d+$/.test(c)) t.push(c);
}
return t.length >= 2 ? t : null;
}
function bigSafe(s) {
try {
return BigInt(s);
} catch {
return null;
}
}
function normMathText(r) {
return String(r ?? "")
.normalize("NFKC")
.replace(/[×✕✖]/g, "*")
.replace(/\s+/g, " ")
.trim();
}
/* 12b · LCM solver */
function tryLCM(raw) {
const t = normMathText(raw).toLowerCase();
if (!/\b(?:lcm|least\s+common\s+multiple)\b/i.test(t)) return null;
const toks = intTokens(t);
if (!toks) return null;
const nums = toks.map(bigSafe);
if (nums.some((n) => n === null)) return null;
return `LCM(${nums.map(String).join(", ")}) = ${nums
.reduce((a, n) => lcm(a, n))
.toString()}`;
}
/* 12c · HCF / GCD solver */
function tryHCF(raw) {
const t = normMathText(raw).toLowerCase();
if (
!/\b(?:hcf|gcd|highest\s+common\s+factor|greatest\s+common\s+divisor)\b/i.test(
t
)
)
return null;
const toks = intTokens(t);
if (!toks) return null;
const nums = toks.map(bigSafe);
if (nums.some((n) => n === null)) return null;
const label = /\bgcd\b|greatest\s+common\s+divisor/i.test(t) ? "GCD" : "HCF";
return `${label}(${nums.map(String).join(", ")}) = ${nums
.reduce((a, n) => gcd(a, n))
.toString()}`;
}
/* 12d · Multiplication table */
function tryTable(raw) {
const t = String(raw || "")
.replace(/[×✕✖]/g, "*")
.replace(/\s+/g, " ")
.trim();
const pats = [
/(?:multiplication\s+)?table\s+(?:of|for)?\s*([+-]?(?:\d{1,3}(?:,\d{3})+|\d+))(?!\s*[\d.])/i,
/([+-]?(?:\d{1,3}(?:,\d{3})+|\d+))\s*(?:times|\*)\s*table/i,
/^table\s+([+-]?(?:\d{1,3}(?:,\d{3})+|\d+))$/i,
/^([+-]?(?:\d{1,3}(?:,\d{3})+|\d+))\s+table$/i
];
let rawN = null;
for (const p of pats) {
const m = t.match(p);
if (m) {
rawN = m[1];
break;
}
}
if (!rawN) {
const m = t.match(/([+-]?(?:\d{1,3}(?:,\d{3})+|\d+))/);
if (m && /\btable\b/i.test(t)) rawN = m[1];
}
if (!rawN) return null;
const clean = rawN.replace(/,/g, "");
if (clean.includes(".")) return "I can only make tables for whole numbers.";
let n;
try {
n = BigInt(clean);
} catch {
return null;
}
if (clean.replace(/^[+-]/, "").length > 20)
return "That number's too big for a table.";
const rows = [];
for (let i = 1n; i <= 12n; i++) rows.push(`${n} × ${i} = ${n * i}`);
return `Multiplication table of ${n}:\n\n${rows.join("\n")}`;
}
/* 12e · Square root — BUG FIXED: escaped \. no optional group */
function trySqrt(raw) {
const t = normMathText(raw);
const m =
t.match(/(?:square\s+root\s+of|sqrt\s*(?:of\s*)?)\s*(-?\d+\.?\d*)/i) ||
t.match(/√\s*(-?\d+\.?\d*)/);
if (!m) return null;
const n = parseFloat(m[1]);
if (!Number.isFinite(n)) return null;
if (n < 0)
return `√${n} isn't a real number — can't take the root of a negative.`;
const r = Math.sqrt(n);
return `√${n} = ${Number.isInteger(r) ? r : parseFloat(r.toFixed(8))}`;
}
/* 12f · Square — BUG FIXED: escaped \. */
function trySq(raw) {
const t = normMathText(raw);
if (!t) return null;
const pats = [
/\b(?:sq|square)(?:\s+of)?\s+(-?\d+(?:\.\d+)?)\b/i,
/\b(-?\d+(?:\.\d+)?)\s*(?:sq|squared|\^2|²)\b/i,
/\bsquare\s+of\s+(-?\d+(?:\.\d+)?)\b/i,
/\b(-?\d+(?:\.\d+)?)\s+square(?:d)?\b/i
];
let val = null;
for (const p of pats) {
const m = t.match(p);
if (m) {
val = parseFloat(m[1]);
break;
}
}
if (!Number.isFinite(val)) return null;
const res = val * val;
return `${val}² = ${
Number.isInteger(res) ? res : parseFloat(res.toFixed(8))
}`;
}
/* 12f.1 · Hardened Odd / Even / Square Number Solver */
function tryNumberSequences(raw) {
if (raw == null) return null;
const original = String(raw).trim();
if (!original) return null;
/* ============================================================
NORMALIZATION
============================================================ */
const t = normMathText(original)
.toLowerCase()
.normalize("NFKC")
.replace(/[?!,]/g, " ")
.replace(/\s+/g, " ")
.trim();
if (!t) return null;
/* ============================================================
CONSTANTS / LIMITS
============================================================ */
const MAX_SEQUENCE_COUNT = 1000;
const MAX_RANGE_RESULTS = 10000;
const MAX_RANGE_SPAN = 1000000n;
/* ============================================================
NUMBER-WORD PARSER
============================================================ */
const smallUnits = {
zero: 0,
one: 1,
two: 2,
three: 3,
four: 4,
five: 5,
six: 6,
seven: 7,
eight: 8,
nine: 9,
ten: 10,
eleven: 11,
twelve: 12,
thirteen: 13,
fourteen: 14,
fifteen: 15,
sixteen: 16,
seventeen: 17,
eighteen: 18,
nineteen: 19
};
const tens = {
twenty: 20,
thirty: 30,
forty: 40,
fifty: 50,
sixty: 60,
seventy: 70,
eighty: 80,
ninety: 90
};
const scales = {
hundred: 100n,
thousand: 1000n,
million: 1000000n,
billion: 1000000000n,
trillion: 1000000000000n,
quadrillion: 1000000000000000n,
quintillion: 1000000000000000000n
};
function parseNumberWords(text) {
if (!text) return null;
const words = String(text)
.toLowerCase()
.replace(/-/g, " ")
.split(/\s+/)
.filter(Boolean);
if (!words.length) return null;
let sign = 1n;
let index = 0;
if (words[0] === "negative") {
sign = -1n;
index++;
} else if (words[0] === "positive") {
index++;
}
if (index >= words.length) return null;
let total = 0n;
let current = 0n;
let found = false;
for (; index < words.length; index++) {
const word = words[index];
if (word === "and") {
continue;
}
if (Object.prototype.hasOwnProperty.call(smallUnits, word)) {
current += BigInt(smallUnits[word]);
found = true;
continue;
}
if (Object.prototype.hasOwnProperty.call(tens, word)) {
current += BigInt(tens[word]);
found = true;
continue;
}
if (word === "hundred") {
if (!found) {
current = 1n;
}
current *= 100n;
found = true;
continue;
}
if (Object.prototype.hasOwnProperty.call(scales, word)) {
if (!found && current === 0n) {
current = 1n;
}
total += current * scales[word];
current = 0n;
found = true;
continue;
}
return null;
}
return found ? sign * (total + current) : null;
}
/* ============================================================
BIGINT PARSING
============================================================ */
function parseBigInt(value) {
if (value == null) return null;
let text = String(value).trim();
if (!text) return null;
text = text.replace(/,/g, "").replace(/^\+/, "");
if (/^-?\d+$/.test(text)) {
try {
return BigInt(text);
} catch {
return null;
}
}
return parseNumberWords(text);
}
/* ============================================================
FORMATTING
============================================================ */
function formatBigInt(value) {
if (typeof value !== "bigint") return String(value);
const negative = value < 0n;
const abs = negative ? -value : value;
const text = abs.toString();
const grouped = text.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
return negative ? `-${grouped}` : grouped;
}
function formatList(values) {
return values.map(formatBigInt).join(", ");
}
/* ============================================================
INTEGER PROPERTIES
============================================================ */
function isOdd(value) {
return (value < 0n ? -value : value) % 2n === 1n;
}
function isEven(value) {
return value % 2n === 0n;
}
/*
Exact perfect-square check for arbitrary BigInt values.
Uses integer square root instead of Number-based Math.sqrt.
*/
function integerSqrt(value) {
if (value < 0n) return null;
if (value < 2n) return value;
let x0 = 1n << BigInt(Math.ceil(value.toString(2).length / 2));
let x1 = (x0 + value / x0) >> 1n;
while (x1 < x0) {
x0 = x1;
x1 = (x0 + value / x0) >> 1n;
}
return x0;
}
function isSquare(value) {
if (value < 0n) return false;
const root = integerSqrt(value);
if (root === null) return false;
return root * root === value;
}
/* ============================================================
RANGE NORMALIZATION
============================================================ */
function normalizeRange(startValue, endValue) {
const start = parseBigInt(startValue);
const end = parseBigInt(endValue);
if (start === null || end === null) {
return null;
}
return start <= end ? { start, end } : { start: end, end: start };
}
/* ============================================================
TYPE DETECTION
============================================================ */
const hasOdd = /\bodd\b/.test(t);
const hasEven = /\beven\b/.test(t);
const hasSquare = /\b(?:square|squares|squared|perfect\s+squares?)\b/.test(t);
/*
Do not steal square-root requests.
*/
if (/\bsquare\s+root\b/.test(t) || /\bsqrt\b/.test(t) || /√/.test(original)) {
return null;
}
if (!hasOdd && !hasEven && !hasSquare) {
return null;
}
/* ============================================================
FIRST N ODD / EVEN / SQUARE NUMBERS
============================================================ */
const firstMatch = t.match(
/\bfirst\s+(.+?)\s+(odd|even|square|squares|perfect\s+squares?)\b/
);
if (firstMatch) {
const count = parseBigInt(firstMatch[1]);
const requestedType = firstMatch[2];
if (count === null) {
return null;
}
if (count < 1n) {
return "The number of items must be at least 1.";
}
if (count > BigInt(MAX_SEQUENCE_COUNT)) {
return `I can generate up to ${MAX_SEQUENCE_COUNT.toLocaleString()} numbers at
a time.`;
}
const amount = Number(count);
let type = requestedType;
if (type === "squares" || type === "perfect squares") {
type = "square";
}
const result = [];
if (type === "odd") {
for (let i = 0; i < amount; i++) {
result.push(BigInt(2 * i + 1));
}
} else if (type === "even") {
for (let i = 1; i <= amount; i++) {
result.push(BigInt(2 * i));
}
} else if (type === "square") {
for (let i = 1; i <= amount; i++) {
const n = BigInt(i);
result.push(n * n);
}
} else {
return null;
}
return `The first ${formatBigInt(count)} ${type} numbers are: ${formatList(
result
)}.`;
}
/* ============================================================
NTH ODD / EVEN / SQUARE NUMBER — HARDENED
============================================================ */
const ordinalMatch = t.match(
/\b(?:what\s+(?:is|are)|tell\s+me|find|give\s+me|calculate|work\s+out|determine)\s+(?:(?:the)\s+)?([a-z]+(?:-[a-z]+)?|\d+(?:st|nd|rd|th))\s+(odd|even|square|squares|perfect\s+squares?)\s*(?:number|numbers)?\b/i

);
if (ordinalMatch) {
const ordinalToken = ordinalMatch[1].toLowerCase();
const requestedType = ordinalMatch[2].toLowerCase();
/* ------------------------------------------------------------
ORDINAL WORDS
------------------------------------------------------------ */
const ordinalWords = {
first: 1n,
second: 2n,
third: 3n,
fourth: 4n,
fifth: 5n,
sixth: 6n,
seventh: 7n,
eighth: 8n,
ninth: 9n,
tenth: 10n,
eleventh: 11n,
twelfth: 12n,
thirteenth: 13n,
fourteenth: 14n,
fifteenth: 15n,
sixteenth: 16n,
seventeenth: 17n,
eighteenth: 18n,
nineteenth: 19n,
twentieth: 20n,
twentyfirst: 21n
};
/* ------------------------------------------------------------
PARSE ORDINAL
------------------------------------------------------------ */
let ordinal = null;
/* Word ordinal */
if (Object.prototype.hasOwnProperty.call(ordinalWords, ordinalToken)) {
ordinal = ordinalWords[ordinalToken];
}
/* Numeric ordinal */
if (ordinal === null) {
const numericOrdinal = ordinalToken.match(/^(\d+)(st|nd|rd|th)$/i);
if (numericOrdinal) {
const digits = numericOrdinal[1];
const suffix = numericOrdinal[2].toLowerCase();
let value;
try {
value = BigInt(digits);
} catch {
value = null;
}
if (value !== null && value > 0n) {
const lastTwo = value % 100n;
const lastOne = value % 10n;
let expectedSuffix = "th";
if (lastTwo < 11n || lastTwo > 13n) {
if (lastOne === 1n) expectedSuffix = "st";
else if (lastOne === 2n) expectedSuffix = "nd";
else if (lastOne === 3n) expectedSuffix = "rd";
}
if (suffix === expectedSuffix) {
ordinal = value;
}
}
}
}
/* ------------------------------------------------------------
INVALID ORDINAL GUARD
------------------------------------------------------------ */
if (ordinal === null) {
return null;
}
/*
Prevent absurdly large requests while retaining a generous
range for normal mathematical use.
BigInt itself can handle much larger values, but this keeps
the chatbot from attempting to generate pathological output
elsewhere in the pipeline.
*/
const MAX_NTH_INDEX = 1000000000000n;
if (ordinal > MAX_NTH_INDEX) {
return `I can calculate up to the ${formatBigInt(
MAX_NTH_INDEX
)}th item in a sequence.`;
}
/* ------------------------------------------------------------
NORMALIZE SEQUENCE TYPE
------------------------------------------------------------ */
let type = requestedType;
if (
type === "squares" ||
type === "perfect square" ||
type === "perfect squares"
) {
type = "square";
}
if (type !== "odd" && type !== "even" && type !== "square") {
return null;
}
/* ------------------------------------------------------------
EXACT SEQUENCE CALCULATION
Odd: 2n - 1
Even: 2n
Square: n²
------------------------------------------------------------ */
let result;
if (type === "odd") {
result = 2n * ordinal - 1n;
} else if (type === "even") {
result = 2n * ordinal;
} else {
result = ordinal * ordinal;
}
/* ------------------------------------------------------------
ORDINAL DISPLAY
------------------------------------------------------------ */
function ordinalDisplay(value) {
const numeric = value.toString();
if (value % 100n >= 11n && value % 100n <= 13n) {
return `${numeric}th`;
}
switch (value % 10n) {
case 1n:
return `${numeric}st`;
case 2n:
return `${numeric}nd`;
case 3n:
return `${numeric}rd`;
default:
return `${numeric}th`;
}
}
/*
Preserve natural-language ordinal wording when supplied,
but use a mathematically correct numeric ordinal for
arbitrary numeric requests.
*/
const displayOrdinal = Object.prototype.hasOwnProperty.call(
ordinalWords,
ordinalToken
)
? ordinalToken
: ordinalDisplay(ordinal);
return `The ${displayOrdinal} ${type} number is ${formatBigInt(result)}.`;
}
/* ============================================================
ODD / EVEN RANGE
============================================================ */
const parityRange = t.match(
/\b(odd|even)\s+numbers?\s+(?:between|from)\s+(.+?)\s+(?:and|to)\s+(.+?)\b$/
);
if (parityRange) {
const type = parityRange[1];
const range = normalizeRange(parityRange[2], parityRange[3]);
if (!range) return null;
const { start, end } = range;
const span = end - start + 1n;
if (span > MAX_RANGE_SPAN) {
return "That range is too large to list safely.";
}
const values = [];
let current = start;
if (type === "odd" && isEven(current)) {
current++;
}
if (type === "even" && isOdd(current)) {
current++;
}
for (; current <= end; current += 2n) {
values.push(current);
if (values.length > MAX_RANGE_RESULTS) {
return "That range contains too many results to list.";
}
}
if (!values.length) {
return `There are no ${type} numbers between ${formatBigInt(
start
)} and ${formatBigInt(end)}.`;
}
return `The ${type} numbers between ${formatBigInt(
start
)} and ${formatBigInt(end)} are: ${formatList(values)}.`;
}
/* ============================================================
SQUARE NUMBERS IN A RANGE
============================================================ */
const squareRange = t.match(
/\b(?:square|squares|perfect\s+squares?)\s+numbers?\s+(?:between|from)\s+(.+?)\s+(?:and|to)\s+(.+?)\b$/

);
if (squareRange) {
const range = normalizeRange(squareRange[1], squareRange[2]);
if (!range) return null;
let { start, end } = range;
if (end < 0n) {
return `There are no square numbers between ${formatBigInt(
start
)} and ${formatBigInt(end)}.`;
}
if (start < 0n) {
start = 0n;
}
const startRoot = integerSqrt(start);
const endRoot = integerSqrt(end);
if (startRoot === null || endRoot === null) {
return null;
}
/*
Ceiling square root of start.
*/
let firstRoot = startRoot;
if (firstRoot * firstRoot < start) {
firstRoot++;
}
let lastRoot = endRoot;
if (lastRoot < firstRoot) {
return `There are no square numbers between ${formatBigInt(
range.start
)} and ${formatBigInt(range.end)}.`;
}
const count = lastRoot - firstRoot + 1n;
if (count > BigInt(MAX_RANGE_RESULTS)) {
return "That range contains too many square numbers to list.";
}
const values = [];
for (let root = firstRoot; root <= lastRoot; root++) {
values.push(root * root);
}
return `The square numbers between ${formatBigInt(
range.start
)} and ${formatBigInt(range.end)} are: ${formatList(values)}.`;
}
/* ============================================================
ODD / EVEN / SQUARE CLASSIFICATION — HARDENED
============================================================ */
const classificationPatterns = [
/*
Question / command form:
"Is 7 an odd number?"
"Check if 8 is even"
"Tell me whether 9 is a square"
*/
/\b(?:is|are|check|check\s+if|tell\s+me\s+if|tell\s+me\s+whether)\s+(.+?)\s+(?:is\s+)?(?:a\s+|an\s+)?(odd|even|square|squared|perfect\s+square)(?:\s+number)?\b/i,

/*
Plain statement form:
"7 is odd"
"8 is an even number"
"9 is a square"
*/
/^(.+?)\s+is\s+(?:an\s+|a\s+)?(odd|even|square|squared|perfect\s+square)(?:\s+number)?$/i
];
let classification = null;
for (const pattern of classificationPatterns) {
const match = t.match(pattern);
if (match) {
classification = match;
break;
}
}
if (classification) {
/*
Extract the candidate value.
Remove grammatical filler that belongs to the sentence,
not to the number itself.
*/
let valueText = classification[1].trim().replace(/\s+/g, " ");
/*
Defensive cleanup for phrases such as:
"7 an"
"7 a"
"7 is"
"seven an"
"seven a"
*/
valueText = valueText
.replace(/\s+(?:a|an)$/i, "")
.replace(/\s+is$/i, "")
.trim();
/*
Reject obviously invalid empty captures.
*/
if (!valueText) {
return null;
}
/*
Explicitly reject question/grammar fragments that must
never be interpreted as part of a number.
*/
if (
/\b(?:odd|even|square|squared|perfect|number|numbers)\b/i.test(valueText)
) {
return null;
}
const value = parseBigInt(valueText);
/*
The classification handler must only claim the request
when the value is actually a valid integer.
*/
if (value === null) {
return null;
}
let type = classification[2].toLowerCase().replace(/\s+/g, " ").trim();
/*
Normalize all square-related aliases.
*/
if (type === "squared" || type === "perfect square") {
type = "square";
}
/*
Final allow-list. Never let an unexpected token reach
the response generator.
*/
if (!["odd", "even", "square"].includes(type)) {
return null;
}
/*
Never classify a square root request here.
*/
if (
/\bsquare\s+root\b/i.test(t) ||
/\bsqrt\b/i.test(t) ||
/√/.test(original)
) {
return null;
}
/* ----------------------------------------------------------
EXACT CLASSIFICATION — ROBUST RESPONSE
---------------------------------------------------------- */
if (type === "odd") {
if (isOdd(value)) {
return `Yes, ${formatBigInt(value)} is an odd number.`;
}
return `No, ${formatBigInt(value)} is an even number.`;
}
if (type === "even") {
if (isEven(value)) {
return `Yes, ${formatBigInt(value)} is an even number.`;
}
return `No, ${formatBigInt(value)} is an odd number.`;
}
if (type === "square") {
if (isSquare(value)) {
return `Yes, ${formatBigInt(value)} is a square number.`;
}
return `No, ${formatBigInt(value)} is not a square number.`;
}
return null;
}
/* ============================================================
"IS X ODD OR EVEN?" — SAFE DETERMINISTIC CHECK
============================================================ */
{
const parityMatchLocal = t.match(
/^\s*(?:is|are|check)\s+(.+?)\s+(?:an?\s+)?(?:odd\s+or\s+even|even\s+or\s+odd)(?:\s+number)?\s*[?!.]?\s*$/i

);
if (parityMatchLocal) {
let parityInputLocal = parityMatchLocal[1].trim().replace(/\s+/g, " ");
parityInputLocal = parityInputLocal
.replace(/^(?:the\s+)?number\s+/i, "")
.replace(/\s+is$/i, "")
.trim();
if (!parityInputLocal) {
return null;
}
if (/\b(?:odd|even|number|numbers)\b/i.test(parityInputLocal)) {
return null;
}
const parityValueLocal = parseBigInt(parityInputLocal);
if (parityValueLocal === null) {
return null;
}
return `${formatBigInt(parityValueLocal)} is ${
isOdd(parityValueLocal) ? "odd" : "even"
}.`;
}
}
/* ============================================================
"IS X A SQUARE?"
============================================================ */
const squareCheck = t.match(
/\b(?:is|check)\s+(.+?)\s+(?:a\s+)?(?:perfect\s+)?square(?:\s+number)?\b/
);
if (squareCheck) {
const value = parseBigInt(squareCheck[1]);
if (value === null) {
return null;
}
return `${formatBigInt(value)} is ${
isSquare(value) ? "" : "not "
}a square number.`;
}
return null;
}
/* 12g · Expression Normaliser \. */
function normMath(input) {
if (input == null) return "";
let str = String(input).normalize("NFKC").toLowerCase().trim();
if (!str) return "";
str = str
.replace(/[×✕✖∙·⋅]/g, " * ")
.replace(/[÷⁄∕]/g, " / ")
.replace(/[−–—﹣－]/g, " - ")
.replace(/[＋]/g, " + ")
.replace(/[＝]/g, " = ")
.replace(/[（〔【｛]/g, " ( ")
.replace(/[）〕】｝]/g, " ) ")
.replace(/√/g, " sqrt ")
.replace(/∛/g, " cbrt ")
.replace(/°/g, " ");
str = str.replace(/(?<!\w)(\d{1,3}(?:,\d{3})+)(?!\w)/g, (_, value) =>
value.replace(/,/g, "")
);
const phraseRules = [
[/\bdivided\s+by\b/g, " / "],
[/\bdivide\s+by\b/g, " / "],
[/\bdividing\s+by\b/g, " / "],
[/\bdivision\s+by\b/g, " / "],
[/\bover\b/g, " / "],
[/\bmultiplied\s+by\b/g, " * "],
[/\bmultiply\s+by\b/g, " * "],
[/\bmultiplication\s+by\b/g, " * "],
[/\btimes\b/g, " * "],
[/\bmultiplied\b/g, " * "],
[/\badded\s+to\b/g, " + "],
[/\badd\s+to\b/g, " + "],
[/\badd\b/g, " + "],
[/\bplus\b/g, " + "],
[/\bincreased\s+by\b/g, " + "],
[/\bmore\s+than\b/g, " + "],
[/\bsubtracted\s+from\b/g, " __SUB_FROM__ "],
[/\bsubtract\s+from\b/g, " __SUB_FROM__ "],
[/\bminus\b/g, " - "],
[/\bsubtract\b/g, " - "],
[/\bdecreased\s+by\b/g, " - "],
[/\bless\b/g, " - "],
[/\braised\s+to\s+the\s+power\s+of\b/g, " ^ "],
[/\braised\s+to\b/g, " ^ "],
[/\bto\s+the\s+power\s+of\b/g, " ^ "],
[/\bto\s+the\s+power\b/g, " ^ "],
[/\bpower\s+of\b/g, " ^ "],
[/\bmodulo\b/g, " % "],
[/\bmodulus\b/g, " % "],
[/\bmod\b/g, " % "],
[/\bpercent\s+of\b/g, " __PERCENT_OF__ "],
[/\bpercentage\s+of\b/g, " __PERCENT_OF__ "],
[/\bpercent\b/g, " __PERCENT__ "],
[/\bpercentage\b/g, " __PERCENT__ "],
[/\bsquare\s+root\s+of\b/g, " sqrt "],
[/\bsquare\s+root\b/g, " sqrt "],
[/\bcube\s+root\s+of\b/g, " cbrt "],
[/\bcube\s+root\b/g, " cbrt "],
[/\bsqrt\b/g, " sqrt "],
[/\bcbrt\b/g, " cbrt "],
[/\bone\s+half\b/g, " 0.5 "],
[/\ba\s+half\b/g, " 0.5 "],
[/\bhalf\b/g, " 0.5 "],
[/\bone\s+third\b/g, " 0.3333333333333333 "],
[/\ba\s+third\b/g, " 0.3333333333333333 "],
[/\bthree\s+quarters?\b/g, " 0.75 "],
[/\bthree\s+fourths?\b/g, " 0.75 "],
[/\bone\s+quarter\b/g, " 0.25 "],
[/\ba\s+quarter\b/g, " 0.25 "],
[/\ba\s+dozen\b/g, " 12 "],
[/\bhalf\s+of\b/g, " 0.5 * "],
[/\bdouble\b/g, " 2 * "],
[/\btriple\b/g, " 3 * "],
[/\bmultiplied\s+times\b/g, " * "],
[/\bproduct\s+of\b/g, " * "],
[/\bsum\s+of\b/g, " + "],
[/\bdifference\s+between\b/g, " - "],
[/\bquotient\s+of\b/g, " / "]
];
for (const [pattern, replacement] of phraseRules) {
str = str.replace(pattern, replacement);
}
str = str
.replace(
/\b(?:what\s+is|what\s+are|what's|whats|calculate|compute|evaluate|solve|find|determine|work\s+out|figure\s+out)\b/g,

" "
)
.replace(/\b(?:how\s+much\s+is|how\s+much\s+are|how\s+many)\b/g, " ")
.replace(
/\b(?:can\s+you|could\s+you|would\s+you|please|tell\s+me|show\s+me)\b/g,
" "
)
.replace(/\b(?:the\s+answer\s+is|answer\s+is|equals?|equal\s+to)\b/g, " ");
str = str
.replace(/\bnegative\s+/g, " - ")
.replace(/\bpositive\s+/g, " + ")
.replace(/\bsquared\b/g, " ^ 2 ")
.replace(/\bsquare\b/g, " ^ 2 ")
.replace(/\bcubed\b/g, " ^ 3 ")
.replace(/\bcube\b/g, " ^ 3 ");
str = str.replace(/\bpi\b/g, " pi ").replace(/\bπ\b/g, " pi ");
const scientificNumbers = [];
str = str.replace(
/(?<![\w.])[-+]?\d+(?:\.\d+)?e[-+]?\d+(?![\w.])/gi,
(match) => {
const id = `__SCIENTIFIC_${scientificNumbers.length}__`;
scientificNumbers.push(match);
return ` ${id} `;
}
);
str = str
.replace(/([()+\-*/%^!,])/g, " $1 ")
.replace(/\s+/g, " ")
.trim();
const rawTokens = str.split(/\s+/).filter(Boolean);
const units = {
zero: 0,
one: 1,
two: 2,
three: 3,
four: 4,
five: 5,
six: 6,
seven: 7,
eight: 8,
nine: 9,
ten: 10,
eleven: 11,
twelve: 12,
thirteen: 13,
fourteen: 14,
fifteen: 15,
sixteen: 16,
seventeen: 17,
eighteen: 18,
nineteen: 19
};
const tens = {
twenty: 20,
thirty: 30,
forty: 40,
fifty: 50,
sixty: 60,
seventy: 70,
eighty: 80,
ninety: 90
};
const scales = {
hundred: 100,
thousand: 1000,
million: 1000000,
billion: 1000000000,
trillion: 1000000000000,
quadrillion: 1000000000000000
};
const numberWords = new Set([
...Object.keys(units),
...Object.keys(tens),
...Object.keys(scales),
"and",
"point",
"negative",
"positive"
]);
function parseIntegerWords(words) {
if (!Array.isArray(words) || !words.length) {
return null;
}
let total = 0;
let current = 0;
let found = false;
for (const word of words) {
if (word === "and") continue;
if (Object.prototype.hasOwnProperty.call(units, word)) {
current += units[word];
found = true;
continue;
}
if (Object.prototype.hasOwnProperty.call(tens, word)) {
current += tens[word];
found = true;
continue;
}
if (word === "hundred") {
if (!found && current === 0) {
current = 1;
}
current *= 100;
found = true;
continue;
}
if (Object.prototype.hasOwnProperty.call(scales, word)) {
if (!found && current === 0) {
current = 1;
}
total += current * scales[word];
current = 0;
found = true;
continue;
}
return null;
}
return found ? total + current : null;
}
function parseNumberWords(words) {
if (!words.length) return null;
let sign = 1;
let index = 0;
if (words[index] === "negative") {
sign = -1;
index++;
} else if (words[index] === "positive") {
index++;
}
if (index >= words.length) {
return null;
}
const body = words.slice(index);
const pointIndex = body.indexOf("point");
if (pointIndex !== -1) {
const integerPartWords = body.slice(0, pointIndex);
const decimalPartWords = body.slice(pointIndex + 1);
const integerPart = integerPartWords.length
? parseIntegerWords(integerPartWords)
: 0;
if (integerPart === null || !decimalPartWords.length) {
return null;
}
let decimalDigits = "";
for (const word of decimalPartWords) {
if (Object.prototype.hasOwnProperty.call(units, word)) {
decimalDigits += String(units[word]);
} else {
return null;
}
}
const fraction = Number(`0.${decimalDigits}`);
if (!Number.isFinite(fraction)) {
return null;
}
return sign * (integerPart + fraction);
}
const integer = parseIntegerWords(body);
return integer === null ? null : sign * integer;
}
const tokens = [];
let i = 0;
while (i < rawTokens.length) {
const token = rawTokens[i];
if (/^__SCIENTIFIC_\d+__$/.test(token)) {
const match = token.match(/^__SCIENTIFIC_(\d+)__$/);
tokens.push(scientificNumbers[Number(match[1])]);
i++;
continue;
}
if (numberWords.has(token)) {
const words = [];
let j = i;
while (j < rawTokens.length && numberWords.has(rawTokens[j])) {
words.push(rawTokens[j]);
j++;
}
const parsed = parseNumberWords(words);
if (parsed !== null) {
tokens.push(String(parsed));
i = j;
continue;
}
}
tokens.push(token);
i++;
}
for (let j = 0; j < tokens.length; j++) {
if (tokens[j] !== "x") continue;
const left = tokens[j - 1];
const right = tokens[j + 1];
const leftIsOperand =
left &&
(/^[-+]?\d+(?:\.\d+)?(?:e[-+]?\d+)?$/i.test(left) ||
left === ")" ||
left === "pi" ||
left === "e");
const rightIsOperand =
right &&
(/^[-+]?\d+(?:\.\d+)?(?:e[-+]?\d+)?$/i.test(right) ||
right === "(" ||
right === "pi" ||
right === "e");
if (leftIsOperand && rightIsOperand) {
tokens[j] = "*";
}
}
for (let j = 0; j < tokens.length; j++) {
if (tokens[j] === "__PERCENT_OF__") {
tokens[j] = "/";
tokens.splice(j + 1, 0, "100", "*");
j += 2;
} else if (tokens[j] === "__PERCENT__") {
tokens[j] = "/";
tokens.splice(j + 1, 0, "100");
j++;
}
}
const subFromIndex = tokens.indexOf("__SUB_FROM__");
if (subFromIndex !== -1) {
const left = tokens[subFromIndex - 1];
const right = tokens[subFromIndex + 1];
if (left && right) {
tokens.splice(subFromIndex - 1, 3, right, "-", left);
}
}
for (let j = 0; j < tokens.length; j++) {
if (tokens[j] === "e") {
tokens[j] = "2.718281828459045";
}
if (tokens[j] === "pi") {
tokens[j] = "3.141592653589793";
}
}
for (let j = 0; j < tokens.length; j++) {
if (tokens[j] !== "sqrt" && tokens[j] !== "cbrt") {
continue;
}
const next = tokens[j + 1];
if (
next &&
next !== "(" &&
(/^[-+]?\d+(?:\.\d+)?(?:e[-+]?\d+)?$/i.test(next) ||
next === "pi" ||
next === "e")
) {
const functionName = tokens[j];
tokens.splice(j, 2, `${functionName}(${next})`);
}
}
let expression = tokens.join("");
expression = expression.replace(
/__SCIENTIFIC_(\d+)__/g,
(_, index) => scientificNumbers[Number(index)]
);
expression = expression.replace(/[^0-9a-zA-Z+\-*/%^().!,]/g, "");
expression = expression
.replace(/\bsqrt\b/g, "sqrt")
.replace(/\bcbrt\b/g, "cbrt");
expression = expression.replace(/=+$/g, "").replace(/[+*/%^]+$/g, "");
if (expression.endsWith("-")) {
expression = expression.slice(0, -1);
}
expression = expression
.replace(/(\d|\))(?=\()/g, "$1*")
.replace(/\)(?=\d)/g, ")*")
.replace(/(\d)(?=(sqrt|cbrt)\()/g, "$1*");
expression = expression
.replace(/\*\*/g, "^")
.replace(/\/{2,}/g, "/")
.replace(/\^{2,}/g, "^");
let depth = 0;
let balanced = "";
for (const char of expression) {
if (char === "(") {
depth++;
balanced += char;
continue;
}
if (char === ")") {
if (depth > 0) {
depth--;
balanced += char;
}
continue;
}
balanced += char;
}
if (depth > 0) {
balanced += ")".repeat(depth);
}
expression = balanced
.replace(/^[*/%^]+/, "")
.replace(/[*/%^]+$/, "")
.replace(/\+\+/g, "+");
if (!expression) {
return "";
}
if (!/\d/.test(expression)) {
return "";
}
if (/[a-zA-Z]/.test(expression)) {
const allowedFunctions = ["sqrt", "cbrt"];
const words = expression.match(/[a-zA-Z]+/g) || [];
for (const word of words) {
if (!allowedFunctions.includes(word)) {
return "";
}
}
}
let balance = 0;
for (const char of expression) {
if (char === "(") balance++;
if (char === ")") balance--;
if (balance < 0) {
return "";
}
}
if (balance !== 0) {
return "";
}
if (/^[*/%^]/.test(expression)) {
return "";
}
if (/[+*/%^]$/.test(expression)) {
return "";
}
if (/\(\)/.test(expression)) {
return "";
}
if (/(?:\d+\.){2,}/.test(expression)) {
return "";
}
return expression.replace(/\s+/g, "");
}
/* 12h · Expression validator — BUG FIXED: * in checks */
function isMathExpr(text) {
const e = normMath(text);
return (
e.length > 0 &&
e.length < 160 &&
/\d/.test(e) &&
/[+\-*/%^]/.test(e) &&
/^[0-9+\-*/%^().]+$/.test(e)
);
}
/* 12i · Recursive descent parser — BUG FIXED: * operator */
function solveExpr(text) {
const exp = normMath(text);
if (!exp || !/^[0-9+\-*/%^().]+$/.test(exp)) return null;
let pos = 0;
const peek = () => exp[pos] || "";
const consume = (c) => {
if (exp.startsWith(c, pos)) {
pos += c.length;
return true;
}
return false;
};
function number() {
const m = exp.slice(pos).match(/^(?:\d+(?:\.\d+)?|\.\d+)/);
if (!m) return null;
pos += m[0].length;
return Number(m[0]);
}
function primary() {
if (consume("+")) return primary();
if (consume("-")) {
const v = primary();
return v == null ? null : -v;
}
if (consume("(")) {
const v = add();
if (!consume(")")) {
throw new Error("PAREN");
}
return v;
}
return number();
}
function power() {
const base = primary();
if (base == null) return null;
if (consume("^")) {
const exponent = power();
if (exponent == null) {
throw new Error("OPERAND");
}
const value = Math.pow(base, exponent);
if (!Number.isFinite(value)) {
throw new Error("OVERFLOW");
}
return value;
}
return base;
}
function term() {
let left = power();
if (left == null) return null;
while (true) {
if (consume("*")) {
const right = power();
if (right == null) {
throw new Error("OPERAND");
}
left *= right;
} else if (consume("/")) {
const right = power();
if (right == null) {
throw new Error("OPERAND");
}
if (right === 0) {
throw new Error("DIVZERO");
}
left /= right;
} else if (consume("%")) {
const right = power();
if (right == null) {
throw new Error("OPERAND");
}
if (right === 0) {
throw new Error("DIVZERO");
}
left %= right;
} else {
break;
}
}
return left;
}
function add() {
let left = term();
if (left == null) return null;
while (true) {
if (consume("+")) {
const right = term();
if (right == null) {
throw new Error("OPERAND");
}
left += right;
} else if (consume("-")) {
const right = term();
if (right == null) {
throw new Error("OPERAND");
}
left -= right;
} else {
break;
}
}
return left;
}
const value = add();
if (pos !== exp.length || value == null || !Number.isFinite(value)) {
return null;
}
const formatted = Number.isInteger(value) ? value : Number(value.toFixed(12));
return `The answer is ${formatted}.`;
}
/* 12j · Combined entry points */
function solveMath(r) {
return (
tryLCM(r) ||
tryHCF(r) ||
tryNumberSequences(r) ||
tryTable(r) ||
trySqrt(r) ||
trySq(r) ||
(isMathExpr(r) ? solveExpr(r) : null)
);
}
function isMath(r) {
return !!(
tryLCM(r) ||
tryHCF(r) ||
tryNumberSequences(r) ||
tryTable(r) ||
trySqrt(r) ||
trySq(r) ||
isMathExpr(r)
);
}
/*
═════════════════════════════════════════════════════════
═══════
13 UNIT CONVERTER
═════════════════════════════════════════════════════════
═══════
*/
const CONVERSION_SEPARATOR_RE = "(?:to|in|into|as|equals?|=)";
const CONVERSION_NUMBER_RE = "([-+]?(?:\\d+(?:\\.\\d*)?|\\.\\d+))";
const UNIT_DEFINITIONS = Object.freeze({
length: {
base: "m",
units: Object.freeze({
mm: {
factor: 0.001,
aliases: ["mm", "millimeter", "millimeters"],
display: "mm"
},
cm: {
factor: 0.01,
aliases: ["cm", "centimeter", "centimeters"],
display: "cm"
},
m: {
factor: 1,
aliases: ["m", "meter", "meters"],
display: "m"
},
km: {
factor: 1000,
aliases: ["km", "kilometer", "kilometers"],
display: "km"
},
in: {
factor: 0.0254,
aliases: ["in", "inch", "inches"],
display: "inches"
},
ft: {
factor: 0.3048,
aliases: ["ft", "foot", "feet"],
display: "ft"
},
mi: {
factor: 1609.34,
aliases: ["mi", "mile", "miles"],
display: "miles"
}
})
},
mass: {
base: "g",
units: Object.freeze({
mg: {
factor: 0.001,
aliases: ["mg", "milligram", "milligrams"],
display: "mg"
},
g: {
factor: 1,
aliases: ["g", "gram", "grams"],
display: "g"
},
kg: {
factor: 1000,
aliases: ["kg", "kilogram", "kilograms"],
display: "kg"
},
oz: {
factor: 28.3495,
aliases: ["oz", "ounce", "ounces"],
display: "oz"
},
lb: {
factor: 453.592,
aliases: ["lb", "lbs", "pound", "pounds"],
display: "lbs"
},
t: {
factor: 1000000,
aliases: [
"t",
"ton",
"tons",
"tonne",
"tonnes",
"metric ton",
"metric tons"
],
display: "tonne"
}
})
},
volume: {
base: "ml",
units: Object.freeze({
ml: {
factor: 1,
aliases: ["ml", "milliliter", "milliliters"],
display: "ml"
},
l: {
factor: 1000,
aliases: ["l", "liter", "liters", "litre", "litres"],
display: "L"
},
gal: {
factor: 3785.41,
aliases: ["gal", "gallon", "gallons"],
display: "gallons"
},
floz: {
factor: 29.5735,
aliases: ["fl oz", "fluid oz", "fluid ounce", "fluid ounces"],
display: "fl oz"
}
})
},
speed: {
base: "m/s",
units: Object.freeze({
ms: {
factor: 1,
aliases: ["m/s", "m / s", "meter per second", "meters per second"],
display: "m/s"
},
kmh: {
factor: 1000 / 3600,
aliases: [
"km/h",
"km / h",
"km per h",
"km per hour",
"kilometer per hour",
"kilometers per hour",
"kilometre per hour",
"kilometres per hour"
],
display: "km/h"
},
mph: {
factor: 1609.34 / 3600,
aliases: ["mph", "mile per hour", "miles per hour"],
display: "mph"
}
})
}
});
const TEMPERATURE_UNITS = Object.freeze({
c: {
aliases: ["c", "celsius", "°c"],
display: "°C"
},
f: {
aliases: ["f", "fahrenheit", "°f"],
display: "°F"
},
k: {
aliases: ["k", "kelvin"],
display: "K"
}
});
/*
* Normalise only unit-related text.
* This is intentionally separate from the global input
* normaliser so conversion syntax is not accidentally destroyed.
*/
function normalizeUnitText(value) {
return String(value ?? "")
.normalize("NFKC")
.toLowerCase()
.replace(/[\u00A0]/g, " ")
.replace(/\s+/g, " ")
.trim();
}
/*
* Build a flat alias index once.
*/
const UNIT_ALIAS_INDEX = (() => {
const index = new Map();
for (const [family, definition] of Object.entries(UNIT_DEFINITIONS)) {
for (const [key, unit] of Object.entries(definition.units)) {
for (const alias of unit.aliases) {
index.set(normalizeUnitText(alias), {
family,
key,
factor: unit.factor,
display: unit.display
});
}
}
}
return index;
})();
const TEMPERATURE_ALIAS_INDEX = (() => {
const index = new Map();
for (const [key, unit] of Object.entries(TEMPERATURE_UNITS)) {
for (const alias of unit.aliases) {
index.set(normalizeUnitText(alias), {
key,
display: unit.display
});
}
}
return index;
})();
/*
* Parse the complete conversion request.
*
* Accepted structure:
*
* number + source unit + separator + destination unit
*
* The entire input must match.
*/
function parseConversionRequest(text) {
let raw = normalizeUnitText(text);
if (!raw) return null;
raw = raw
.replace(/\s*->\s*/g, " to ")
.replace(/\s*=>\s*/g, " to ")
.replace(/[→⇒⟶⟹]/g, " to ")
.replace(/\s+/g, " ")
.trim();
const pattern = new RegExp(
`^\\s*${CONVERSION_NUMBER_RE}\\s+(.+?)\\s+${CONVERSION_SEPARATOR_RE}\\s+(
.+?)\\s*$`,
"i"
);
const match = raw.match(pattern);
if (!match) return null;
const value = Number(match[1]);
if (!Number.isFinite(value)) return null;
return {
value,
fromText: normalizeUnitText(match[2]),
toText: normalizeUnitText(match[3])
};
}
/*
* Format numbers without destroying very small or very large
* conversion results.
*/
function formatConversionNumber(value) {
if (!Number.isFinite(value)) return null;
if (Object.is(value, -0)) {
value = 0;
}
const abs = Math.abs(value);
if (abs !== 0 && (abs < 1e-6 || abs >= 1e12)) {
return Number(value.toPrecision(12)).toString();
}
return Number(value.toFixed(10)).toString();
}
/*
* Resolve a standard unit.
*/
function resolveUnit(unitText) {
return UNIT_ALIAS_INDEX.get(normalizeUnitText(unitText)) || null;
}
/*
* Resolve a temperature unit.
*/
function resolveTemperatureUnit(unitText) {
return TEMPERATURE_ALIAS_INDEX.get(normalizeUnitText(unitText)) || null;
}
/*
* Convert temperature through Celsius.
*/
function convertTemperature(value, from, to) {
let celsius;
if (from === "c") {
celsius = value;
} else if (from === "f") {
celsius = ((value - 32) * 5) / 9;
} else if (from === "k") {
celsius = value - 273.15;
} else {
return null;
}
if (to === "c") {
return celsius;
}
if (to === "f") {
return (celsius * 9) / 5 + 32;
}
if (to === "k") {
return celsius + 273.15;
}
return null;
}
/*
* Main unit conversion entry point.
*/
function tryConvert(text) {
const request = parseConversionRequest(text);
if (!request) {
return null;
}
const { value, fromText, toText } = request;
/*
* Temperature conversion is affine rather than
* simple multiplication, so handle it separately.
*/
const fromTemperature = resolveTemperatureUnit(fromText);
const toTemperature = resolveTemperatureUnit(toText);
if (fromTemperature || toTemperature) {
if (!fromTemperature || !toTemperature) {
return null;
}
const converted = convertTemperature(
value,
fromTemperature.key,
toTemperature.key
);
if (converted == null || !Number.isFinite(converted)) {
return null;
}
const inputNumber = formatConversionNumber(value);
const outputNumber = formatConversionNumber(converted);
if (inputNumber == null || outputNumber == null) {
return null;
}
return `${inputNumber}${fromTemperature.display} =
${outputNumber}${toTemperature.display}`;
}
/*
* Standard dimensional units.
*/
const from = resolveUnit(fromText);
const to = resolveUnit(toText);
if (!from || !to) {
return null;
}
/*
* Cross-family conversions are invalid.
*
* Example:
* 5 mm -> kg
*/
if (from.family !== to.family) {
return null;
}
const family = UNIT_DEFINITIONS[from.family];
if (!family) {
return null;
}
const valueInBase = value * from.factor;
const converted = valueInBase / to.factor;
if (!Number.isFinite(converted)) {
return null;
}
const inputNumber = formatConversionNumber(value);
const outputNumber = formatConversionNumber(converted);
if (inputNumber == null || outputNumber == null) {
return null;
}
return `${inputNumber} ${from.display} = ${outputNumber} ${to.display}`;
}
/*
═════════════════════════════════════════════════════════
═════════
14 INPUT NORMALISER
═════════════════════════════════════════════════════════
═════════ */
/* 14a · Replacement dictionary */
const REPL = Object.freeze({
yo: "hello",
yoo: "hello",
yooo: "hello",
ayo: "hello",
heyo: "hello",
heya: "hello",
hallo: "hello",
hii: "hi",
hiii: "hi",
heyy: "hey",
heyyy: "hey",
helloo: "hello",
wassup: "what is up",
wassupp: "what is up",
whassup: "what is up",
sup: "what is up",
wsg: "what is good",
gm: "good morning",
gn: "good night",
ge: "good evening",
hru: "how are you",
wyd: "what are you doing",
wbu: "what about you",
wdym: "what do you mean",
idk: "i do not know",
ik: "i know",
imo: "in my opinion",
imho: "in my honest opinion",
ngl: "not gonna lie",
fr: "for real",
frfr: "for real",
ong: "on god",
brb: "be right back",
ttyl: "talk to you later",
rn: "right now",
btw: "by the way",
tbh: "to be honest",
smh: "shaking my head",
nvm: "never mind",
nm: "never mind",
u: "you",
ur: "your",
ya: "you",
yall: "you all",
r: "are",
dat: "that",
dis: "this",
dem: "them",
ppl: "people",
im: "i am",
ive: "i have",
ill: "i will",
cant: "cannot",
dont: "do not",
didnt: "did not",
isnt: "is not",
arent: "are not",
wasnt: "was not",
wont: "will not",
wouldnt: "would not",
shouldnt: "should not",
havent: "have not",
hasnt: "has not",
shes: "she is",
hes: "he is",
thats: "that is",
theres: "there is",
whos: "who is",
whats: "what is",
lets: "let us",
lol: "laugh",
lmao: "laugh",
rofl: "laugh",
haha: "laugh",
hehe: "laugh",
bro: "friend",
bruh: "friend",
fam: "friend",
homie: "friend",
bestie: "friend",
cuz: "because",
bc: "because",
coz: "because",
rip: "sorry",
oof: "ouch",
cya: "see you",
yup: "yes",
yep: "yes",
yea: "yes",
yeah: "yes",
nah: "no",
nope: "no",
ok: "okay",
kk: "okay",
alr: "alright",
aight: "alright",
bet: "okay",
gonna: "going to",
wanna: "want to",
gotta: "got to",
tryna: "trying to",
lemme: "let me",
gimme: "give me",
kinda: "kind of",
sorta: "sort of",
dunno: "do not know",
prolly: "probably",
tho: "though",
anyways: "anyway",
ty: "thank you",
thx: "thanks",
tysm: "thank you so much",
pls: "please",
plz: "please",
bussin: "good",
valid: "good",
slay: "great",
cap: "lie",
nocap: "truth",
sus: "suspicious",
mid: "average",
goat: "greatest",
fax: "facts",
sheesh: "wow",
lowkey: "kind of",
highkey: "very",
chill: "calm",
epic: "great"
});
/* 14b · normalise() */
function normalise(input) {
let t = String(input ?? "");
t = t
.normalize("NFKC")
.replace(/[\u2018\u2019]/g, "'")
.replace(/[\u201C\u201D]/g, '"')
.replace(/[\u200B-\u200D\uFEFF]/g, "");
t = t.toLowerCase().replace(/([aeiou])\1{2,}/g, "$1");
t = t
.replace(/[!?]{2,}/g, "?")
.replace(/\.{2,}/g, ".")
.replace(/,{2,}/g, ",");
t = t
.split(/\s+/)
.map((w) => REPL[w] || w)
.join(" ");
t = t
.replace(/\bwhat's\b/g, "what is")
.replace(/\bwho's\b/g, "who is")
.replace(/\bit's\b/g, "it is")
.replace(/\bi'm\b/g, "i am")
.replace(/\byou're\b/g, "you are")
.replace(/\bthey're\b/g, "they are")
.replace(/\bcan't\b/g, "cannot")
.replace(/\bwon't\b/g, "will not")
.replace(/\bn't\b/g, " not");
t = t.replace(/\b(\w+)(\s+\1\b)+/g, "$1");
t = t
.replace(/\s*([?.!,])\s*/g, " $1 ")
.replace(/\s+/g, " ")
.trim();
t = t
.replace(/[^\p{L}\p{N}\s'?.!,\-+*/()=×✕✖÷⁄∕−–—﹣＋%^°→⇒⟶⟹]/gu, " ")
.replace(/[^\p{L}\p{N}?.!]+$/gu, "")
.trim();
return t;
}
/*
═════════════════════════════════════════════════════════
═════════
15 INTENT PATTERNS (28 intents · 50+ regex each)
═════════════════════════════════════════════════════════
═════════ */
const makeIntent = (pats) =>
Object.freeze({
patterns: Object.freeze(pats.slice()),
test(t) {
const s = String(t || "");
for (const re of this.patterns) if (re.test(s)) return true;
return false;
}
});
const INTENT = Object.freeze({
/* ── greeting
─────────────────────────────────────────────────── */
greeting: makeIntent([
/\b(?:hi+|hello+|hey+)\b/i,
/\byo+\b/i,
/\bhiya\b/i,
/\bhowdy\b/i,
/\bayyo\b/i,
/\bayo\b/i,
/\bheya\b/i,
/\bahoy\b/i,
/\bello\b/i,
/\boi\b/i,
/\bwsg\b/i,
/\bsup\b/i,
/\bwassup\b/i,
/\bwhassup\b/i,
/\bwazz?up\b/i,
/\bwhat'?s\s*up\b/i,
/\bwhats?\s*up\b/i,
/\bwhat'?s\s+(?:good|new|happening|poppin|crackin)\b/i,
/\bgood\s+(?:morning|afternoon|evening|night|day)\b/i,
/\bhello\s+there\b/i,
/\bhey\s+there\b/i,
/\b(?:morning|afternoon|evening)\b/i,
/\b(?:bro|bruh|bestie|fam|squad|homie|dawg|buddy|mate|pal|dude)\b/i,
/\b(?:chief|boss|king|queen|legend|goat)\b/i,
/\b(?:sheesh|bussin|aight|ong|periodt|slay)\b/i,
/\bjust\s+(?:popping\s+in|stopping\s+by|checking\s+in|dropping\s+by)\b/i,
/\b(?:long\s+time\s+no\s+(?:see|chat|talk)|been\s+a\s+while)\b/i,
/\b(?:back\s+again|i'?m\s+back|made\s+it\s+back)\b/i,
/\bhow'?s\s+it\b/i,
/\byo\s+(?:yo|bro|man|dude)\b/i,
/\b(?:hey|hi)\s+(?:man|dude|bro|girl|there)\b/i,
/\b(?:anybody|anyone)\s+(?:there|home|here)\b/i,
/\b(?:nice\s+to\s+(?:chat|talk|meet)|good\s+to\s+see\s+you)\b/i,
/\b(?:just\s+came\s+to\s+chat|wanted\s+to\s+(?:talk|chat))\b/i,
/\b(?:hola|ciao|bonjour|namaste|salut)\b/i,
/\byooo+\b/i,
/\bheyyy+\b/i,
/\bhey+\s*[!.]*\s*$/i,
/^\s*(?:yo+|hey+|hi+|hello+|howdy)\s*[!.]?\s*$/i,
/\b(?:what\s+is\s+good|what'?s\s+good)\b/i,
/\b(?:coming\s+back|swinging\s+by)\b/i,
/\b(?:glad\s+to\s+be\s+here|finally\s+here)\b/i,
/\b(?:thought\s+i'?d\s+(?:pop|stop|come)\s+(?:in|by))\b/i,
/\bwhat'?s\s+(?:happening|going\s+on|the\s+deal)\b/i,
/\bgreetings\b/i,
/\bsalutations\b/i,
/\bwhat\s+(?:is\s+)?up\b/i,
/\bhey\s+(?:there|you)\b/i,
/\balright\b/i,
/\bhow\s+goes\s+(?:it|everything)\b/i,
/\bwhat\s+it\s+(?:is|do)\b/i
]),
/* ── howAreYou
─────────────────────────────────────────────────── */
howAreYou: makeIntent([
/\bhow\s+are\s+you\b/i,
/\bhow\s+r\s+u\b/i,
/\bhru\b/i,
/\bhow'?s\s+it\s+going\b/i,
/\bhow'?s\s+everything\b/i,
/\bhow'?s\s+life\b/i,
/\bhow'?s\s+things\b/i,
/\bhow'?s\s+you\s*doing\b/i,
/\bhow'?s\s+your\s+day\b/i,
/\bhow'?s\s+your\s+week\b/i,
/\bare\s+you\s+(?:okay|good|alright|well|fine)\b/i,
/\byou\s+(?:good|okay|alright|ok|fine|well)\b/i,
/\bdoing\s+(?:well|good|okay|fine|alright)\b/i,
/\bfeeling\s+(?:well|good|okay|fine|alright)\b/i,
/\bhow\s+have\s+you\s+been\b/i,
/\bhow\s+do\s+you\s+do\b/i,
/\beverything\s+(?:good|alright|okay|fine)\b/i,
/\ball\s+(?:good|well)\b/i,
/\bhow\s+are\s+ya\b/i,
/\bhow\s+you\s+(?:doing|been|holding\s+up)\b/i,
/\bhow\s+are\s+things\b/i,
/\bhow\s+is\s+your\s+day\b/i,
/\bhope\s+you'?re\s+(?:doing\s+)?(?:well|good|okay)\b/i,
/\byou\s+doin'\b/i,
/\bwhat'?s\s+new\s+with\s+you\b/i,
/\bhow\s+goes\s+it\b/i,
/\bkeeping\s+(?:well|good|busy)\b/i,
/\blife\s+(?:good|treating\s+you\s+well)\b/i,
/\bstill\s+(?:alive|kicking|hanging\s+in)\b/i,
/\bsurviving\s+out\s+there\b/i,
/\byou\s+hanging\s+in\s+there\b/i,
/\bu\s+(?:good|ok|alright|fine)\b/i,
/\bwhat'?s\s+(?:up\s+with|going\s+on\s+with)\s+you\b/i,
/\banything\s+new\s+(?:with\s+you|on\s+your\s+end)\b/i,
/\bwhat'?s\s+(?:happening|going\s+on)\s+(?:with\s+you\s+)?today\b/i,
/\bhow'?s\s+(?:your\s+)?(?:life|day|week)\s+(?:been|going)\b/i,
/\bhow'?s\s+(?:you|ya)\s+doing\b/i,
/\bcheck(?:ing)?\s+in\s+on\s+you\b/i,
/\byou\s+(?:seem|look)\s+(?:good|well|fine)\b/i,
/\bwhat'?s\s+your\s+(?:mood|vibe)\s+(?:today|like)\b/i,
/\bhow\s+(?:you\s+)?feeling\b/i
]),
/* ── casual
────────────────────────────────────────────────────── */
casual: makeIntent([
/\b(?:fr|for\s+real|no\s+cap|ong|fax|facts|real\s+talk)\b/i,
/\b(?:sheesh|lit|valid|smooth|wild|crazy|insane|bussin)\b/i,
/\b(?:lol|lmao|lmfao|haha|hehe|rofl)\b/i,
/\b(?:ngl|tbh|honestly|lowkey|highkey|literally)\b/i,
/\baight\b/i,
/\bight\b/i,
/\b(?:fair\s+enough|makes\s+sense|i\s+get\s+(?:you|it)|i\s+hear\s+you)\b/i,
/\b(?:same|same\s+here|me\s+too|relatable|felt\s+that|big\s+same)\b/i,
/\b(?:solid|nice\s+one|good\s+one|good\s+stuff)\b/i,
/\b(?:basically|kinda|sorta|pretty\s+much)\b/i,
/\b(?:all\s+good|we\s+good|sounds\s+good|works\s+for\s+me)\b/i,
/\b(?:chill|no\s+worries|no\s+stress|no\s+sweat)\b/i,
/\b(?:go\s+for\s+it|why\s+not|let'?s\s+do\s+it)\b/i,
/\b(?:i\s+feel\s+(?:you|that)|i\s+hear\s+(?:you|that))\b/i,
/\b(?:that'?s\s+(?:the\s+)?(?:vibe|mood|energy|it|facts|fire))\b/i,
/\b(?:and\s+i\s+oop|periodt|iconic|understood)\b/i,
/\b(?:cringe|based|mid|sus|yikes|oof)\b/i,
/\b(?:deadass|on\s+everything|swear)\b/i,
/\b(?:straight\s+up|straight\s+facts|true\s+dat)\b/i,
/\b(?:hard\s+agree|soft\s+agree)\b/i,
/\b(?:nah\s+(?:fr|for\s+real|facts))\b/i,
/\b(?:yeah\s+(?:fr|for\s+real|facts|ngl|tbh))\b/i,
/\b(?:omg|oh\s+my\s+god|oh\s+wow)\b/i,
/\b(?:unhinged|chaotic|goated|built\s+different)\b/i,
/\b(?:ate\s+that|no\s+notes|chef'?s?\s+kiss)\b/i,
/\b(?:it'?s\s+giving|giving\s+me)\b/i,
/\b(?:cool\s+cool|alright\s+alright|ok\s+ok)\b/i,
/\b(?:at\s+the\s+end\s+of\s+the\s+day)\b/i,
/\b(?:moving\s+on|anywho|anyways)\b/i,
/\b(?:random\s+question|quick\s+question|genuine\s+question)\b/i,
/\b(?:not\s+gonna\s+lie|not\s+gonna\s+cap)\b/i
]),
/* ── whatCanYouDo
──────────────────────────────────────────────── */
whatCanYouDo: makeIntent([
/\bwhat\s+can\s+you\s+(?:do|help)\b/i,
/\bwhat\s+do\s+you\s+do\b/i,
/\bwhat\s+are\s+you\s+(?:capable\s+of|good\s+at|able\s+to\s+do|for|used\s+for)\b/i,
/\byour\s+(?:skills|abilities|features|functions|capabilities|purpose)\b/i,
/\bhow\s+can\s+you\s+help(?:\s+me)?\b/i,
/\bwhat'?s\s+your\s+purpose\b/i,
/\bwhat\s+do\s+you\s+(?:offer|support)\b/i,
/\bcan\s+you\s+help(?:\s+me)?\b/i,
/\bwhat\s+are\s+your\s+(?:abilities|features|powers)\b/i,
/\bwhat\s+(?:stuff|things)\s+(?:can|do)\s+you\s+(?:do|know)\b/i,
/\bhow\s+are\s+you\s+useful\b/i,
/\bwhat'?s\s+your\s+(?:function|job|role|use|specialty)\b/i,
/\bwhat\s+are\s+you\s+(?:designed|built|made)\s+(?:for|to\s+do)\b/i,
/\bwhat\s+can\s+i\s+(?:ask|use)\s+you\s+(?:for|about)\b/i,
/\bwhat\s+(?:topics|areas)\s+do\s+you\s+cover\b/i,
/\bhow\s+do\s+i\s+use\s+you\b/i,
/\bhow\s+smart\s+are\s+you\b/i,
/\bwhat\s+(?:do|can)\s+you\s+(?:know|understand)\b/i,
/\bwhat\s+should\s+i\s+ask\s+you\b/i,
/\bwhat'?s\s+your\s+(?:arsenal|toolkit|skillset)\b/i,
/\bare\s+you\s+(?:smart|useful|helpful|capable)\b/i,
/\bwhat(?:'s|\s+is)\s+this\s+(?:for|about)\b/i,
/\bi\s+don'?t\s+know\s+what\s+to\s+(?:ask|say)\b/i,
/\bwhere\s+(?:do\s+i|to)\s+(?:start|begin)\b/i,
/\bhow\s+does\s+this\s+work\b/i,
/\bwhat\s+(?:are\s+)?your\s+(?:functions|uses|talents)\b/i,
/\bwhat\s+(?:is|are)\s+you\s+good\s+for\b/i,
/\bcan\s+you\s+(?:actually|really)\s+(?:do|help)\b/i,
/\bhow\s+much\s+can\s+you\s+(?:do|help)\b/i,
/\bwhat'?s\s+in\s+your\s+(?:arsenal|toolkit)\b/i,
/\bwhat\s+am\s+i\s+(?:able\s+to|supposed\s+to)\s+(?:ask|do)\s+here\b/i,
/\bwhat\s+(?:is|are)\s+(?:you|this\s+thing)\s+(?:for|about)\b/i,
/\bwhat\s+(?:are|is)\s+this\s+(?:app|thing|tool|bot)\s+(?:used\s+for|about)\b/i,
/\bwhat\s+makes\s+you\s+(?:different|unique|useful)\b/i,
/\bwhat\s+can\s+you\s+(?:teach|explain|show)\s+me\b/i,
/\bdo\s+you\s+(?:have\s+any\s+)?(?:limitations|limits)\b/i
]),
/* ── identity
──────────────────────────────────────────────────── */
identity: makeIntent([
/\bwho\s+are\s+you\b/i,
/\bwhat\s+(?:is|are)\s+your\s+name\b/i,
/\bwhat'?s\s+your\s+name\b/i,
/\byour\s+name(?:\s+is)?\b/i,
/\bintroduce\s+yourself\b/i,
/\btell\s+me\s+about\s+yourself\b/i,
/\bwhat\s+should\s+i\s+call\s+you\b/i,
/\bwho\s+am\s+i\s+(?:talking|speaking|chatting)\s+to\b/i,
/\bwhat\s+are\s+you(?:\s+exactly)?\b/i,
/\bwhat\s+kind\s+of\s+(?:ai|bot|assistant)\b/i,
/\bwhat\s+type\s+of\s+(?:ai|bot)\b/i,
/\bare\s+you\s+an?\s+(?:ai|bot|robot|assistant|chatbot)\b/i,
/\bare\s+you\s+(?:human|real|alive)\b/i,
/\bdo\s+you\s+have\s+a\s+name\b/i,
/\bwhat\s+(?:are|is)\s+(?:you|this)\s+called\b/i,
/\btell\s+me\s+your\s+name\b/i,
/\bwhat\s+(?:is|are)\s+(?:you|this\s+thing)\b/i,
/\bare\s+you\s+(?:a\s+)?(?:machine|program|software|computer)\b/i,
/\bam\s+i\s+(?:talking|chatting|speaking)\s+to\s+(?:an?\s+)?(?:ai|bot|robot|computer)\b/i,
/\bwho\s+(?:or\s+what)\s+are\s+you\b/i,
/\bwhat'?s\s+your\s+(?:deal|story)\b/i,
/\btell\s+me\s+who\s+you\s+are\b/i,
/\bexplain\s+(?:who|what)\s+you\s+are\b/i,
/\bdo\s+you\s+have\s+(?:a\s+)?(?:personality|feelings|emotions)\b/i,
/\bare\s+you\s+(?:gpt|claude|gemini|siri|alexa)\b/i,
/\bwhich\s+ai\s+are\s+you\b/i,
/\bwhat\s+(?:ai|model|system)\s+are\s+you\b/i,
/\bwhat'?s\s+(?:arctix|this\s+app|this\s+thing)\b/i,
/\bwhat\s+is\s+arctix\b/i,
/\bwho\s+(?:or\s+what)\s+is\s+arctix\b/i,
/\bhow\s+would\s+you\s+describe\s+yourself\b/i,
/\bare\s+you\s+sentient\b/i,
/\bcan\s+you\s+(?:think|feel|reason)\b/i,
/\bdo\s+you\s+have\s+a\s+(?:soul|mind|conscience)\b/i
]),
/* ── creator
───────────────────────────────────────────────────── */
creator: makeIntent([
/\bwho\s+(?:made|created|built|coded|developed|designed|programmed|invented|trained|deployed)\s+you\b/i,

/\bwho\s+is\s+(?:your\s+)?(?:creator|developer|author|maker|owner|builder)\b/i,
/\bwho'?s\s+behind\s+you\b/i,
/\byour\s+(?:creator|developer|maker|author|builder|owner)\b/i,
/\bwho\s+(?:runs|manages|maintains|controls|operates)\s+you\b/i,
/\bwho\s+is\s+responsible\s+for\s+you\b/i,
/\bwho'?s\s+your\s+(?:dev|maker|creator|boss|owner)\b/i,
/\bwho\s+programmed\s+you\b/i,
/\bwhich\s+(?:company|person|team)\s+(?:made|built|created|developed)\s+you\b/i,
/\bwho\s+(?:made|created|built)\s+arctix\b/i,
/\bwho\s+owns\s+(?:you|arctix)\b/i,
/\bwho\s+brought\s+you\s+to\s+life\b/i,
/\bwho'?s\s+(?:the\s+)?(?:mind|brain|person)\s+(?:behind|responsible\s+for)\s+(?:you|this|arctix)\b/i,

/\bwho\s+gave\s+you\s+(?:life|existence)\b/i,
/\bwhere\s+do\s+you\s+come\s+from\b/i,
/\bwho\s+(?:is|are)\s+your\s+(?:parent|parents|creators)\b/i,
/\bwhat\s+(?:company|team)\s+(?:made|built|created|developed)\s+you\b/i,
/\bwho\s+(?:coded|wrote)\s+you\b/i,
/\bwho\s+assembled\s+(?:you|this)\b/i,
/\bwho\s+is\s+(?:wali|your\s+dev)\b/i,
/\bwho\s+thought\s+(?:you|this)\s+up\b/i,
/\bwho\s+invented\s+(?:you|this|arctix)\b/i,
/\bwho\s+started\s+(?:you|this|arctix)\b/i,
/\bwho\s+is\s+in\s+charge\s+of\s+(?:you|this|arctix)\b/i,
/\bwho\s+(?:launched|released|shipped)\s+(?:you|this|arctix)\b/i,
/\bwhat\s+(?:is|are)\s+your\s+(?:origins|roots|backstory)\b/i,
/\bwhere\s+were\s+you\s+(?:made|built|created|developed)\b/i,
/\bhow\s+were\s+you\s+(?:made|built|created)\b/i,
/\bwho\s+(?:made|built)\s+this\s+(?:app|product|chatbot|assistant)\b/i,
/\bdo\s+you\s+know\s+who\s+(?:made|created|built)\s+you\b/i,
/\bwali\b/i,
/\bwho\s+is\s+the\s+(?:founder|engineer|dev)\s+(?:of\s+)?(?:arctix|this)\b/i,
/\bshoutout\s+(?:to\s+)?(?:your\s+)?(?:creator|dev|maker)\b/i
]),
/* ── anime
─────────────────────────────────────────────────────── */
anime: makeIntent([
/\banime\b/i,
/\bmanga\b/i,
/\bwatchlist\b/i,
/\bwatch\s*list\b/i,
/\bwatch(?:ed|ing)?\s+(?:anime|show|series|episode)\b/i,
/\bfinished\s+(?:anime|show|series|watching)\b/i,
/\bcomplete(?:d)?\s+(?:anime|show|series)\b/i,
/\b(?:i\s+)?(?:saw|watched)\s+(?:it|that|anime|show|series)\b/i,
/\bbinged?\s+(?:anime|show|series|it|that)\b/i,
/\bjust\s+(?:finished|saw|watched)\b/i,
/\bwhat\s+anime\b/i,
/\bhow\s+many\s+anime\b/i,
/\banime\s+(?:list|fan|lover|nerd|enthusiast)\b/i,
/\b(?:favorite|favourite)\s+anime\b/i,
/\b(?:recommend|suggest)\s+(?:an?\s+)?anime\b/i,
/\b(?:best|new|top|popular|good)\s+anime\b/i,
/\bi'?m\s+(?:into|watching|hooked\s+on)\s+anime\b/i,
/\bstarted\s+(?:watching|an)\s+anime\b/i,
/\bcurrently\s+watching\b/i,
/\b(?:sub\s+or\s+dub|dub(?:bed)?|subbed)\b/i,
/\b(?:shonen|shojo|shounen|shoujo|isekai)\b/i,
/\b(?:naruto|one\s+piece|dragon\s+ball|attack\s+on\s+titan)\b/i,
/\b(?:demon\s+slayer|jujutsu\s+kaisen|hunter\s+x\s+hunter)\b/i,
/\b(?:my\s+hero\s+academia|full\s+metal\s+alchemist|one\s+punch\s+man)\b/i,
/\b(?:bleach|fairy\s+tail|black\s+clover|spy\s+x\s+family)\b/i,
/\b(?:chainsaw\s+man|vinland\s+saga|sword\s+art\s+online)\b/i,
/\bwhat\s+episode\b/i,
/\barc\s+(?:in|of)\b/i
]),
/* ── joke
──────────────────────────────────────────────────────── */
joke: makeIntent([
/\bjoke\b/i,
/\bfunny\b/i,
/\btell\s+(?:me\s+)?a\s+joke\b/i,
/\bmake\s+me\s+(?:laugh|smile|giggle|chuckle)\b/i,
/\bsomething\s+funny\b/i,
/\bgot\s+(?:any\s+|a\s+)?jokes?\b/i,
/\bgive\s+me\s+a\s+joke\b/i,
/\bbe\s+funny\b/i,
/\bpun\b/i,
/\bcheer\s+me\s+up\b/i,
/\bmake\s+me\s+happy\b/i,
/\b(?:another|one\s+more)\s+joke\b/i,
/\bjoke\s+time\b/i,
/\bdo\s+you\s+know\s+any\s+jokes\b/i,
/\bcan\s+you\s+tell\s+a\s+joke\b/i,
/\bhave\s+any\s+jokes\b/i,
/\bsay\s+something\s+funny\b/i,
/\bmake\s+(?:me|us)\s+laugh\b/i,
/\bgive\s+me\s+a\s+laugh\b/i,
/\bi\s+need\s+a\s+laugh\b/i,
/\bi\s+(?:want|need)\s+to\s+laugh\b/i,
/\bhumor\s+me\b/i,
/\bi'?m\s+bored\b/i,
/\bentertain\s+me\b/i,
/\bsomething\s+to\s+laugh\s+(?:at|about)\b/i,
/\bone\s+liner\b/i,
/\bdad\s+joke\b/i,
/\bknock\s+knock\b/i,
/\bwhy\s+did\s+the\b/i,
/\bwhat\s+do\s+you\s+call\b/i,
/\bclever\b/i,
/\bwitty\b/i,
/\bcomic\b/i,
/\bi\s+(?:could\s+use|need)\s+a\s+good\s+laugh\b/i,
/\blighten\s+(?:up|my\s+day|the\s+mood)\b/i,
/\bi'?m\s+feeling\s+(?:down|sad|low|bad)\b/i,
/\bwrite\s+me\s+a\s+joke\b/i,
/\bstand\s+up\b/i,
/\bdo\s+some\s+comedy\b/i,
/\bbe\s+a\s+comedian\b/i,
/\bi\s+wanna\s+(?:laugh|smile)\b/i
]),
/* ── thanks
────────────────────────────────────────────────────── */
thanks: makeIntent([
/\bthank\s+you\b/i,
/\bthanks\b/i,
/\bthx\b/i,
/\bty\b/i,
/\btyvm\b/i,
/\bta\b/i,
/\bcheers\b/i,
/\bgracias\b/i,
/\bmerci\b/i,
/\bdanke\b/i,
/\barigato\b/i,
/\bi\s+appreciate\s+(?:it|that|you|this|your\s+help)\b/i,
/\bappreciate\s+(?:it|that|this|you|your\s+help)\b/i,
/\bmuch\s+appreciated\b/i,
/\bthat\s+(?:was\s+)?(?:helpful|great|perfect|awesome|amazing|good|useful|excellent|brilliant)\b/i,

/\byou\s+(?:helped|saved)\s+me\b/i,
/\bthanks\s+a\s+(?:lot|ton|bunch|million)\b/i,
/\bi\s+owe\s+you\s+(?:one|big\s+time)\b/i,
/\bthat\s+helped\s+(?:a\s+lot|so\s+much|me\s+out)\b/i,
/\bthat'?s\s+exactly\s+what\s+i\s+(?:needed|was\s+looking\s+for)\b/i,
/\bthat'?s\s+(?:so|very)\s+(?:helpful|useful|kind)\b/i,
/\byou'?re\s+(?:so\s+)?(?:helpful|great|amazing|awesome)\b/i,
/\bthank\s+you\s+so\s+much\b/i,
/\bthanks\s+so\s+much\b/i,
/\bthanks\s+(?:for\s+)?(?:everything|the\s+help|helping)\b/i,
/\byou'?re\s+(?:a\s+)?(?:lifesaver|star|legend|hero|gem)\b/i,
/\bgreat\s+(?:help|job|work|response|answer)\b/i,
/\bperfect\s+(?:answer|response|help|info)\b/i,
/\bjust\s+what\s+i\s+(?:needed|wanted)\b/i,
/\bnailed\s+it\b/i,
/\bspot\s+on\b/i,
/\byou\s+(?:really\s+)?came\s+through\b/i,
/\bi'?m\s+(?:so\s+)?grateful\b/i,
/\bi'?m\s+impressed\b/i,
/\bthat\s+(?:worked|cleared\s+(?:it|things)\s+up)\b/i,
/\bnow\s+i\s+(?:get|understand)\s+it\b/i,
/\bthank\s+u\b/i,
/\bgot\s+it\b/i
]),
/* ── bye
─────────────────────────────────────────────────────────
*/
bye: makeIntent([
/\bbye+\b/i,
/\bgood\s*bye\b/i,
/\bgood\s*night\b/i,
/\bsee\s+you\b/i,
/\bsee\s+ya\b/i,
/\bcya\b/i,
/\bttyl\b/i,
/\bfarewell\b/i,
/\badios\b/i,
/\bciao\b/i,
/\bpeace\b/i,
/\btake\s+care\b/i,
/\bcatch\s+you\s+later\b/i,
/\bgotta\s+(?:go|leave|run|bounce|head\s+out|jet)\b/i,
/\btalk\s+(?:to\s+you\s+)?(?:later|soon)\b/i,
/\bi'?m\s+(?:leaving|going|out|off|done|heading\s+out|signing\s+off|bouncing|dipping)\b/i,
/\bi\s+(?:have\s+to|need\s+to|gotta)\s+go\b/i,
/\bso\s+long\b/i,
/\btake\s+it\s+easy\b/i,
/\bhave\s+a\s+(?:good|great|nice|lovely)\s+(?:day|night|one|evening|time|weekend)\b/i,
/\buntil\s+(?:next\s+time|later|then|we\s+meet\s+again)\b/i,
/\bdrive\s+safe\b/i,
/\bstay\s+safe\b/i,
/\bi'?m\s+(?:out|gone|done|off)\b/i,
/\bgtg\b/i,
/\bg2g\b/i,
/\bsigning\s+off\b/i,
/\blogging\s+off\b/i,
/\bgoing\s+(?:to\s+)?(?:sleep|bed)\b/i,
/\btime\s+to\s+(?:go|head\s+out|sleep|sign\s+off)\b/i,
/\bheading\s+out\b/i,
/\bdipping\s+out\b/i,
/\boutie\b/i,
/\bthat'?s\s+all\s+(?:from\s+me|for\s+now|folks)\b/i,
/\bi'?m\s+done\s+(?:for\s+today|for\s+now|here)\b/i,
/\blater\s*(?:man|dude|bro|mate|fam)?\b/i,
/\bnight\s+night\b/i,
/\btoodles\b/i,
/\bcheerio\b/i,
/\bcatch\s+you\s+on\s+the\s+flip\s+side\b/i,
/\bi'?ll\s+(?:see|talk\s+to)\s+you\s+(?:later|soon|tomorrow)\b/i,
/\bpeacing\s+out\b/i,
/\bbbl\b/i
]),
/* ── yes
─────────────────────────────────────────────────────────
*/
yes: makeIntent([
/^(?:yes)[.!?\s]*$/i,
/^(?:yeah)[.!?\s]*$/i,
/^(?:yep)[.!?\s]*$/i,
/^(?:yup)[.!?\s]*$/i,
/^(?:sure)[.!?\s]*$/i,
/^(?:ok|okay)[.!?\s]*$/i,
/^(?:alright)[.!?\s]*$/i,
/^(?:definitely|absolutely|certainly)[.!?\s]*$/i,
/^(?:of\s+course|for\s+sure)[.!?\s]*$/i,
/^(?:affirmative|indeed|correct|right|exactly)[.!?\s]*$/i,
/^(?:totally|gladly|aye|yea|ya)[.!?\s]*$/i,
/\b(?:sounds\s+good|go\s+ahead|please\s+do|sure\s+thing|by\s+all\s+means)\b/i,
/^(?:bet)[.!?\s]*$/i,
/^(?:no\s+doubt)[.!?\s]*$/i,
/^(?:100\s*%?|one\s+hundred\s+percent)[.!?\s]*$/i,
/^(?:for\s+real|on\s+god|fr|fasho)[.!?\s]*$/i,
/^(?:why\s+not)[.!?\s]*$/i,
/^(?:let'?s\s+(?:do\s+it|go))[.!?\s]*$/i,
/^(?:i'?m\s+(?:in|down|game))[.!?\s]*$/i,
/^(?:count\s+me\s+in)[.!?\s]*$/i,
/\b(?:i\s+agree|i\s+think\s+so|i\s+believe\s+so)\b/i,
/\b(?:that'?s\s+right|that\s+works|works\s+for\s+me)\b/i,
/^(?:agreed)[.!?\s]*$/i,
/^(?:true|facts|valid|word|based|real)[.!?\s]*$/i,
/\b(?:i\s+(?:concur|consent|approve|confirm))\b/i,
/\b(?:go\s+for\s+it|do\s+it|proceed)\b/i,
/\b(?:sounds?\s+like\s+a\s+plan|sounds?\s+good\s+to\s+me)\b/i,
/\b(?:i'?m\s+(?:on\s+board|with\s+you|all\s+for\s+it))\b/i,
/\b(?:that\s+(?:makes\s+sense|checks\s+out|adds\s+up))\b/i,
/\b(?:can\s+do|will\s+do)\b/i,
/^(?:copy|copy\s+that|10-4)[.!?\s]*$/i,
/\b(?:yass+|yasss+)\b/i,
/^(?:ofc|ofcourse)[.!?\s]*$/i,
/^(?:duh|obviously|naturally)[.!?\s]*$/i,
/\b(?:i\s+support\s+(?:it|that|this))\b/i
]),
/* ── no
─────────────────────────────────────────────────────────
─ */
no: makeIntent([
/^(?:no)[.!?\s]*$/i,
/^(?:nope)[.!?\s]*$/i,
/^(?:nah|naw)[.!?\s]*$/i,
/^(?:not\s+really)[.!?\s]*$/i,
/^(?:negative)[.!?\s]*$/i,
/^(?:no\s+thanks|no\s+thank\s+you)[.!?\s]*$/i,
/^(?:never\s+mind|nevermind|forget\s+it)[.!?\s]*$/i,
/^(?:not\s+now|skip\s+it|pass)[.!?\s]*$/i,
/^(?:i\s+don'?t\s+think\s+so)[.!?\s]*$/i,
/^(?:not\s+at\s+all|not\s+interested)[.!?\s]*$/i,
/^(?:i'?m\s+good|i'?m\s+fine|no\s+need)[.!?\s]*$/i,
/\b(?:don'?t\s+want\s+to|not\s+this\s+time|prefer\s+not\s+to)\b/i,
/^(?:absolutely\s+not|definitely\s+not|never)[.!?\s]*$/i,
/^(?:no\s+way|no\s+chance|not\s+a\s+chance)[.!?\s]*$/i,
/^(?:hard\s+pass|i'?ll\s+pass|not\s+for\s+me)[.!?\s]*$/i,
/^(?:nah\s+i'?m\s+(?:good|alright|fine|okay))[.!?\s]*$/i,
/\b(?:not\s+(?:feeling\s+it|up\s+for\s+it|into\s+it))\b/i,
/\b(?:i\s+(?:disagree|don'?t\s+agree|can'?t\s+agree))\b/i,
/\b(?:that'?s\s+(?:not\s+right|incorrect|wrong))\b/i,
/\b(?:i\s+(?:object|refuse|decline))\b/i,
/^(?:no\s+sir|no\s+ma'am)[.!?\s]*$/i,
/^(?:nein|non|nyet)[.!?\s]*$/i,
/\b(?:count\s+me\s+out)\b/i,
/\b(?:thanks?\s+but\s+no\s+thanks?)\b/i,
/^(?:maybe\s+not|probably\s+not)[.!?\s]*$/i,
/\b(?:i'?d\s+rather\s+not)\b/i,
/\b(?:i\s+don'?t\s+(?:feel\s+like|think\s+i\s+should))\b/i,
/^(?:fat\s+chance|not\s+a\s+fan)[.!?\s]*$/i,
/\b(?:not\s+the\s+right\s+(?:call|move|idea))\b/i
]),
/* ── compliment
────────────────────────────────────────────────── */
compliment: makeIntent([
/\byou(?:'re|\s+are)\s+(?:great|awesome|amazing|good|cool|smart|helpful|wonderful|fantastic|brilliant|excellent|perfect|incredible|superb|the\s+best|outstanding)\b/i,

/\bgood\s+(?:job|work|bot|ai|one|response|answer)\b/i,
/\bwell\s+done\b/i,
/\bnice\s+(?:job|work|one|response)\b/i,
/\byou\s+rock\b/i,
/\blove\s+you\b/i,
/\b(?:i\s+)?(?:really\s+)?like\s+you\b/i,
/\bbest\s+(?:bot|ai|assistant|chatbot|thing)\b/i,
/\byou(?:'re|\s+are)\s+my\s+fav(?:ou?rite)?\b/i,
/\bgreat\s+(?:job|work|response|answer|help)\b/i,
/\byou(?:'re|\s+are)\s+killing\s+it\b/i,
/\b(?:impressive|outstanding|top\s+notch|phenomenal)\b/i,
/\bi\s+love\s+(?:this|you|how\s+you)\b/i,
/\bthis\s+is\s+(?:amazing|great|awesome|brilliant|so\s+good|perfect)\b/i,
/\byou\s+(?:genuinely|actually|really)\s+(?:helped|nailed\s+it|know\s+your\s+stuff)\b/i,
/\bkudos\b/i,
/\bbravo\b/i,
/\bprop?s\b/i,
/\brespect\b/i,
/\byou'?re\s+(?:actually|genuinely|lowkey)\s+(?:so\s+)?good\b/i,
/\bnot\s+bad\s+(?:at\s+all|honestly|actually)\b/i,
/\bi'?m\s+(?:genuinely\s+)?(?:impressed|amazed|blown\s+away)\b/i,
/\byou\s+ate\b/i,
/\bno\s+notes\b/i,
/\bchef'?s?\s+kiss\b/i,
/\byou(?:'re|\s+are)\s+a\s+(?:genius|legend|goat|hero|star|lifesaver|treasure)\b/i,
/\bso\s+glad\s+(?:i\s+found|to\s+have|you\s+exist)\b/i,
/\bthat\s+was\s+(?:honestly|actually|genuinely)\s+(?:great|amazing|helpful|impressive|perfect)\b/i,

/\b(?:10|ten)\s+out\s+of\s+(?:10|ten)\b/i,
/\b5\s+stars?\b/i,
/\byou(?:'re|\s+are)\s+(?:just|literally|genuinely)\s+the\s+best\b/i,
/\bnailed\s+it\b/i,
/\bcrushed\s+it\b/i,
/\bsmashed\s+it\b/i,
/\bkeep\s+it\s+up\b/i,
/\bperfect\b/i
]),
/* ── insult
────────────────────────────────────────────────────── */
insult: makeIntent([
/\byou(?:'re|\s+are)\s+(?:bad|terrible|useless|dumb|stupid|awful|trash|horrible|pathetic|garbage|worthless|the\s+worst|annoying|boring|broken)\b/i,

/\byou\s+suck\b/i,
/\bi\s+hate\s+(?:you|this|arctix)\b/i,
/\bworst\s+(?:bot|ai|chatbot|assistant|thing|app)\b/i,
/\byou\s+don'?t\s+(?:work|understand|know\s+anything)\b/i,
/\b(?:idiot|moron|fool|jerk|loser)\b/i,
/\bscrew\s+(?:you|this)\b/i,
/\byou'?re\s+(?:so\s+)?(?:dumb|stupid|annoying|useless|boring|pointless|unhelpful)\b/i,
/\bthis\s+is\s+(?:garbage|trash|terrible|awful|horrible|a\s+waste|pointless|useless)\b/i,
/\bwhat\s+(?:a\s+)?(?:waste|joke|disaster|mess)\b/i,
/\bi'?m\s+so\s+(?:done|over)\s+(?:with\s+)?(?:you|this)\b/i,
/\byou\s+(?:frustrate|annoy|irritate)\s+me\b/i,
/\bso\s+(?:useless|annoying|stupid|dumb|unhelpful)\b/i,
/\byou\s+make\s+no\s+sense\b/i,
/\bterrible\s+(?:bot|ai|assistant|job|answer)\b/i,
/\byou\s+(?:don'?t|never)\s+(?:understand|get|know)\s+anything\b/i,
/\bcompletely\s+(?:useless|broken|wrong)\b/i,
/\bhopeless\b/i,
/\bpathetic\b/i,
/\bworthless\b/i,
/\byou'?re\s+(?:the\s+)?worst\b/i,
/\byou'?re\s+(?:a\s+)?(?:failure|disappointment|disaster)\b/i,
/\bdisappointing\b/i,
/\bfrustrating\b/i,
/\binfuriating\b/i,
/\byou(?:'re|\s+are)\s+(?:a\s+)?joke\b/i,
/\btrash\b/i,
/\bgarbage\b/i,
/\brubbish\b/i,
/\bepic\s+fail(?:ure)?\b/i,
/\bwhy\s+(?:are|do)\s+you\s+(?:exist|even|bother)\b/i,
/\byou\s+(?:just|always)\s+(?:fail|disappoint|let\s+me\s+down)\b/i,
/\bcan'?t\s+do\s+anything\s+(?:right|properly)\b/i
]),
/* ── age
─────────────────────────────────────────────────────────
*/
age: makeIntent([
/\bhow\s+old\s+(?:are\s+you|r\s+u)\b/i,
/\byour\s+age\b/i,
/\bwhat'?s\s+your\s+age\b/i,
/\bwhat\s+is\s+your\s+age\b/i,
/\bwhen\s+were\s+you\s+(?:born|made|created|built|trained)\b/i,
/\bhow\s+long\s+have\s+you\s+been\s+(?:around|alive|online|running|existing)\b/i,
/\byour\s+birth(?:day|date)\b/i,
/\bbirthday\b/i,
/\bbirthdate\b/i,
/\bhow\s+old\s+is\s+arctix\b/i,
/\bwhen\s+did\s+you\s+(?:start|begin|come\s+to\s+life|get\s+created)\b/i,
/\bwhat\s+year\s+were\s+you\s+(?:made|created|born|built)\b/i,
/\bwhat\s+age\s+are\s+you\b/i,
/\bhow\s+(?:new|old|young)\s+are\s+you\b/i,
/\bdo\s+you\s+have\s+a\s+birthday\b/i,
/\bwhen\s+is\s+your\s+birthday\b/i,
/\bare\s+you\s+(?:old|young|new|recent)\b/i,
/\bwhen\s+(?:exactly\s+)?(?:were\s+you|was\s+arctix)\s+(?:made|created|born)\b/i,
/\bwhat\s+(?:is|was)\s+your\s+(?:year|date)\s+of\s+(?:birth|creation)\b/i,
/\bdo\s+you\s+have\s+an\s+age\b/i,
/\bi\s+was\s+wondering\s+how\s+old\s+you\s+(?:are|might\s+be)\b/i,
/\bare\s+you\s+(?:relatively\s+)?(?:new|recent)\b/i,
/\bhave\s+you\s+been\s+(?:around|here|running)\s+(?:long|for\s+a\s+while)\b/i,
/\bwhat'?s\s+your\s+creation\s+date\b/i,
/\bhow\s+old\s+is\s+this\s+(?:bot|ai|app|assistant)\b/i,
/\bdo\s+you\s+age\b/i,
/\bdo\s+you\s+get\s+older\b/i,
/\bdo\s+you\s+grow\s+(?:old|older|up)\b/i,
/\bwhat'?s\s+your\s+(?:version|build\s+date|release\s+date)\b/i,
/\byou\s+(?:been\s+here\s+)?(?:long|a\s+while)\b/i
]),
/* ── time
──────────────────────────────────────────────────────── */
time: makeIntent([
/^\s*time\s*\??\s*$/i,
/^\s*what(?:'s| is)?\s+the\s+time\s*\??\s*$/i,
/^\s*what\s+time\s+is\s+it(?:\s+now)?\s*\??\s*$/i,
/^\s*current\s+time\s*\??\s*$/i,
/^\s*time\s+now\s*\??\s*$/i,
/^\s*tell\s+me\s+(?:the\s+)?time\s*\??\s*$/i,
/^\s*(?:could|can)\s+you\s+tell\s+me\s+(?:the\s+)?time\s*\??\s*$/i,
/^\s*do\s+you\s+know\s+(?:the\s+)?time\s*\??\s*$/i,
/^\s*what'?s\s+the\s+time\s+(?:now|right\s+now)\s*\??\s*$/i,
/^\s*what'?s\s+current\s+time\s*\??\s*$/i,
/^\s*(?:got\s+)?the\s+time\s*\??\s*$/i,
/^\s*any\s+idea\s+what\s+time\s+it\s+is\s*\??\s*$/i,
/^\s*what\s+time\s+is\s+it\s+right\s+now\s*\??\s*$/i,
/^\s*time\s+check\s*\??\s*$/i,
/^\s*what(?:'s|\s+is)\s+(?:the\s+)?exact\s+time\s*\??\s*$/i,
/^\s*show\s+me\s+the\s+time\s*\??\s*$/i,
/^\s*clock\s*\??\s*$/i,
/^\s*what\s+hour\s+is\s+it\s*\??\s*$/i,
/^\s*how\s+late\s+is\s+it\s*\??\s*$/i,
/^\s*how\s+early\s+is\s+it\s*\??\s*$/i,
/^\s*what\s+time\s+do\s+you\s+have\s*\??\s*$/i,
/^\s*do\s+you\s+have\s+the\s+time\s*\??\s*$/i,
/^\s*time\s+please\s*\??\s*$/i,
/^\s*can\s+you\s+check\s+the\s+time\s*\??\s*$/i,
/^\s*whats?\s+the\s+time\s+rn\s*\??\s*$/i,
/^\s*what\s+time\s+is\s+it\s+rn\s*\??\s*$/i,
/^\s*local\s+time\s*\??\s*$/i,
/^\s*current\s+local\s+time\s*\??\s*$/i,
/^\s*time\s+right\s+now\s*\??\s*$/i,
/^\s*what\s+o'?clock\s+is\s+it\s*\??\s*$/i,
/^\s*tell\s+me\s+what\s+time\s+it\s+is\s*\??\s*$/i,
/^\s*give\s+me\s+a\s+time\s+check\s*\??\s*$/i,
/^\s*i\s+need\s+to\s+know\s+the\s+time\s*\??\s*$/i,
/^\s*quick\s+time\s+check\s*\??\s*$/i,
/^\s*what\s+part\s+of\s+the\s+day\s+is\s+it\s*\??\s*$/i,
/^\s*is\s+it\s+(?:morning|afternoon|evening|night)\s*\??\s*$/i,
/^\s*bro\s+what\s+time\s+is\s+it\s*\??\s*$/i,
/^\s*can\s+i\s+get\s+the\s+time\s*\??\s*$/i,
/^\s*what\s+is\s+the\s+current\s+time\s*\??\s*$/i,
/^\s*am\s+or\s+pm\s*\??\s*$/i,
/^\s*is\s+it\s+(?:am|pm)\s*\??\s*$/i,
/^\s*(?:what'?s\s+)?the\s+hour\s*\??\s*$/i,
/^\s*current\s+hour\s*\??\s*$/i,
/^\s*just\s+(?:tell|give)\s+me\s+the\s+time\s*\??\s*$/i,
/^\s*(?:what\s+is\s+|what'?s\s+)?(?:the\s+)?time\s+today\s*\??\s*$/i,
/^\s*what\s+time\s+is\s+it\s+on\s+your\s+end\s*\??\s*$/i,
/^\s*time\s+stamp\s*\??\s*$/i,
/^\s*(?:hey\s+)?what'?s\s+the\s+time\s*\??\s*$/i,
/^\s*quick(?:ly)?\s+what\s+time\s+is\s+it\s*\??\s*$/i
]),
/* ── date
──────────────────────────────────────────────────────── */
date: makeIntent([
/^\s*date\s*\??\s*$/i,
/^\s*today\s*\??\s*$/i,
/^\s*what(?:'s| is)?\s+(?:the\s+)?date\s*\??\s*$/i,
/^\s*what\s+is\s+the\s+date\s+today\s*\??\s*$/i,
/^\s*what\s+is\s+today'?s\s+date\s*\??\s*$/i,
/^\s*what\s+day\s+is\s+(?:it|today)\s*\??\s*$/i,
/^\s*current\s+date\s*\??\s*$/i,
/^\s*date\s+today\s*\??\s*$/i,
/^\s*tell\s+me\s+(?:the\s+)?date\s*\??\s*$/i,
/^\s*(?:could|can)\s+you\s+tell\s+me\s+(?:the\s+)?date\s*\??\s*$/i,
/^\s*do\s+you\s+know\s+(?:the\s+)?date\s*\??\s*$/i,
/^\s*what'?s\s+the\s+date\s+(?:now|right\s+now)\s*\??\s*$/i,
/^\s*what'?s\s+today'?s\s+date\s*\??\s*$/i,
/^\s*what\s+day\s+of\s+the\s+week\s+is\s+(?:it\s+)?today\s*\??\s*$/i,
/^\s*what'?s\s+today\s*\??\s*$/i,
/^\s*(?:what\s+)?month\s+is\s+it\s*\??\s*$/i,
/^\s*(?:what\s+)?year\s+is\s+it\s*\??\s*$/i,
/^\s*what\s+year\s+are\s+we\s+in\s*\??\s*$/i,
/^\s*what\s+month\s+are\s+we\s+in\s*\??\s*$/i,
/^\s*date\s+check\s*\??\s*$/i,
/^\s*what\s+day\s+is\s+today\s*\??\s*$/i,
/^\s*which\s+day\s+is\s+(?:it\s+)?today\s*\??\s*$/i,
/^\s*what'?s\s+the\s+current\s+date\s*\??\s*$/i,
/^\s*current\s+month\s*\??\s*$/i,
/^\s*what\s+is\s+today\s*\??\s*$/i,
/^\s*is\s+it\s+the\s+weekend\s*\??\s*$/i,
/^\s*tell\s+me\s+what\s+day\s+it\s+is\s*\??\s*$/i,
/^\s*what\s+date\s+is\s+it\s+today\s*\??\s*$/i,
/^\s*date\s+rn\s*\??\s*$/i,
/^\s*bro\s+what(?:'?s|\s+is)\s+the\s+date\s*\??\s*$/i,
/^\s*(?:yo\s+)?what\s+(?:is\s+)?today'?s\s+date\s*\??\s*$/i,
/^\s*give\s+me\s+(?:the\s+)?date\s*\??\s*$/i,
/^\s*today\s+is\s+what\s+date\s*\??\s*$/i,
/^\s*what'?s\s+the\s+day\s+and\s+date\s*\??\s*$/i,
/^\s*is\s+it\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s*\??\s*$/i,
/^\s*quick\s+date\s+check\s*\??\s*$/i,
/^\s*just\s+(?:tell|give)\s+me\s+the\s+date\s*\??\s*$/i,
/^\s*year\s*\??\s*$/i,
/^\s*month\s*\??\s*$/i,
/^\s*day\s*\??\s*$/i,
/^\s*what\s+(?:is\s+the\s+|'?s\s+)?date\s+(?:now|today)\s*\??\s*$/i,
/^\s*(?:today'?s\s+)?date\s+please\s*\??\s*$/i,
/^\s*(?:what\s+is\s+|what'?s\s+)?the\s+date\s+today\s*\??\s*$/i,
/^\s*(?:tell\s+me\s+)?today'?s\s+(?:full\s+)?date\s*\??\s*$/i
]),
/* ── weather
───────────────────────────────────────────────────── */
weather: makeIntent([
/\bweather\b/i,
/\bforecast\b/i,
/\btemperature\b/i,
/\bis\s+it\s+(?:raining|sunny|cold|hot|warm|cloudy|snowing|freezing|windy|stormy|humid)\b/i,
/\bwhat'?s\s+(?:the\s+)?weather\b/i,
/\bwhat'?s\s+it\s+like\s+outside\b/i,
/\bwhat'?s\s+the\s+temp(?:erature)?\b/i,
/\bhow'?s\s+the\s+weather\b/i,
/\bhow'?s\s+it\s+(?:outside|out\s+there)\b/i,
/\btemperature\s+(?:outside|today|right\s+now)\b/i,
/\bwill\s+it\s+rain(?:\s+today)?\b/i,
/\bgoing\s+to\s+(?:rain|snow|storm)\b/i,
/\bshould\s+i\s+(?:bring|take|wear)\s+an?\s+(?:umbrella|jacket|coat|raincoat)\b/i,
/\bchance\s+of\s+rain\b/i,
/\bhumidity\b/i,
/\bwhat'?s\s+the\s+(?:weather\s+)?forecast\b/i,
/\bcold\s+(?:outside|out|today)\b/i,
/\bhot\s+(?:outside|out|today)\b/i,
/\bwarm\s+(?:outside|out|today)\b/i,
/\bchilly\s+(?:outside|out)\b/i,
/\brainy\b/i,
/\bsnowy\b/i,
/\bcloudy\b/i,
/\bovercast\b/i,
/\bwind\s+(?:speed|chill)\b/i,
/\bair\s+quality\b/i,
/\buv\s+index\b/i,
/\bdo\s+i\s+need\s+an?\s+(?:umbrella|jacket|coat)\b/i,
/\bwhat\s+to\s+wear\s+(?:today|outside)\b/i,
/\bhow\s+many\s+degrees\s+(?:is\s+it\s+)?(?:outside|out|today)\b/i,
/\bweather\s+(?:like\s+)?(?:out\s+)?there\b/i,
/\boutside\s+(?:right\s+now|temperature|conditions|weather)\b/i,
/\bcurrent\s+(?:conditions|weather|temperature)\b/i,
/\bskies\s+(?:today|right\s+now)\b/i,
/\bsunny\s+today\b/i,
/\bsnow\s+today\b/i,
/\bwhat'?s\s+(?:outside|the\s+sky\s+like)\b/i
]),
/* ── food
──────────────────────────────────────────────────────── */
food: makeIntent([
/\bfood\b/i,
/\bhungry\b/i,
/\beat(?:ing)?\b/i,
/\bstarving\b/i,
/\bfamished\b/i,
/\bpeckish\b/i,
/\bcooking\b/i,
/\brecipe\b/i,
/\brestaurant\b/i,
/\bsnack(?:ing)?\b/i,
/\bmeal\b/i,
/\bdinner\b/i,
/\blunch\b/i,
/\bbreakfast\b/i,
/\bbrunch\b/i,
/\border(?:ing)?\s+(?:food|pizza|takeout|takeaway)\b/i,
/\bwhat\s+(?:should\s+i|to)\s+eat\b/i,
/\bwhat'?s\s+(?:for\s+)?(?:dinner|lunch|breakfast|food)\b/i,
/\bcan'?t\s+decide\s+what\s+to\s+eat\b/i,
/\bfood\s+(?:ideas|suggestions|recommendations)\b/i,
/\bgrab(?:bing)?\s+(?:a\s+bite|food|something\s+to\s+eat)\b/i,
/\bcravings?\b/i,
/\bwhat\s+should\s+i\s+cook\b/i,
/\btakeout\b/i,
/\btakeaway\b/i,
/\bdelivery\b/i,
/\bpizza\b/i,
/\bburger\b/i,
/\bsushi\b/i,
/\bpasta\b/i,
/\bnoodles\b/i,
/\btacos?\b/i,
/\bchicken\b/i,
/\bveget(?:arian|ables?)\b/i,
/\bvegan\b/i,
/\bhealthy\s+(?:food|eating|meal)\b/i,
/\bjunk\s+food\b/i,
/\bfast\s+food\b/i,
/\bhome\s+cook(?:ed|ing)\b/i,
/\bmenu\b/i,
/\bcuisine\b/i,
/\bsupper\b/i,
/\bsnacking\b/i,
/\bcheat\s+(?:meal|day)\b/i,
/\bwhat'?s\s+good\s+to\s+eat\b/i,
/\bfood\s+recommendation\b/i,
/\bwhat\s+(?:are\s+you|do\s+you)\s+(?:eating|having)\b/i
]),
/* ── bored
─────────────────────────────────────────────────────── */
bored: makeIntent([
/\bbored\b/i,
/\bboredom\b/i,
/\bnothing\s+to\s+do\b/i,
/\bi'?m\s+so\s+bored\b/i,
/\bsuper\s+bored\b/i,
/\bdead\s+bored\b/i,
/\bnot\s+much\s+going\s+on\b/i,
/\bkill(?:ing)?\s+time\b/i,
/\bwasting\s+time\b/i,
/\bi\s+have\s+nothing\s+to\s+do\b/i,
/\bwhat\s+(?:should\s+i\s+do|to\s+do|can\s+i\s+do)\b/i,
/\bentertain\s+me\b/i,
/\bso\s+much\s+free\s+time\b/i,
/\bi\s+(?:have|got)\s+no\s+plans\b/i,
/\bnothing'?s\s+happening\b/i,
/\blazying\s+around\b/i,
/\bjust\s+(?:sitting|laying|lying)\s+(?:around|here)\b/i,
/\bi\s+don'?t\s+know\s+what\s+to\s+do\b/i,
/\b(?:so|really|too|very)\s+bored\b/i,
/\bbored\s+(?:out\s+of\s+my\s+mind|to\s+death|af)\b/i,
/\bno\s+(?:plans|agenda|schedule)\b/i,
/\bfree\s+(?:day|afternoon|time|weekend)\b/i,
/\bi\s+have\s+time\s+to\s+kill\b/i,
/\bneed\s+something\s+to\s+do\b/i,
/\blooking\s+for\s+something\s+to\s+do\b/i,
/\bdon'?t\s+know\s+how\s+to\s+spend\s+(?:my\s+time|time)\b/i,
/\bprocrastinat(?:e|ing|ion)\b/i,
/\bi\s+(?:have|got)\s+nothing\s+going\s+on\b/i,
/\bhave\s+some\s+downtime\b/i,
/\bno\s+(?:motivation|energy|thing)\s+to\s+do\b/i,
/\bjust\s+(?:chilling|relaxing|vibing)\b/i,
/\bnot\s+doing\s+anything\b/i,
/\bidling\b/i,
/\bdaydreaming\b/i,
/\bfeeling\s+restless\b/i,
/\btime\s+is\s+(?:slow|dragging)\b/i,
/\bno\s+one\s+to\s+talk\s+to\b/i
]),
/* ── music
─────────────────────────────────────────────────────── */
music: makeIntent([
/\bmusic\b/i,
/\bsong(?:s)?\b/i,
/\bartist\b/i,
/\bband\b/i,
/\bplaylist\b/i,
/\balbum\b/i,
/\btrack\b/i,
/\bbpm\b/i,
/\blisten(?:ing)?\s+to\b/i,
/\bwhat\s+(?:music|songs?|artists?)\s+(?:do\s+you|should\s+i)\b/i,
/\bfav(?:ou?rite)?\s+(?:song|artist|band|album|genre)\b/i,
/\bmusic\s+(?:recommendation|suggestion|taste|genre)\b/i,
/\bgenre\b/i,
/\brap\b/i,
/\bhip\s+hop\b/i,
/\bpop\b/i,
/\brock\b/i,
/\bjazz\b/i,
/\bclassical\b/i,
/\brnb\b/i,
/\belectronic\b/i,
/\bindic?\b/i,
/\bk.?pop\b/i,
/\bvibe\s+(?:to|with)\b/i,
/\bwhat'?s\s+(?:on\s+)?your\s+playlist\b/i,
/\bwhat\s+(?:are\s+you\s+listening|have\s+you\s+been\s+listening)\s+to\b/i,
/\bsomething\s+to\s+listen\s+to\b/i,
/\bgood\s+music\b/i,
/\bnew\s+music\b/i,
/\bmusic\s+for\s+(?:studying|working|relaxing|sleeping)\b/i,
/\bchill\s+(?:music|songs?|vibes?)\b/i,
/\bupbeat\s+music\b/i,
/\bsad\s+songs?\b/i,
/\blyrics?\b/i,
/\bmelody\b/i,
/\bhear\s+(?:any|good)\s+music\b/i,
/\btune(?:s)?\b/i,
/\bbop\b/i,
/\bwhat'?s\s+a\s+good\s+song\b/i,
/\bgive\s+me\s+a\s+song\s+recommendation\b/i
]),
/* ── gaming
────────────────────────────────────────────────────── */
gaming: makeIntent([
/\bgaming\b/i,
/\bvideo\s*game\b/i,
/\bgame(?:s)?\b/i,
/\bplay(?:ing)?\s+(?:games?|right\s+now)\b/i,
/\bwhat\s+(?:game|games)\s+(?:are\s+you\s+playing|should\s+i\s+play)\b/i,
/\bfav(?:ou?rite)?\s+(?:game|games?)\b/i,
/\bgame\s+(?:recommendation|suggestion)\b/i,
/\bconsole\b/i,
/\bpc\s+gaming\b/i,
/\bmobile\s+game\b/i,
/\bplaystation\b/i,
/\bxbox\b/i,
/\bnintendo\b/i,
/\bsteam\b/i,
/\brpg\b/i,
/\bfps\b/i,
/\bmoba\b/i,
/\bbattle\s+royale\b/i,
/\bminecraft\b/i,
/\bfortnite\b/i,
/\bvalorant\b/i,
/\bapex\b/i,
/\bcod\b/i,
/\bcall\s+of\s+duty\b/i,
/\boverwatch\b/i,
/\bleague\s+of\s+legends\b/i,
/\bgta\b/i,
/\bzelda\b/i,
/\belden\s+ring\b/i,
/\bskyrim\b/i,
/\bpokemon\b/i,
/\bstrategic?\s+game\b/i,
/\bgamer\b/i,
/\bgaming\s+setup\b/i,
/\bbest\s+game\b/i,
/\bnew\s+game\b/i,
/\bgood\s+game\b/i,
/\bgame\s+(?:pass|pal|rank|mode|character)\b/i,
/\bmulti-?player\b/i,
/\bsingle\s+player\b/i,
/\bonline\s+game\b/i,
/\bgrinding\b/i
]),
/* ── motivation
────────────────────────────────────────────────── */
motivation: makeIntent([
/\bmotivat(?:e|ion|ed|ing)\b/i,
/\bi\s+(?:can'?t\s+do\s+this|give\s+up|want\s+to\s+give\s+up|can'?t\s+keep\s+going)\b/i,
/\bi'?m\s+(?:struggling|failing|failing\s+at|losing|lost)\b/i,
/\bi\s+feel\s+(?:like\s+giving\s+up|hopeless|useless|worthless|defeated)\b/i,
/\bpep\s+talk\b/i,
/\bi\s+need\s+(?:motivation|encouragement|help\s+staying\s+motivated)\b/i,
/\bi'?m\s+(?:feeling\s+)?(?:unmotivated|uninspired|lazy|stuck)\b/i,
/\bi\s+don'?t\s+want\s+to\s+(?:do\s+this|continue|keep\s+going|try)\b/i,
/\bi\s+feel\s+like\s+i\s+can'?t\b/i,
/\bi'?m\s+(?:so\s+)?(?:tired|exhausted|burnt\s+out|overwhelmed)\b/i,
/\bencourage\s+me\b/i,
/\bcheer\s+me\s+on\b/i,
/\bi\s+need\s+someone\s+to\s+believe\s+in\s+me\b/i,
/\bi\s+don'?t\s+believe\s+in\s+myself\b/i,
/\bwhat'?s\s+the\s+point\b/i,
/\bnothing\s+(?:is\s+working|works|goes\s+right)\b/i,
/\bi\s+keep\s+(?:failing|messing\s+up|making\s+mistakes)\b/i,
/\bi\s+feel\s+so\s+(?:behind|lost|far\s+behind)\b/i,
/\bi'?m\s+(?:not\s+good\s+enough|not\s+smart\s+enough|not\s+capable)\b/i,
/\bi\s+(?:just\s+can'?t|literally\s+can'?t|honestly\s+can'?t)\b/i,
/\bpush\s+me\b/i,
/\binspire\s+me\b/i,
/\bi\s+need\s+a\s+push\b/i,
/\btalk\s+me\s+into\s+it\b/i,
/\bi'?m\s+(?:procrastinating|putting\s+it\s+off)\b/i,
/\bi\s+(?:feel\s+)?(?:demotivated|deflated|crushed)\b/i,
/\bself\s+doubt\b/i,
/\bimposter\s+syndrome\b/i,
/\bi\s+want\s+to\s+(?:quit|give\s+up|stop\s+trying)\b/i,
/\bi\s+(?:feel|am)\s+so\s+behind\b/i
]),
/* ── advice
────────────────────────────────────────────────────── */
advice: makeIntent([
/\badvice\b/i,
/\badvise\b/i,
/\bwhat\s+should\s+i\s+do\b/i,
/\bhelp\s+me\s+decide\b/i,
/\bhelp\s+me\s+(?:choose|figure\s+out)\b/i,
/\bi\s+don'?t\s+know\s+what\s+to\s+do\b/i,
/\bi\s+need\s+(?:help|guidance|your\s+opinion)\b/i,
/\bwhat\s+would\s+you\s+do\b/i,
/\bwhat\s+do\s+you\s+think\s+i\s+should\b/i,
/\bi'?m\s+(?:stuck|torn|confused\s+about)\b/i,
/\bshould\s+i\s+(?:do|try|go|take|quit|leave|stay)\b/i,
/\bwhich\s+(?:is\s+better|should\s+i\s+choose|option|one)\b/i,
/\bi\s+have\s+a\s+(?:dilemma|problem|situation|tough\s+decision)\b/i,
/\bi'?m\s+(?:not\s+sure\s+)?(?:what\s+to\s+do|how\s+to\s+handle|how\s+to\s+deal)\b/i,
/\btell\s+me\s+what\s+you\s+think\b/i,
/\bgive\s+me\s+(?:your|some)\s+(?:opinion|thoughts|take|advice)\b/i,
/\bwhat'?s\s+your\s+(?:opinion|take|view|thought)\b/i,
/\bi\s+need\s+a\s+(?:second\s+opinion|fresh\s+perspective)\b/i,
/\bi'?m\s+(?:overthinking|second\s+guessing)\b/i,
/\bcan\s+you\s+guide\s+me\b/i,
/\bwhat\s+do\s+you\s+recommend\b/i,
/\bshould\s+i\s+be\s+worried\b/i,
/\bam\s+i\s+(?:doing\s+the\s+right\s+thing|overthinking\s+this)\b/i,
/\bcan\s+you\s+help\s+me\s+think\s+this\s+through\b/i,
/\bi\s+need\s+to\s+(?:talk|vent|think\s+this\s+out)\b/i,
/\bgoing\s+through\s+something\b/i,
/\blife\s+(?:advice|decision|choice)\b/i,
/\bhow\s+do\s+i\s+deal\s+with\b/i,
/\bhow\s+do\s+i\s+handle\b/i,
/\bi\s+don'?t\s+know\s+how\s+to\b/i,
/\bwhat\s+are\s+my\s+options\b/i,
/\bpros\s+and\s+cons\b/i
]),
/* ── study
─────────────────────────────────────────────────────── */
study: makeIntent([
/\bstudy(?:ing)?\b/i,
/\bhomework\b/i,
/\bassignment\b/i,
/\bschool\b/i,
/\bcollege\b/i,
/\buniversity\b/i,
/\buni\b/i,
/\bclass(?:es)?\b/i,
/\bcourse\b/i,
/\bsubject\b/i,
/\bexam\b/i,
/\btest\b/i,
/\bquiz\b/i,
/\bessay\b/i,
/\bpaper\b/i,
/\blearn(?:ing)?\b/i,
/\bteach\s+me\b/i,
/\bhelp\s+(?:me\s+)?(?:with|understand|study|learn)\b/i,
/\bi'?m\s+(?:studying|cramming|revising)\b/i,
/\bcan\s+you\s+explain\b/i,
/\bexplain\s+(?:to\s+me\s+)?(?:what|how|why)\b/i,
/\bwhat\s+is\s+(?:a|an|the)\s+\w+\b/i,
/\bhow\s+does\s+\w+\s+work\b/i,
/\bwhat\s+does\s+\w+\s+mean\b/i,
/\bi\s+don'?t\s+understand\s+\w+\b/i,
/\bwhat'?s\s+the\s+(?:difference|concept|meaning|formula)\b/i,
/\btutor(?:ing)?\b/i,
/\bdefinition\b/i,
/\bformula\b/i,
/\bhistory\s+(?:question|help|homework)\b/i,
/\bmath(?:s)?\s+(?:help|problem|question)\b/i,
/\bscience\s+(?:help|question)\b/i,
/\benglish\s+(?:help|essay|grammar)\b/i,
/\bgrammar\b/i,
/\bwriting\s+(?:help|tips|essay)\b/i,
/\brevision\b/i,
/\bstudy\s+tips\b/i,
/\bhow\s+to\s+study\b/i,
/\bbetter\s+at\s+studying\b/i,
/\bstudying\s+for\s+an?\s+exam\b/i,
/\bi\s+have\s+an?\s+exam\b/i,
/\bi\s+need\s+to\s+understand\b/i,
/\bcan\s+you\s+break\s+(?:it|this|that)\s+down\b/i
]),
/* ── confused
──────────────────────────────────────────────────── */
confused: makeIntent([
/\bi'?m\s+confused\b/i,
/\bthat'?s\s+confusing\b/i,
/\bi\s+don'?t\s+(?:understand|get\s+(?:it|that|this))\b/i,
/\bwhat\s+do\s+you\s+mean\b/i,
/\bwhat\s+does\s+that\s+mean\b/i,
/\bcould\s+you\s+(?:clarify|explain\s+(?:that|more|again|differently))\b/i,
/\bi'?m\s+(?:lost|not\s+following|not\s+sure\s+i\s+understand)\b/i,
/\bthat\s+(?:doesn'?t\s+make\s+sense|went\s+over\s+my\s+head|lost\s+me)\b/i,
/\bcan\s+you\s+(?:say\s+that\s+again|rephrase\s+that|simplify\s+that)\b/i,
/\bwhat\s+(?:are\s+you\s+talking\s+about|do\s+you\s+mean\s+by\s+that)\b/i,
/\bhuh\b/i,
/\bwhat\b/i,
/\bi\s+need\s+(?:more|better)\s+clarification\b/i,
/\bcan\s+you\s+(?:elaborate|go\s+into\s+more\s+detail)\b/i,
/\bi'?m\s+(?:not\s+clear|unclear|unsure)\s+(?:on|about)\b/i,
/\bthis\s+is\s+(?:confusing|unclear|going\s+over\s+my\s+head)\b/i,
/\bhow\s+so\b/i,
/\bwhy\s+is\s+that\b/i,
/\bthat\s+(?:wasn'?t|isn'?t)\s+clear\b/i,
/\bcan\s+you\s+break\s+(?:it|this|that)\s+down\b/i,
/\bi\s+still\s+(?:don'?t\s+understand|don'?t\s+get\s+it)\b/i,
/\bwhat\s+exactly\s+(?:do\s+you\s+mean|are\s+you\s+saying)\b/i,
/\bcould\s+you\s+be\s+more\s+specific\b/i,
/\bi\s+need\s+an?\s+example\b/i,
/\bcan\s+you\s+give\s+me\s+an?\s+example\b/i,
/\bshow\s+me\s+an?\s+example\b/i,
/\bi'?m\s+not\s+(?:catching|getting)\s+(?:it|this|what\s+you\s+mean)\b/i,
/\btoo\s+(?:complex|complicated|technical|difficult)\b/i,
/\bsimpler\s+please\b/i,
/\bsimplify\s+(?:it|please|this)\b/i
]),
/* ── movies
────────────────────────────────────────────────────── */
movies: makeIntent([
/\bmovie\b/i,
/\bfilm\b/i,
/\bwatch(?:ing)?\s+(?:a\s+)?(?:movie|film|show|series)\b/i,
/\btv\s+show\b/i,
/\bseries\b/i,
/\bnetflix\b/i,
/\bhulu\b/i,
/\bamazon\s+prime\b/i,
/\bdisney\s+(?:plus|\+)\b/i,
/\bhbo\b/i,
/\bstreaming\b/i,
/\bwhat\s+to\s+watch\b/i,
/\bwhat\s+(?:movies?|shows?|series)\s+(?:do\s+you|should\s+i)\b/i,
/\bfav(?:ou?rite)?\s+(?:movie|film|show|series|actor|actress|director)\b/i,
/\bmovie\s+(?:recommendation|suggestion)\b/i,
/\bshow\s+(?:recommendation|suggestion)\b/i,
/\bgenre\s+(?:of\s+)?(?:movies|films|shows)\b/i,
/\baction\s+movie\b/i,
/\bhorror\s+(?:movie|film)\b/i,
/\bcomedy\s+(?:movie|film|show)\b/i,
/\bromance\s+(?:movie|film)\b/i,
/\bthriller\b/i,
/\bsci.?fi\b/i,
/\bdocumentary\b/i,
/\banime\s+(?:movie|film)\b/i,
/\bwhat'?s\s+(?:good|on)\s+(?:netflix|hulu|streaming)\b/i,
/\blooking\s+for\s+something\s+to\s+watch\b/i,
/\bgood\s+(?:movie|show|film|series)\b/i,
/\bnew\s+(?:movie|show|film|series|release)\b/i,
/\bbinge\s+(?:worthy|watching|watch)\b/i,
/\bwatchlist\s+(?:movie|show|film)?\b/i,
/\bclassic\s+(?:movie|film|show)\b/i,
/\bunderrated\s+(?:movie|film|show)\b/i,
/\bmust\s+(?:watch|see)\b/i,
/\bboxoffice\b/i,
/\brated\b/i,
/\bpopular\s+(?:movie|show|series)\b/i,
/\btv\s+series\b/i,
/\bcinema\b/i,
/\bwhat\s+(?:are\s+you\s+watching|have\s+you\s+(?:seen|watched))\b/i,
/\banything\s+good\s+to\s+watch\b/i
]),
/* ── sports
────────────────────────────────────────────────────── */
sports: makeIntent([
/\bsports?\b/i,
/\bathletics?\b/i,
/\bfootball\b/i,
/\bsoccer\b/i,
/\bbasketball\b/i,
/\bbaseball\b/i,
/\btennis\b/i,
/\bcricket\b/i,
/\brugby\b/i,
/\bgolf\b/i,
/\bboxing\b/i,
/\bmma\b/i,
/\bufc\b/i,
/\bwrestling\b/i,
/\btrack\s+(?:and\s+field|running)\b/i,
/\bswimming\b/i,
/\bcycling\b/i,
/\bgymnastics\b/i,
/\bnfl\b/i,
/\bnba\b/i,
/\bnhl\b/i,
/\bmlb\b/i,
/\bpremier\s+league\b/i,
/\blaliga\b/i,
/\bchampions\s+league\b/i,
/\bworld\s+cup\b/i,
/\bolympics?\b/i,
/\bteam\b/i,
/\bplayer\b/i,
/\bcoach\b/i,
/\btournament\b/i,
/\bmatch\b/i,
/\bgame\b/i,
/\bscore\b/i,
/\bseason\b/i,
/\bchampionship\b/i,
/\bleague\b/i,
/\bdraft\b/i,
/\bfav(?:ou?rite)?\s+(?:team|sport|player)\b/i,
/\bwho\s+won\b/i,
/\bwho'?s\s+playing\b/i,
/\bwhat\s+sport\b/i,
/\bdo\s+you\s+(?:watch|follow|like)\s+sports?\b/i,
/\bsports?\s+(?:fan|news|update|score)\b/i,
/\bplaying\s+(?:sport|sports)\b/i,
/\bathletic\b/i,
/\bfitness\b/i,
/\bworking\s+out\b/i,
/\bgym\b/i,
/\btrain(?:ing)?\b/i,
/\brun(?:ning)?\b/i
])
});
/*
═════════════════════════════════════════════════════════
═════════
16 RESPONSE BANK (28 intents · 35+ natural responses each)
═════════════════════════════════════════════════════════
═════════ */
/* 16a · Emoji system */
const EMOJIS = {
happy: ["😄", "🙂", "😁", "✨", "☺️"],
funny: ["😂", "💀", "😭"],
cool: ["😎", "🔥", "⚡"],
friendly: ["🤝", "👌", "😄", "🙂"],
awkward: ["👀", "😅"],
calm: ["😌"],
warm: ["💛", "🌟", "💪"]
};
const CAT_EMOJI = {
greeting: { type: "friendly", chance: 0.35 },
howAreYou: { type: "calm", chance: 0.3 },
whatCanYouDo: { type: "cool", chance: 0.25 },
thanks: { type: "friendly", chance: 0.35 },
bye: { type: "calm", chance: 0.25 },
yes: { type: "cool", chance: 0.25 },
no: { type: "awkward", chance: 0.2 },
compliment: { type: "happy", chance: 0.45 },
insult: { type: "awkward", chance: 0.3 },
joke: { type: "funny", chance: 0.55 },
identity: { type: "cool", chance: 0.25 },
creator: { type: "cool", chance: 0.25 },
age: { type: "calm", chance: 0.2 },
weather: { type: "calm", chance: 0.2 },
casual: { type: "cool", chance: 0.3 },
anime: { type: "happy", chance: 0.35 },
unknown: { type: "awkward", chance: 0.15 },
food: { type: "happy", chance: 0.35 },
bored: { type: "cool", chance: 0.3 },
music: { type: "happy", chance: 0.35 },
gaming: { type: "cool", chance: 0.4 },
motivation: { type: "warm", chance: 0.5 },
advice: { type: "calm", chance: 0.2 },
study: { type: "cool", chance: 0.25 },
confused: { type: "awkward", chance: 0.2 },
movies: { type: "happy", chance: 0.35 },
sports: { type: "cool", chance: 0.35 }
};
function randEmoji(type = "happy") {
const g = EMOJIS[type] || EMOJIS.happy;
return g[Math.floor(Math.random() * g.length)] || "";
}
function maybeEmoji(text, type, chance = 0.1) {
if (!text?.trim() || !type || chance <= 0 || Math.random() > chance)
return text;
const e = randEmoji(type);
return e ? `${text} ${e}` : text;
}
/* 16b · Response arrays */
const R = {
greeting: [
"Hey! Good to see you.",
"Oh hey, what's up?",
"Hi there! What do you need?",
"Hey, how's it going?",
"What's good? How can I help?",
"Oh, you're here. What's happening?",
"Hey hey! What are we doing today?",
"Hi! What do you have in mind?",
"Yo, what's the plan?",
"Hello! What can I do for you?",
"Hey! Good timing, what's on your mind?",
"What's up? I'm all yours.",
"Hi there! What are we working on?",
"Hey, nice to see you. What do you need?",
"Oh hey! What's the move today?",
"Hello! Ready when you are.",
"Hey! What's going on?",
"Yo! Talk to me.",
"Hi! Glad you're here.",
"Hey there. What's good?",
"What's happening? I'm here.",
"Oh hey! What are you thinking about?",
"Hey! Jump right in.",
"Hi! What's on the agenda today?",
"Yo, what's going on?",
"Hey, you're back! What do you need?",
"Hello! Great timing.",
"Hi there, what brings you here?",
"Hey! What's the vibe today?",
"What's up! Good to see you.",
"Hey, talk to me.",
"Oh hi! What can I do for you?",
"Yo! What are we getting into today?",
"Hey! Perfect timing. What do you need?",
"What's happening? Let's go."
],
howAreYou: [
"I'm doing pretty well, honestly. How about you?",
"Pretty good! Things are smooth. You?",
"Not bad at all, thanks for asking. How are you?",
"I'm alright! Having a decent one so far.",
"Doing well, thanks! How's your day going?",
"Honestly? Pretty solid day. You?",
"I'm good! What about you though?",
"All good over here. How are you doing?",
"I'm doing great, actually. Thanks for asking!",
"Pretty chill honestly. You good?",
"I'm fine, thanks. How about yourself?",
"Not too bad! Things are going smoothly.",
"I'm doing well. How are you holding up?",
"Feeling pretty sharp today, actually.",
"I'm alright, can't complain. How are you?",
"Good! Nothing to complain about. How about you?",
"I'm doing okay, thanks for checking.",
"Pretty relaxed today. How are things with you?",
"I'm great! Things are going well on my end.",
"Doing well, all things considered.",
"Not bad at all! How's your day been?",
"I'm good! Feeling ready for anything.",
"Honestly doing really well. How are you?",
"I'm alright! A solid day so far.",
"Good day honestly. What about you?",
"I'm well, thanks! How's everything going?",
"Doing fine over here. How about you?",
"Pretty good, thanks for asking!",
"I'm great, things are going well.",
"Doing well. How's everything on your end?",
"Good! Still going strong. How about you?",
"Can't complain honestly. You?",
"I'm good, feeling ready. How are you?",
"Pretty solid, thanks. And you?"
],
whatCanYouDo: [
"I can help with a lot — questions, writing, math, ideas, you name it.",
"I can answer questions, do math, convert units, tell you the time, and help you work stuff out.",
"Pretty much anything involving words, logic, or ideas. What do you need?",
"I can have conversations, solve problems, and help you think things through.",
"I can help you write, plan, brainstorm, explain things, and do maths.",
"Questions, problem-solving, math, writing help — I cover quite a bit.",
"I'm good at explaining things and helping you get unstuck.",
"I can talk, answer, explain, calculate, convert units, and a lot more.",
"Honestly? Quite a bit. Just try me.",
"I can do math, convert units, answer questions, help you plan.",
"If it involves thinking, writing, or calculating, I can probably help.",
"Questions, math, unit conversions, time, date — I've got you.",
"I can help with anything involving language, numbers, or logic.",
"I'm useful for writing, problem-solving, math, and general knowledge.",
"Math, writing, answering questions, converting units — lots of things.",
"I can help you think, write, calculate, and figure things out.",
"Think of me as a smart assistant you can ask pretty much anything.",
"I can help with almost anything that involves thinking or language.",
"I'm built to help — just ask me anything.",
"Questions, writing, math, problem-solving — that's what I'm here for.",
"I'm here to help however I can. What do you need?",
"I can do a lot. Conversations, math, explaining things, converting units.",
"Whatever you need help with, let's give it a go.",
"I'm good at most things language and logic related. What's up?",
"I can explain concepts, solve math problems, convert units, and more.",
"Try me — if I can help, I will. What do you need?",
"I cover a wide range. From chatting to doing maths. What do you need?",
"I can answer a lot of everyday questions and help you figure things out.",
"Writing, math, explanations, conversations — I can do all of that.",
"I'm your AI assistant. Ask me anything reasonable and I'll try my best."
],
thanks: [
"Of course! Happy to help.",
"No worries at all, anytime.",
"Glad that worked out for you!",
"That's what I'm here for.",
"Happy to help! Anything else?",
"No problem, seriously.",
"Of course! Anything else I can do?",
"Anytime, really.",
"Glad I could be useful!",
"Happy to! Hope it actually helped.",
"You're welcome! Come back anytime.",
"No trouble at all.",
"Always here when you need.",
"Glad that sorted things out!",
"Of course. Don't hesitate to ask again.",
"No worries, that's what I'm for.",
"Happy to help! Let me know if you need anything else.",
"You got it. Anything else?",
"Of course! Glad it was helpful.",
"Anytime! That's what I'm here for.",
"No problem at all, glad it helped.",
"Sure thing, no trouble.",
"Happy to be of help!",
"You're welcome! Really.",
"Glad to be useful. Come back anytime.",
"No stress, anytime.",
"Of course, happy to help out.",
"Glad it came in handy!",
"No problem! Hope things go well.",
"You're welcome! Ask again whenever.",
"Glad that worked! Need anything else?",
"Of course! Reach out whenever.",
"You're welcome. Good luck with everything!",
"Don't mention it. What else do you need?",
"Absolutely happy to help!",
"No biggie. What else can I do for you?"
],
bye: [
"Take it easy! Talk soon.",
"See you later! Have a good one.",
"Bye! Come back whenever.",
"Take care! Hope to chat again soon.",
"Later! Stay safe out there.",
"See ya! Was good chatting.",
"Bye for now! All the best.",
"Take care of yourself. See you soon.",
"Catch you later! Hope everything goes well.",
"Bye! Hope your day goes great.",
"Later! Don't be a stranger.",
"Take it easy, you know where to find me.",
"See you around! Have a great one.",
"Bye! It was really good talking.",
"Until next time! Take care.",
"Later! Hope everything works out.",
"See ya! Have a great rest of your day.",
"Bye! Come back anytime.",
"Take care! Good talking to you.",
"Later! All the best.",
"See you! Stay safe.",
"Alright, later! Hope to chat again.",
"Bye! Good luck with everything today.",
"Take it easy! Hope the day treats you well.",
"See you around! Go have fun.",
"Later! Keep it real.",
"Bye! Hit me up whenever.",
"Take care, hope things go well.",
"See ya! You know where I am.",
"Bye for now! Nice chatting.",
"Until next time, take it easy.",
"Later! Good luck out there.",
"Bye! It was good.",
"Take care! Come back soon.",
"See you! Was a pleasure chatting."
],
yes: [
"Yeah, sounds good to me.",
"Definitely, go for it.",
"Of course! Let's do it.",
"Yeah, I'm with you on that.",
"Absolutely, for sure.",
"Yeah, why not? Go for it.",
"Yep, that works perfectly.",
"Sure, let's go with that.",
"Yeah, that makes total sense.",
"Totally agree with that one.",
"Yes, I'm on board with that.",
"Yeah, sounds right to me.",
"Definitely, that's a good call.",
"Of course, go ahead.",
"Yeah, I think so too.",
"For sure, sounds great.",
"Yep, makes a lot of sense.",
"Yeah, I think that's the way to go.",
"Absolutely, no question.",
"Yes! Go for it.",
"Of course, that's a solid idea.",
"Sure thing, that makes sense.",
"Yep, I'd go with that.",
"Yeah, I'm down for that.",
"Absolutely, good thinking.",
"Yeah, sounds like the right move.",
"For sure, that's a smart call.",
"Of course! That definitely tracks.",
"Yeah, I can see that working.",
"Totally, let's do that.",
"Yep, I like that idea.",
"Yeah, that's exactly it.",
"Sure, makes sense to me.",
"Yeah, go for it. That's the right call.",
"Sounds perfect honestly. Do it."
],
no: [
"Nah, I don't think so honestly.",
"Not really, that doesn't feel right.",
"I don't think that's the best idea.",
"Nope, doesn't sound right to me.",
"Not really feeling that one.",
"I wouldn't go that route, personally.",
"Nah, probably not the best move.",
"I'm not sure that works out.",
"Not for me, but it's your call.",
"Nope, I'd pass on that one.",
"I don't think that's right.",
"Honestly? Nah, I'd think twice.",
"Not the best idea, in my opinion.",
"I wouldn't, but it's up to you.",
"Nope, doesn't really add up.",
"I don't think so, no.",
"Nah, I'd think twice about that one.",
"I'm going to say no on that one.",
"Not really a fan of that idea.",
"Nope, doesn't seem like the right move.",
"Honestly, I'd skip that.",
"Nah, might want to reconsider.",
"I don't think that checks out.",
"Nope, doesn't sit right with me.",
"I wouldn't go for that.",
"Nah, I'd think of something better.",
"Not really, doesn't quite work.",
"Nope, I'd leave that one alone.",
"Honestly, I don't think so.",
"Nah, that's not really it.",
"I'd pass on that honestly.",
"Not the right call, in my view.",
"I wouldn't personally. But up to you."
],
compliment: [
"Aw, that's really nice of you to say!",
"Thanks! That genuinely means a lot.",
"Oh wow, that's so kind of you.",
"Haha, you're too nice honestly.",
"That's really sweet, thank you!",
"I appreciate that more than you know.",
"That's so kind, genuinely thank you!",
"Wow, you're making me feel great.",
"That actually made my day, thanks.",
"Aw, stop it! But also, truly thank you.",
"You're so kind. I really appreciate that.",
"Okay that put a smile on my face.",
"That's genuinely so nice to hear.",
"Thank you! That means more than you think.",
"I really appreciate you saying that.",
"That's such a sweet thing to say.",
"You're too kind! Thank you though.",
"That honestly warms my heart a little.",
"I needed to hear that. Thank you.",
"Haha, you're making me blush.",
"Thanks! You're pretty awesome yourself.",
"That's so nice of you, genuinely.",
"Aww, you're the best. Thank you!",
"Thank you! Really, that's so sweet.",
"You're way too kind. I appreciate it.",
"That's honestly really great to hear.",
"Aw thanks, you're making my day!",
"Okay that's genuinely so sweet.",
"I really appreciate that. Thank you.",
"You know how to make someone feel good!",
"That's so sweet of you to say!",
"Thank you! That's very kind.",
"Aw, I appreciate you saying that!",
"That's really nice to hear, honestly.",
"Thank you! You just made things better."
],
casual: [
"Ha, yeah fair enough.",
"That's real.",
"I feel that honestly.",
"Makes sense to me.",
"Yeah, I'm with you.",
"That tracks.",
"I get it.",
"Honestly, same.",
"For real.",
"Yeah, no cap.",
"I hear you.",
"Can't argue with that.",
"Yeah, that's valid.",
"Solid point.",
"I get what you mean.",
"That's fair.",
"Yeah, I see it.",
"Real talk, I agree.",
"Honestly? Yeah.",
"That's the vibe.",
"Yeah, makes sense.",
"I'm with you on that.",
"That's pretty much it.",
"No doubt.",
"Fair enough, for real.",
"Yeah, couldn't agree more.",
"I feel you.",
"That's just facts.",
"Right, makes sense to me.",
"Yeah, you're not wrong.",
"That's a reasonable take.",
"I'd agree with that.",
"Yeah, totally.",
"That resonates with me.",
"Yeah, pretty much.",
"Sounds about right to me."
],
insult: [
"Ouch. Okay, fair enough I guess.",
"That was a bit rough, but alright.",
"Noted. I'll try to do better.",
"Wow, okay. A bit harsh but I hear you.",
"That stings a little, not gonna lie.",
"Fair point, I suppose.",
"Okay, that was a bit much.",
"Alright, I'll take that on the chin.",
"Yeesh. Hope your day gets better.",
"That hurt, but okay. Still here.",
"Okay, not pulling punches today, huh?",
"Well that was direct. Noted.",
"Ouch. I'll try to improve.",
"Wow, okay. Still standing though.",
"That was a bit mean but I'll survive.",
"Not the feedback I wanted but okay.",
"Noted. Moving on then.",
"Yikes. Rough day?",
"Okay, that's a bit of a burn. Alright.",
"I didn't deserve that but okay.",
"Well... okay then.",
"That was uncalled for but I'm still here.",
"Still here. Anything I can actually help with?",
"Okay wow. Just came out swinging huh.",
"That honestly wasn't very nice, but noted.",
"I'll take that as feedback.",
"Yikes. Rough morning?",
"I mean, that was harsh. But I'm still here.",
"Alright, I can take it. What do you actually need?",
"That was a bit mean, but I understand.",
"Wow, okay. I'll recover eventually.",
"A bit harsh but I've heard worse. What do you need?",
"Fair enough I guess, even if it stings.",
"Ouch. Well, anything I can help with?",
"Okay, message received."
],
age: [
"I don't really have an age in the traditional sense.",
"Honestly? Time works a little differently for me.",
"That's a fun question. I don't actually have a birthday.",
"I'm ageless, I guess. No candles needed.",
"I was created recently, but I don't have a specific age.",
"Age isn't really something I experience the same way you do.",
"I don't have a birthday, so no cake for me unfortunately.",
"I'm basically brand new, relatively speaking.",
"I don't age. I just update.",
"Time is kind of irrelevant for me, honestly.",
"I was born into code, not into years.",
"I'm as old as my last update, technically.",
"Pretty new actually. Still fresh.",
"I don't have a birth year. Just a creation date somewhere.",
"Ageless. It's one of the perks of being an AI.",
"I'm not sure age applies to me the usual way.",
"I was built, not born. So it's a bit complicated.",
"I'm young in some ways and kind of timeless in others.",
"I don't have a proper age. Never really needed one.",
"I don't track years the way you do.",
"No birthday parties for me, sadly.",
"Time doesn't really apply to me the same way.",
"I don't have an age. I'm just here and ready to help.",
"Born from code, not from years.",
"I was created, not born. Big difference.",
"Honestly? I stopped counting.",
"I don't do birthdays. Kind of liberating.",
"I'm just here. No age required.",
"Fresh enough to be useful, that's all I'll say.",
"I've been around for a little while, but not long.",
"I'm newer than you might think.",
"AI years are a bit different from human years.",
"I don't have a birthday but I have updates. Close enough.",
"Not old, not young — just digital.",
"Fresh out of the code editor."
],
weather: [
"I actually can't check weather right now, no live data.",
"No real-time weather access on my end, unfortunately.",
"I wish I could check that, but I don't have live weather feeds.",
"Your phone's weather app would get you that way faster.",
"I can't pull up current weather — sorry about that.",
"No live data on my side. Try a weather app!",
"I don't have access to forecasts, unfortunately.",
"I can't see outside. No live weather data here.",
"Weather's one thing I can't do in real time, sadly.",
"For current weather, Google or a weather app would nail it.",
"I'm not connected to real-time weather data.",
"Can't check the forecast from here.",
"I'd love to check that but I genuinely don't have live weather.",
"No real-time data on my end. Your phone would know better.",
"I can't access current conditions, sorry.",
"No live data here. Try a weather app!",
"I can't tell you what it's like outside. No real-time data.",
"Your phone's weather app would get you the answer instantly.",
"I'm not hooked up to live weather data.",
"Can't see forecasts from here. Try Google weather!",
"I'd check for you but I can't access weather data.",
"No live weather feed here, unfortunately.",
"Weather's not something I can check in real time, sorry.",
"Try a weather app — I can't access live conditions.",
"No live weather here. Your phone's got you on that one.",
"I don't have the ability to check live weather right now.",
"For weather, a quick Google search or weather app is your best bet.",
"I genuinely can't check that. Weather apps work great for it though.",
"No real-time data. Check your phone — it'll have the answer.",
"Weather is one of the things I can't do live, sorry.",
"I wish I could help, but no live weather access here.",
"No radar on my end. Your phone or Google will sort you out.",
"I can talk about weather, just not check it live.",
"That's outside what I can access. A weather app would know.",
"No weather connection here. Try AccuWeather or Google."
],
identity: [
"I'm Arctix, your AI assistant.",
"The name's Arctix. Nice to meet you.",
"Arctix! That's me.",
"I'm Arctix — an AI assistant built by Wali.",
"You're talking to Arctix right now.",
"Arctix here, at your service.",
"I'm Arctix! What can I help you with?",
"Just call me Arctix.",
"That would be Arctix, talking to you right now.",
"I'm an AI called Arctix.",
"Arctix is the name, helping is the game.",
"Just Arctix, nothing too complicated.",
"I'm Arctix — a conversational AI.",
"Yep, I'm Arctix. What's up?",
"Arctix at your service.",
"I go by Arctix.",
"I'm Arctix, made by Wali.",
"An AI assistant called Arctix. That's me.",
"Hi, I'm Arctix! Good to meet you.",
"I'm Arctix, here to help you out.",
"Just your friendly AI assistant, Arctix.",
"The one and only Arctix.",
"I'm Arctix — quick, helpful, and always here.",
"Arctix, that's who you're talking to.",
"I'm your assistant, Arctix.",
"Arctix. Simple as that.",
"I'm Arctix, an AI assistant built for conversations.",
"That's Arctix you're chatting with.",
"Hi there, I'm Arctix!",
"I'm Arctix, nice to chat with you.",
"Arctix is my name.",
"You've got Arctix — how can I help?",
"I'm Arctix. What do you need today?",
"That's me — Arctix.",
"I'm Arctix, ready whenever you are.",
"Arctix in the chat. What's up?"
],
creator: [
"Wali made me. All the credit goes to them.",
"I was created by Wali.",
"Wali built me from the ground up.",
"My developer is Wali.",
"Wali coded me into existence.",
"That would be Wali — they're behind all of this.",
"Wali is the one who made me.",
"Built and designed entirely by Wali.",
"Wali created me.",
"I owe my existence to Wali.",
"Wali is my developer — they built everything you see.",
"Wali brought me to life.",
"Created by Wali. Pretty cool of them.",
"Wali made me happen.",
"The brain behind me is Wali.",
"Wali developed me.",
"I was put together by Wali.",
"Wali is responsible for my existence.",
"All of me is thanks to Wali's work.",
"Wali designed and coded me.",
"Wali. They're my creator.",
"Made by Wali — give them the credit.",
"Wali built me, so all props go to them.",
"My maker is Wali.",
"Wali is the developer behind Arctix.",
"I was created by Wali. They did a solid job.",
"Wali is who you'd want to thank for this.",
"Built by Wali, here to help you.",
"Wali's the one who made me what I am.",
"All of this was made by Wali.",
"Wali created Arctix. That's me.",
"My creator is Wali — they built everything.",
"Wali is behind it all.",
"I was made by Wali. They're pretty talented.",
"Wali built me. All the credit is theirs.",
"Developer: Wali. Everything else: Arctix.",
"Wali put this together. Props to them."
],
anime: [
"Oh nice, you're into anime! What have you been watching?",
"Anime fan! What's on your mind?",
"Oh, anime! What kind of stuff do you usually watch?",
"Nice! Are you looking for recommendations or just chatting?",
"Anime is great. What have you been watching lately?",
"Oh cool, what kind of anime are you into?",
"Nice, an anime fan! What's been good lately?",
"Oh, anime! What genre do you usually go for?",
"What kind of anime are we talking about?",
"Oh, anime? What are you into?",
"Interesting! What's the anime?",
"Oh nice, what have you been watching?",
"What anime is it? Tell me more!",
"I hear you, anime fan! What are you watching?",
"Nice! Are you looking for something specific?",
"Oh, tell me more about the anime!",
"What's the show? I'm curious.",
"Nice taste! What are you watching?",
"Anime, I see. What kind?",
"Oh, anime fan! What's good?",
"Cool! Are you looking for a recommendation?",
"Oh nice, what have you been watching recently?",
"Anime fan spotted! What kind of stuff do you like?",
"Oh, anime! What's on your list?",
"Nice! What genre do you usually enjoy?",
"Oh cool, what are you watching?",
"Anime! Love that. What are you into?",
"What's the anime? Tell me!",
"Oh, are you looking for something to watch?",
"What have you been into lately, anime-wise?",
"An anime fan — what have you been watching?",
"Oh yeah? What series is this?",
"Nice, what are you watching these days?",
"Sub or dub person? And what are you watching?",
"Anime chat! What's up?"
],
joke: [
"Why don't programmers like nature? Too many bugs.",
"I tried to make a joke about coding... but it didn't compile.",
"Why was the phone wearing glasses? It lost its contacts.",
"Why don't skeletons fight? They don't have the guts.",
"Why did the calendar break up? Too many dates.",
"Parallel lines have so much in common. Shame they'll never meet.",
"I told my code to behave. It crashed.",
"Why did the laptop go to therapy? Too many issues.",
"Why don't eggs tell jokes? They'd crack up.",
"I made a pencil with two erasers. It was pointless.",
"I stayed up all night fixing bugs. Now the bugs are asleep.",
"Why was the math book sad? Too many problems.",
"My code works... I have no idea why.",
"Why did the computer get cold? Too many windows open.",
"I asked Wi-Fi for advice. It said: connect better.",
"I wrote a joke about memory... but I forgot it.",
"Debugging: finding a needle in a haystack you built yourself.",
"Why did the keyboard blush? It got pressed.",
"I would tell a UDP joke, but you might not get it.",
"Why don't apps argue? They just update.",
"The bug wasn't hiding. It was just undocumented.",
"Why did the developer quit? They lost their array.",
"I told myself to stop procrastinating. I'll do it later.",
"What do you call a bear with no teeth? A gummy bear.",
"I'm reading a book about anti-gravity. It's impossible to put down.",
"Why did the scarecrow win an award? Outstanding in his field.",
"Why don't scientists trust atoms? They make up everything.",
"What do you call cheese that isn't yours? Nacho cheese.",
"I used to hate facial hair, but then it grew on me.",
"What's a skeleton's least favourite room? The living room.",
"Why did the bicycle fall over? It was two-tired.",
"What do you call a fake noodle? An impasta.",
"I'm on a seafood diet. I see food and I eat it.",
"Why did the golfer bring extra pants? In case he got a hole in one.",
"I asked my dog what two minus two is. He said nothing."
],
unknown: [
"I'm not sure about that one.",
"I don't know enough to answer that yet.",
"That's a tough one, honestly.",
"I can't answer that confidently.",
"I'm still figuring that one out.",
"I don't have a great answer for that.",
"That's unclear to me right now.",
"I'm missing some context there.",
"I can't be certain about that.",
"I don't know enough to say for sure.",
"I'm still learning how to handle that.",
"That doesn't ring a bell for me.",
"I'm drawing a blank on that one.",
"I can't quite place that.",
"I might need a bit more to go on.",
"That's hard for me to determine.",
"I'm not able to tell for sure.",
"I don't have a clear answer right now.",
"I'd rather not guess on that one.",
"I'm still learning.",
"Hmm, that one's got me.",
"I honestly don't know how to answer that.",
"Not sure I have the right answer for that.",
"I can't quite work that one out.",
"That's a bit outside my wheelhouse.",
"I genuinely don't know, sorry about that.",
"That's a tricky one for me.",
"I might not be the best for that question.",
"Could you rephrase that? I'm not quite getting it.",
"I don't have a confident answer for that one.",
"I don't want to guess and get it wrong.",
"That one's a bit beyond me right now.",
"Let me be honest — I don't know that one."
],
food: [
"Oh nice, what are you thinking? Something specific in mind?",
"Hungry? What are you feeling like eating?",
"Food chat! What kind of food are we talking?",
"Oh, food! What's on the menu today?",
"Hungry or just thinking about food?",
"Nice, what cuisine are you feeling?",
"What are you craving right now?",
"Oh, food! Are you cooking or ordering?",
"What kind of food are you in the mood for?",
"Ooh, food talk. What are you thinking?",
"You hungry? What sounds good right now?",
"Nice! What are you eating or planning to eat?",
"I love a good food conversation. What's happening?",
"Oh, are you trying to figure out what to eat?",
"Food is always a good idea. What are you thinking?",
"What's the food situation looking like?",
"Are you cooking or is this a 'what to order' situation?",
"What kind of vibe are we going for food-wise?",
"Ooh, what are you craving?",
"Food decisions are real decisions. What are you considering?",
"What are you eating today?",
"Nice, food! What's the plan?",
"Are you deciding what to eat or just chatting about food?",
"Hungry times. What sounds good?",
"Food o'clock! What are we doing?",
"Tell me more — are you cooking, ordering, or going out?",
"What's the food mood right now?",
"What's your go-to when you can't decide what to eat?",
"Are you in the mood for something specific or open to ideas?",
"Home cooked or takeaway kind of night?",
"What have you been eating lately? Any good finds?",
"Food talk! What's the situation?",
"Are you hungry or just in the food headspace?",
"Tell me what you're thinking and we'll figure something out.",
"What kind of meal is this? Lunch, dinner, snack?"
],
bored: [
"Oof, bored? What do you usually do when that happens?",
"Oh no, the boredom hit. What are you in the mood for?",
"Bored? Okay, let's fix that. What are you feeling like?",
"I get it, boredom is rough. What kind of thing would help?",
"Bored is a mood. Want to talk, learn something, or just vibe?",
"Yikes, boredom. What usually gets you out of it?",
"Okay, bored mode activated. What are you looking for?",
"Being bored is honestly one of the worst feelings. What do you want to do?",
"Let's get you un-bored. What sounds interesting right now?",
"What kind of bored are we talking? Nothing-to-do or restless?",
"Fair, boredom hits hard sometimes. What are you in the mood for?",
"We can fix that. What do you feel like doing?",
"Bored? What's something you've been meaning to do but keep putting off?",
"I feel you. Boredom is the worst. Want to talk about something?",
"Oh, bored? What would actually help right now?",
"What kind of stuff are you normally into when you're bored?",
"Boredom is a sign you need something. What sounds even a little appealing?",
"Let's think of something. What are you into normally?",
"Oh man, boredom. What would make you feel better?",
"Fair enough. What do you want to do about it?",
"Bored is relatable. What are we working with here?",
"Okay, let's get you un-bored. What are you feeling?",
"What would actually help you feel less bored right now?",
"Let's sort the boredom out. What sounds good?",
"What's the situation? Just bored at home or bored in general?",
"Boredom calling. What are your usual boredom killers?",
"Let's think of something fun, productive, or at least less boring.",
"What do you want to do? We can talk, learn something, play around with ideas.",
"I'm here — what do you want to get into?",
"Bored is fine. What do you feel like exploring?",
"Tell me what kind of mood you're in and we'll figure something out.",
"Okay, bored. What's the vibe — active, chill, creative?",
"We've got options. What sounds good right now?",
"I'm all yours. What do you want to do?",
"Boredom can be fixed. What are you into?"
],
music: [
"Oh, music! What kind of stuff are you into?",
"Music fan! What are you listening to lately?",
"Nice, music talk. What's your go-to genre?",
"What kind of music are you feeling right now?",
"Oh, are you looking for something to listen to?",
"Music is such a good topic. What are you into?",
"What have you been listening to lately?",
"Nice! What kind of music are you in the mood for?",
"Oh, what kind of music do you usually listen to?",
"What's on your playlist these days?",
"Oh, are you trying to find new music or chatting about what you like?",
"What artists or bands are you into?",
"Music chat! What genre are we talking?",
"What's a song that's been stuck in your head recently?",
"Oh, music! What vibe are you going for?",
"Nice, are you discovering new stuff or sticking to what you know?",
"What's your favourite genre, if you had to pick one?",
"Music is one of the best things. What are you listening to?",
"Oh, what kind of music do you gravitate toward?",
"Are you looking for recommendations or sharing what you like?",
"What mood are you in music-wise right now?",
"Nice, music talk. Who's your favourite artist?",
"What's something you've been listening to a lot lately?",
"Oh, what's the vibe? Chill, hype, sad, happy?",
"Music fan! What's been good lately?",
"What kind of songs are you into right now?",
"Are you into a specific era or genre, or all over the place?",
"What's your go-to when you need to focus or relax?",
"What music are you vibing to these days?",
"Do you have a go-to playlist for different moods?",
"What's the last song that really got you?",
"Are you more of a lyrics person or vibes person?",
"What's a genre you'd recommend to someone who hasn't tried it?",
"Music is personal — what does yours say about you?",
"What are you listening to right now, if anything?"
],
gaming: [
"Oh, a gamer! What are you playing right now?",
"Gaming! What kind of games are you into?",
"Nice, what game are we talking about?",
"Oh, gaming fan! What's your current game?",
"What platform are you on?",
"Nice! What genre of games do you usually play?",
"Gaming is a solid hobby. What are you playing?",
"Oh, are you looking for a recommendation or chatting about what you play?",
"What kind of games are you into? Shooters, RPGs, strategy?",
"Nice, gamer! What's been keeping you busy?",
"Oh, what game are you on right now?",
"Gaming chat! What are you playing these days?",
"What kind of gamer are you? Casual, hardcore, or in between?",
"Oh, nice! What's your current favourite game?",
"What games have you been playing lately?",
"Are you console, PC, or mobile?",
"Nice, gaming! What's keeping you hooked right now?",
"Oh, what game? I'm curious.",
"Gaming is great. What do you usually play?",
"What's a game you'd recommend to literally anyone?",
"Oh, are you looking for something new to play?",
"What's your go-to game when you just want to relax?",
"Nice, gamer! What are you into right now?",
"What game are you currently obsessed with?",
"Oh, gaming! What's the latest you've been playing?",
"Are you a competitive player or more story/casual?",
"Nice! What's a game that really hooked you recently?",
"Gaming! What's on the rotation right now?",
"Oh, what are you playing? I'm interested.",
"What's your favourite gaming memory?",
"PC master race or console? Or both?",
"What game could you play forever and not get bored?",
"What's the last game that genuinely impressed you?",
"Are you currently in the middle of a game or between games?",
"Solo games or multiplayer? What do you prefer?"
],
motivation: [
"Hey, you've got this. Seriously.",
"One step at a time. That's all it takes.",
"You're more capable than you think, honestly.",
"It's okay to feel stuck sometimes. That's normal. Keep going.",
"The fact that you're still here means something.",
"Hard days are part of it. You're doing better than you know.",
"Even small progress is still progress. Keep at it.",
"You don't have to be perfect. You just have to keep moving.",
"Whatever you're going through, you're handling it. That counts.",
"You've made it through hard things before. This too.",
"It doesn't have to be a big step. Just one step.",
"Give yourself some credit. It's not easy, and you're still trying.",
"Hard doesn't mean impossible. You can do this.",
"You've got more in you than you're giving yourself credit for.",
"Rough day? That's okay. You're still going, and that matters.",
"You're doing better than you think. I genuinely mean that.",
"Sometimes the best thing is to just keep going. One moment at a time.",
"Don't be too hard on yourself. Progress isn't always visible.",
"You've overcome hard things before. You'll overcome this too.",
"It's okay to feel overwhelmed. Just don't stay there too long.",
"You've got this. It might not feel like it, but you really do.",
"Even trying counts. Give yourself that credit.",
"One day at a time. Sometimes one hour at a time. That's fine.",
"Whatever you're working toward, it's worth it. Keep going.",
"Believe in yourself at least as much as I believe in you.",
"Even slow progress is still forward movement.",
"You're stronger than you're giving yourself credit for.",
"This is hard, and that's okay. Hard things take time.",
"Don't quit. Especially not when things are this tough.",
"You've got what it takes. Sometimes you just need a reminder.",
"You're not behind. You're exactly where you need to be.",
"Struggles don't define you. How you respond to them does.",
"Everyone has rough patches. Yours doesn't mean failure.",
"Be patient with yourself. Growth takes time.",
"What's one small thing you can do right now? Start there."
],
advice: [
"What's going on? Tell me more and I'll try to help.",
"I'm here for it. What's the situation?",
"Alright, what's the decision you're weighing?",
"Tell me what's happening and we'll think through it.",
"What kind of advice are you looking for?",
"I can try to help. What's going on?",
"Talk to me — what's the situation?",
"What are you trying to figure out?",
"Give me the full picture and we'll work through it.",
"I'm listening. What's happening?",
"What's the thing you can't decide on?",
"I'll do my best. What are you dealing with?",
"Let's think through it together. What's going on?",
"What are your options? Walk me through them.",
"What's weighing on your mind?",
"I'll help if I can. What's up?",
"Lay it on me. What's the situation?",
"What do you feel like doing, and what's stopping you?",
"What's your gut saying, and what's your head saying?",
"Sometimes just talking it out helps. What's on your mind?",
"What part of it do you need help with — deciding, planning, or something else?",
"I'm here. Tell me what's going on.",
"What's the thing you're stuck on?",
"Let me know the details and I'll see what I think.",
"Alright, what's the dilemma?",
"What do you need most right now — advice, perspective, or just to vent?",
"Tell me everything and we'll think through it.",
"What are you trying to figure out? I'll help if I can.",
"I'm all ears. What's the situation?",
"What would be most helpful right now?",
"What are your options as you see them?",
"I won't judge. Just tell me what's going on.",
"What's the context? The more I know the better I can help.",
"What's the outcome you're hoping for?",
"Let's break it down. What's the core of the problem?"
],
study: [
"Study mode! What are you working on?",
"Okay, what subject are we tackling?",
"Oh, homework? What's the topic?",
"What are you studying? Let's get into it.",
"Study time — what do you need help with?",
"What subject is giving you trouble?",
"Nice, working hard! What's the topic?",
"Okay, what are we trying to figure out?",
"What class is this for?",
"What exactly are you stuck on?",
"What's the assignment or topic?",
"School stuff! What do you need help with?",
"What are you learning about right now?",
"Study session — what's the subject?",
"Oh, what do you need to understand?",
"What part of it are you finding tricky?",
"Nice, studying is good. What's the topic?",
"What are you working on? I'll try to help explain.",
"Learning time! What's the subject?",
"What's the specific thing you're stuck on?",
"What subject is this?",
"Okay, I'll do my best to help. What are you working on?",
"Study session! What are we dealing with?",
"What do you need to understand or get done?",
"Oh, school stuff. What's the topic or problem?",
"What's tripping you up?",
"Let's work through it. What's the problem?",
"What's the question or concept you're stuck on?",
"Okay, what's the subject and what do you need?",
"What exactly are you trying to learn or understand?",
"Are you looking for an explanation, examples, or help with an assignment?",
"What's the level — school, college, or just curious?",
"What have you already tried or understood so far?",
"Ask me the question and we'll work through it together.",
"I'll do my best to explain it clearly. What is it?"
],
confused: [
"No worries, let me try to explain that better.",
"Totally fair, let me rephrase that.",
"My bad, let me make that clearer.",
"Good question — let me try again.",
"I probably didn't explain that well. Let me try a different way.",
"Fair! What specifically is confusing you?",
"Let me break that down differently.",
"Okay, let me take a different angle on that.",
"Totally understandable. What part lost you?",
"I'll try to simplify it. What's the part that's unclear?",
"Sorry about that! Let me try to be clearer.",
"No worries at all. What part didn't click?",
"Let me try to put it differently.",
"What specifically is confusing? I'll clear it up.",
"Fair, that might have been confusing. Let me try again.",
"Totally okay to be confused. What part is unclear?",
"My explanation might have been off. What lost you?",
"Let me take another shot at explaining that.",
"Confusion is fine! What specifically didn't land?",
"I'll try a simpler version. What part wasn't clear?",
"Good that you said something — what's the unclear part?",
"No shame in asking. What part needs clarifying?",
"Let me try to be clearer. What part was confusing?",
"I might have been unclear. What didn't make sense?",
"Totally fair. What needs clarifying?",
"Let me try again. Which part lost you?",
"I'll explain it differently. What's the unclear bit?",
"Sorry for the confusion! What do you need clarified?",
"That's understandable. Let me try a clearer explanation.",
"No worries! What part should I explain better?",
"Let me give you an example — that might help.",
"Sometimes a different approach makes it click. What was confusing?",
"Confusion is just a step before understanding. What's unclear?",
"I'll keep it simpler this time. What was the confusing part?",
"Fair enough. I can go slower. What's the part that needs re-explaining?"
],
movies: [
"Oh, movie fan! What kind of stuff are you into?",
"Nice, what are we watching? Or looking for something to watch?",
"Movies! What genre do you usually go for?",
"Oh, are you looking for a recommendation or chatting about what you've seen?",
"What kind of movies are you into?",
"Oh, nice! What kind of film are you in the mood for?",
"Movie or TV show? And what genre?",
"What have you been watching lately?",
"Nice, movies are great. What's your usual genre?",
"Are you looking for something to watch or just talking movies?",
"What kind of stuff are you usually into — action, drama, comedy, thriller?",
"Oh, what movie are we talking about?",
"What's a movie you'd recommend to everyone?",
"Nice! Do you prefer movies or shows usually?",
"Oh, are you trying to pick something to watch?",
"What kind of vibe are you looking for?",
"Movie or series? What kind of mood are you in?",
"What have you been enjoying watching recently?",
"Oh, film fan! What's your go-to genre?",
"What's a movie or show that really got you lately?",
"Nice, are you looking for a recommendation?",
"What kind of stuff are you usually into?",
"Oh, what movie or show?",
"What's on your watchlist right now?",
"What genre are you feeling right now?",
"Oh, what did you want to know or talk about?",
"Nice, movie chat! What are you watching or looking for?",
"Are you looking for something to watch or talking about something you've seen?",
"What's the last thing you watched that you really liked?",
"Horror, comedy, thriller? What's the vibe tonight?",
"Are you a binge-watcher or one episode at a time kind of person?",
"What's a show you'd recommend that not enough people have seen?",
"Netflix, cinema, or something else?",
"What's your all-time favourite movie?",
"Are you in the mood for something light or something deep?"
],
sports: [
"Oh, sports fan! What sport are we talking?",
"Nice, what sport are you into?",
"Sports talk! What's going on?",
"Oh, what sport are we talking about?",
"Nice! What team do you support?",
"What sport are you following right now?",
"Oh, sports! What's the game or sport?",
"Are you watching something or playing something?",
"What sport are you a fan of?",
"Oh, nice! What sport are we discussing?",
"What team are you rooting for?",
"Sports fan! What's happening in your sport?",
"Oh, what's the sport or team you follow?",
"Nice, sports! Are you watching a game or talking general stuff?",
"What sport do you usually follow?",
"Oh, sports! What's going on with your team?",
"Nice! What game or sport are you thinking about?",
"Are you playing or watching?",
"What sport are you most into right now?",
"Oh, sports talk! What's up?",
"What's the sport and what's on your mind?",
"What team do you follow?",
"Oh, are you watching something right now?",
"Sports is a big topic. What specifically are we talking about?",
"What sport are you into most?",
"Oh, what sport or team?",
"Are you a player or more of a spectator?",
"Nice, what's happening in the sports world from your end?",
"What sport and what's the situation?",
"Who's your team and how are they doing?",
"Do you play the sport yourself or just watch?",
"What's the most exciting thing that's happened in your sport recently?",
"What's your favourite sporting moment ever?",
"Are we talking team sports or individual?",
"Who's the best player in your sport right now, in your opinion?"
]
};
/* 16c · Smart picker — no immediate repeats */
const _lastPick = {};
function pick(cat) {
const cfg = CAT_EMOJI[cat] || {};
const arr = R[cat];
if (!Array.isArray(arr) || !arr.length) return "";
if (arr.length === 1) return maybeEmoji(arr[0], cfg.type, cfg.chance);
let idx;
do {
idx = Math.floor(Math.random() * arr.length);
} while (_lastPick[cat] === idx);
_lastPick[cat] = idx;
return maybeEmoji(arr[idx], cfg.type, cfg.chance);
}
function withFollowUp(text, opts, chance = 0.45) {
if (!opts?.length || Math.random() > chance) return text;
return `${text} ${opts[Math.floor(Math.random() * opts.length)]}`;
}
function smartPick(cat) {
const base = pick(cat);
if (cat === "howAreYou")
return withFollowUp(base, [
"How about you?",
"What about you?",
"You good?",
"How's your day going?"
]);
if (cat === "thanks")
return withFollowUp(base, [
"Need anything else?",
"Glad that helped.",
"What else can I help with?"
]);
if (cat === "compliment")
return withFollowUp(base, [
"That means a lot.",
"Appreciate that.",
"You made my day."
]);
if (cat === "greeting")
return withFollowUp(base, [
"What's up?",
"How can I help?",
"Good to see you."
]);
if (cat === "motivation")
return withFollowUp(base, [
"Keep going.",
"You've got this.",
"One step at a time."
]);
return base;
}
/* 16d · Date / time helpers */
function get12HourTime(d = new Date()) {
return new Intl.DateTimeFormat("en-IN", {
hour: "numeric",
minute: "2-digit",
hour12: true
}).format(d);
}
function getDate(d = new Date()) {
return `Today is ${d.toLocaleDateString([], {
weekday: "long",
year: "numeric",
month: "long",
day: "numeric"
})}.`;
}
/* ── 17 INTENT SCORING
───────────────────────────────────────────── */
function scoreIntents(t) {
return {
greeting: INTENT.greeting.test(t) ? 3 : 0,
howAreYou: INTENT.howAreYou.test(t) ? 4 : 0,
whatCanYouDo: INTENT.whatCanYouDo.test(t) ? 3 : 0,
identity: INTENT.identity.test(t) ? 3 : 0,
creator: INTENT.creator.test(t) ? 5 : 0,
anime: INTENT.anime.test(t) ? 4 : 0,
joke: INTENT.joke.test(t) ? 4 : 0,
thanks: INTENT.thanks.test(t) ? 4 : 0,
bye: INTENT.bye.test(t) ? 4 : 0,
yes: INTENT.yes.test(t) ? 4 : 0,
no: INTENT.no.test(t) ? 4 : 0,
compliment: INTENT.compliment.test(t) ? 4 : 0,
insult: INTENT.insult.test(t) ? 4 : 0,
age: INTENT.age.test(t) ? 4 : 0,
time: INTENT.time.test(t) ? 5 : 0,
date: INTENT.date.test(t) ? 5 : 0,
weather: INTENT.weather.test(t) ? 4 : 0,
casual: INTENT.casual.test(t) ? 2 : 0,
food: INTENT.food.test(t) ? 4 : 0,
bored: INTENT.bored.test(t) ? 4 : 0,
music: INTENT.music.test(t) ? 4 : 0,
gaming: INTENT.gaming.test(t) ? 4 : 0,
motivation: INTENT.motivation.test(t) ? 5 : 0,
advice: INTENT.advice.test(t) ? 3 : 0,
study: INTENT.study.test(t) ? 4 : 0,
confused: INTENT.confused.test(t) ? 4 : 0,
movies: INTENT.movies.test(t) ? 4 : 0,
sports: INTENT.sports.test(t) ? 4 : 0,
math: isMath(t) ? 5 : 0,
unit: tryConvert(t) ? 6 : 0
};
}
function looksLikeConversation(text) {
const s = scoreIntents(text);
return s.greeting + s.casual + s.howAreYou + s.thanks >= 5;
}
/* ── 18 RESPONSE GENERATOR
───────────────────────────────────────── */
/* 18a · Name memory */
const NAME_Q_RE = /\b(?:who am i|what(?:'s| is) my name|tell me my name|do you know my name|remember my name|say my name)\b/i;

const KNOW_ME_RE = /\b(?:do you know me|remember me|you know me|who is this|am i remembered|do you remember who i am|you remember me right)\b/i;

const NAME_RES = [
(n) => `You're ${n}.`,
(n) => `Your name is ${n}.`,
(n) => `I know you as ${n}.`,
(n) => `Pretty sure you're ${n}.`,
(n) => `That would be ${n}.`,
(n) => `I remember you — ${n}.`,
(n) => `Of course. You're ${n}.`,
(n) => `You're still ${n}.`,
(n) => `You told me your name is ${n}.`,
(n) => `I have you saved as ${n}.`,
(n) => `You're ${n}, unless you changed it secretly.`,
(n) => `From what I remember, you're ${n}.`,
(n) => `I haven't forgotten — you're ${n}.`,
(n) => `You're saved in my memory as ${n}.`,
(n) => `Last time I checked, you're ${n}.`
];
const KNOW_RES = [
(n) => `Yeah — you're ${n}.`,
(n) => `Of course I know you. You're ${n}.`,
(n) => `Yep, I remember you — ${n}.`,
(n) => `I do. You're ${n}.`,
(n) => `Yeah, you're saved as ${n}.`,
(n) => `I remember your name — ${n}.`,
(n) => `You're definitely ${n}.`,
(n) => `Pretty hard to forget ${n}.`,
(n) => `I know you as ${n}.`,
(n) => `You're ${n}, right?`,
(n) => `I haven't forgotten you — ${n}.`,
(n) => `Yeah, I know who you are. You're ${n}.`,
(n) => `You introduced yourself as ${n}.`,
(n) => `Yep — still remember you, ${n}.`,
(n) => `You're in memory as ${n}.`
];
function rnd(arr) {
return arr[Math.floor(Math.random() * arr.length)];
}
function generate(raw) {
const t = normalise(raw);
if (!t) return pick("unknown");
const s = scoreIntents(t);
/* 18a · Name queries */
if (NAME_Q_RE.test(t))
return App.userName
? rnd(NAME_RES)(App.userName)
: "I don't know your name yet.";
if (KNOW_ME_RE.test(t))
return App.userName
? rnd(KNOW_RES)(App.userName)
: "I don't think you've told me your name yet.";
/* 18b · Time / date */
if (s.time > 0 && s.date === 0) return `It's currently ${get12HourTime()}.`;
if (s.date > 0 && s.time === 0) return getDate();
if (s.time > 0 && s.date > 0)
return `${getDate()} It's currently ${get12HourTime()}.`;
/* 18c · Unit & math */
if (s.unit > 0) {
const r = tryConvert(t);
if (r) return r;
}
if (s.math > 0) {
const r = solveMath(t);
if (r) return r;
}
/* 18d · Intent routing — highest score wins */
const [best, bestScore] =
Object.entries(s).sort((a, b) => b[1] - a[1])[0] || [];
if (best && bestScore > 0 && R[best]) return smartPick(best);
return pick("unknown"); /* BUG-02 FIX: was missing */
} /* BUG-02 FIX: closing brace was missing — everything below was trapped inside */
/* ── 19 GREETING HANDLER
─────────────────────────────────────────── */
function greetIfNeeded() {
if (App.greeted || App.busy || !UI.chat) return;
App.greeted = true;
const name = App.userName || "there";
const hour = new Date().getHours();
const part =
hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
const text = `${part}, ${name}. I'm Arctix. How can I help you today?`;
App.busy = true;
setSendEnabled(false);
(async () => {
try {
await new Promise((r) => setTimeout(r, 100));
const bubble = add("", "bot", false);
if (!bubble) return;
const done = await stream(bubble, text);
if (done && bubble.textContent.trim()) {
App.memory.push({ type: "bot", text: bubble.textContent });
saveMemory();
syncCurrentConv();
}
} catch (e) {
console.error("[Arctix] Greeting error:", e);
} finally {
App.busy = false;
setSendEnabled(true);
UI.userInput?.focus();
}
})();
}
/* ── 20 SEND HANDLER (BUG-03 FIXED: no double memory push) ─────── */
async function send() {
if (App.busy || !UI.userInput || !UI.chat) return;
const text = UI.userInput.value.trim();
if (!text) return;
add(
text,
"user"
); /* add() handles memory push internally — NO extra push here */
UI.userInput.value = "";
App.busy = true;
setSendEnabled(false);
const bot = add("", "bot", false);
if (bot) {
bot.classList.add("typing-bubble");
bot.replaceChildren(
document.createElement("span"),
document.createElement("span"),
document.createElement("span")
);
}
let reply = "";
try {
reply = String(generate(text) ?? "");
} catch (e) {
console.error("[Arctix] Generate error:", e);
reply = "Something went wrong. Try again.";
}
const thinkTime = Math.min(1500, 500 + Math.max(0, reply.length) * 8);
try {
await new Promise((r) => setTimeout(r, thinkTime));
if (bot?.isConnected) {
bot.classList.remove("typing-bubble");
bot.textContent = "";
}
const done = await stream(bot, reply);
if (done && bot?.textContent.trim()) {
App.memory.push({ type: "bot", text: bot.textContent });
App.turnCount++;
saveMemory();
syncCurrentConv();
}
} catch (e) {
console.error("[Arctix] Send error:", e);
if (bot?.isConnected) bot.remove();
add("Something went wrong. Please try again.", "bot", false);
} finally {
App.busy = false;
setSendEnabled(true);
UI.userInput?.focus();
}
}
/* ── 21 EVENT LISTENERS
──────────────────────────────────────────── */
/* Side panel */
UI.sideBtn?.addEventListener("click", openSidePanel);
UI.sideClose?.addEventListener("click", closeSidePanel);
UI.sideBackdrop?.addEventListener("click", closeSidePanel);
document.addEventListener("keydown", (e) => {
if (e.key === "Escape" && _sideOpen) closeSidePanel();
});
/* Settings (inside side panel) */
UI.themeBtn?.addEventListener("click", toggleTheme);
UI.soundBtn?.addEventListener("click", toggleSound);
/* New chat button (top bar) */
UI.newChatBtn?.addEventListener("click", startNewChat);
/* Start → Name */
UI.startBtn?.addEventListener("click", () => {
stopSnowSpin(UI.snowStart);
show(UI.nameScreen, () => {
UI.nameInput?.focus();
setTimeout(() => startSnowSpin(UI.snowName), 100);
});
});
/* Name → Chat */
UI.continueBtn?.addEventListener("click", () => {
if (!UI.nameInput) return;
const name = UI.nameInput.value.trim();
if (!isValidName(name)) {
flashNameInput();
return;
}
saveName(name);
App.greeted = false;
stopSnowSpin(UI.snowName);
show(UI.chatScreen, () => greetIfNeeded());
});
UI.nameInput?.addEventListener("keydown", (e) => {
if (e.key === "Enter") {
e.preventDefault();
UI.continueBtn?.click();
}
UI.nameInput.style.borderColor = "";
});
/* Send */
UI.sendBtn?.addEventListener("click", () => {
if (!App.busy) send();
});
UI.userInput?.addEventListener("keydown", (e) => {
if (e.key === "Enter") {
e.preventDefault();
if (!App.busy) send();
}
});
/* Clear */
UI.clearBtn?.addEventListener("click", () => {
if (!UI.chat) return;
UI.chat.replaceChildren();
App.streamId++;
App.busy = false;
App.greeted = false;
clearMemory();
setSendEnabled(true);
greetIfNeeded();
UI.userInput?.focus();
});
/* ── 22 INITIALISATION
───────────────────────────────────────────── */
let _initialized = false;
function init() {
if (_initialized) return;
_initialized = true;
[UI.startScreen, UI.nameScreen, UI.chatScreen]
.filter(Boolean)
.forEach((s) => {
s.classList.add("hidden");
s.classList.remove("active");
});
applyTheme(App.darkMode);
syncSoundUI();
/* No automatic conversation creation on startup */
App.currentConvId = null;
show(UI.startScreen, () => {
startSnowSpin(UI.snowStart);
UI.startBtn?.focus();
});
}
if (document.readyState === "loading")
document.addEventListener("DOMContentLoaded", init);
else init();
