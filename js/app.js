/**
 * Singapore Sports Hub Event Calendar
 * Frontend app - reads from GitHub raw JSON
 */

// ─── Config ───────────────────────────────────────────────────────────────────

// When running locally (file:// or localhost), use local data file.
// When deployed to GitHub Pages, set this to your raw GitHub URL:
// e.g. "https://raw.githubusercontent.com/your-username/event-calendar/main/data/events.json"
const DATA_URL = (() => {
  if (location.hostname === 'localhost' || location.protocol === 'file:') {
    return './data/events.json';
  }
  return 'https://raw.githubusercontent.com/RichardEixon/event-calendar/main/data/events.json';
})();

const VENUE_COLORS = {
  Arena: '#3B82F6',
  KTH:   '#10B981',
  NSD:   '#EF4444',
  SIS:   '#8B5CF6',
  WSC:   '#06B6D4',
  AQC:   '#F59E0B',
  Other: '#9CA3AF',
};

// ─── State ────────────────────────────────────────────────────────────────────

let allEvents = [];       // raw event objects from JSON
let calendar = null;      // FullCalendar instance
let currentEvent = null;  // event shown in modal
let searchQuery = '';

// ─── Bootstrap ────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initCalendar();
  loadData();
  // Auto-refresh every 15 minutes
  setInterval(loadData, 15 * 60 * 1000);
});

// ─── Data Loading ─────────────────────────────────────────────────────────────

async function loadData() {
  setSyncStatus('loading');
  try {
    const resp = await fetch(DATA_URL + '?t=' + Date.now());
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const payload = await resp.json();

    allEvents = payload.events || [];
    renderCalendar(allEvents);
    setSyncStatus('ok', payload.lastUpdated);
  } catch (err) {
    console.error('[App] Load failed:', err);
    setSyncStatus('error');

    // Show sample data so layout is visible even without real data
    if (allEvents.length === 0) {
      allEvents = getSampleEvents();
      renderCalendar(allEvents);
    }
  }
}

// ─── FullCalendar ─────────────────────────────────────────────────────────────

function initCalendar() {
  const el = document.getElementById('calendar');
  calendar = new FullCalendar.Calendar(el, {
    initialView: 'dayGridMonth',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: '',
    },
    height: 'auto',
    eventClick(info) {
      const evId = info.event.id;
      const ev = allEvents.find(e => e.id === evId);
      if (ev) openModal(ev);
    },
    eventDidMount(info) {
      info.el.title = info.event.title;
    },
    dayMaxEvents: 4,
    moreLinkClick: 'popover',
    eventDisplay: 'block',
  });
  calendar.render();
}

function renderCalendar(events) {
  if (!calendar) return;

  const filtered = searchQuery
    ? events.filter(ev => matchesSearch(ev, searchQuery))
    : events;

  const fcEvents = filtered.map(ev => ({
    id: ev.id,
    title: `${ev.venue}: ${ev.eventName}`,
    start: ev.dateStart,
    end: bumpDate(ev.dateEnd),   // FullCalendar end is exclusive
    backgroundColor: VENUE_COLORS[ev.venue] || VENUE_COLORS.Other,
    borderColor: VENUE_COLORS[ev.venue] || VENUE_COLORS.Other,
    textColor: '#fff',
  }));

  calendar.removeAllEvents();
  calendar.addEventSource(fcEvents);
}

/** FullCalendar multi-day end date must be +1 day (exclusive). */
function bumpDate(iso) {
  if (!iso) return iso;
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

// ─── Search ───────────────────────────────────────────────────────────────────

function onSearch(query) {
  searchQuery = query.trim().toLowerCase();
  renderCalendar(allEvents);
}

function matchesSearch(ev, q) {
  return (
    (ev.eventName || '').toLowerCase().includes(q) ||
    (ev.venue || '').toLowerCase().includes(q) ||
    (ev.em || '').toLowerCase().includes(q) ||
    (ev.aem || '').toLowerCase().includes(q)
  );
}

// ─── View Toggle ─────────────────────────────────────────────────────────────

function setView(viewName) {
  if (!calendar) return;
  calendar.changeView(viewName);

  document.getElementById('btn-month').className =
    viewName === 'dayGridMonth'
      ? 'px-2.5 py-1.5 bg-blue-600 text-white font-medium'
      : 'px-2.5 py-1.5 text-gray-600 hover:bg-gray-100';
  document.getElementById('btn-list').className =
    viewName === 'listMonth'
      ? 'px-2.5 py-1.5 bg-blue-600 text-white font-medium'
      : 'px-2.5 py-1.5 text-gray-600 hover:bg-gray-100';
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function openModal(ev) {
  currentEvent = ev;

  const color = VENUE_COLORS[ev.venue] || VENUE_COLORS.Other;

  // Header
  document.getElementById('modal-venue-bar').style.background = color;
  document.getElementById('modal-title').textContent = ev.eventName || 'Event';

  // Date
  const dateEl = document.querySelector('#modal-date span');
  dateEl.textContent = formatDateRange(ev.dateStart, ev.dateEnd);

  // Venue
  const venueEl = document.querySelector('#modal-venue-text span');
  venueEl.textContent = ev.venue || '-';

  // EM
  const emEl = document.getElementById('modal-em');
  if (ev.em) {
    emEl.querySelector('span').textContent = `EM: ${ev.em}`;
    emEl.classList.remove('hidden');
  } else emEl.classList.add('hidden');

  // AEM
  const aemEl = document.getElementById('modal-aem');
  if (ev.aem) {
    aemEl.querySelector('span').textContent = `AEM: ${ev.aem}`;
    aemEl.classList.remove('hidden');
  } else aemEl.classList.add('hidden');

  // Remark
  const remarkWrap = document.getElementById('modal-remark-wrap');
  if (ev.remark) {
    document.getElementById('modal-remark').textContent = ev.remark;
    remarkWrap.classList.remove('hidden');
  } else remarkWrap.classList.add('hidden');

  // WhatsApp text
  document.getElementById('wa-text').textContent =
    ev.whatsappContent || '(No WhatsApp content generated yet)';

  // PDFs
  const pdfList = document.getElementById('pdf-list');
  const noPdfMsg = document.getElementById('no-pdf-msg');
  pdfList.innerHTML = '';

  const pdfs = ev.pdfs || [];
  if (pdfs.length > 0) {
    noPdfMsg.classList.add('hidden');
    pdfs.forEach(pdf => {
      const sizeMB = pdf.fileSize ? (pdf.fileSize / 1024 / 1024).toFixed(1) : '?';
      const btn = document.createElement('a');
      btn.className =
        'flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm cursor-pointer';
      btn.innerHTML = `
        <span class="flex items-center gap-2 text-gray-700 truncate">
          <span class="text-xl">📄</span>
          <span class="truncate">${escHtml(pdf.fileName)}</span>
        </span>
        <span class="text-xs text-gray-400 shrink-0 ml-2">${sizeMB} MB</span>
      `;
      // PDFs are served from local backend when on localhost, or from GitHub LFS otherwise
      if (pdf.localPath) {
        btn.title = `Local: ${pdf.localPath}`;
      }
      btn.onclick = () => {
        alert(`PDF: ${pdf.fileName}\n\nThis PDF is stored locally on your home PC.\nPath: ${pdf.localPath || 'unknown'}\n\nTo access from other devices, open the local backend server.`);
      };
      pdfList.appendChild(btn);
    });
  } else {
    noPdfMsg.classList.remove('hidden');
  }

  // Reset to WhatsApp tab
  switchTab('whatsapp');
  resetCopyBtn();

  // Open
  document.getElementById('modal-backdrop').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal(e) {
  if (e.target === document.getElementById('modal-backdrop')) {
    closeModalDirect();
  }
}

function closeModalDirect() {
  document.getElementById('modal-backdrop').classList.remove('open');
  document.body.style.overflow = '';
  currentEvent = null;
}

// Close on Escape key
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModalDirect();
});

// ─── Tabs ─────────────────────────────────────────────────────────────────────

function switchTab(name) {
  ['whatsapp', 'pdfs'].forEach(t => {
    document.getElementById(`tab-content-${t}`).classList.toggle('hidden', t !== name);
    const btn = document.getElementById(`tab-${t}`);
    if (t === name) {
      btn.className = 'tab-btn px-4 py-2 text-sm font-medium border-b-2 border-blue-600 text-blue-600';
    } else {
      btn.className = 'tab-btn px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700';
    }
  });
}

// ─── Copy to Clipboard ────────────────────────────────────────────────────────

async function copyWhatsApp() {
  const text = document.getElementById('wa-text').textContent;
  const btn = document.getElementById('copy-btn');
  const btnText = document.getElementById('copy-btn-text');

  try {
    await navigator.clipboard.writeText(text);
    btnText.textContent = 'Copied!';
    btn.className = btn.className.replace('bg-green-600 hover:bg-green-700', 'bg-gray-500');
    setTimeout(resetCopyBtn, 2500);
  } catch {
    // Fallback for older iOS
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    btnText.textContent = 'Copied!';
    setTimeout(resetCopyBtn, 2500);
  }
}

function resetCopyBtn() {
  const btn = document.getElementById('copy-btn');
  const btnText = document.getElementById('copy-btn-text');
  btnText.textContent = 'Copy to Clipboard';
  btn.className = btn.className.replace('bg-gray-500', 'bg-green-600 hover:bg-green-700');
}

// ─── Sync Status ──────────────────────────────────────────────────────────────

function setSyncStatus(state, lastUpdated) {
  const el = document.getElementById('sync-status');
  const dot = document.getElementById('sync-dot');
  if (state === 'ok') {
    const d = lastUpdated ? new Date(lastUpdated) : new Date();
    dot.textContent = '✅';
    el.innerHTML = `<span id="sync-dot">✅</span> ${formatSyncTime(d)}`;
  } else if (state === 'loading') {
    dot.textContent = '⏳';
    el.innerHTML = `<span id="sync-dot">⏳</span> Syncing…`;
  } else {
    dot.textContent = '❌';
    el.innerHTML = `<span id="sync-dot">❌</span> Sync failed`;
  }
}

function formatSyncTime(date) {
  return date.toLocaleString('en-SG', {
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit',
    hour12: false
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateRange(start, end) {
  if (!start) return '-';
  const s = formatDateDisplay(start);
  const e = end && end !== start ? formatDateDisplay(end) : null;
  return e ? `${s} – ${e}` : s;
}

function formatDateDisplay(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' });
}

function escHtml(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─── Sample Data (shown before real data loads) ───────────────────────────────

function getSampleEvents() {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  return [
    {
      id: 'sample-1',
      eventName: 'Sample Concert (Arena)',
      dateStart: today,
      dateEnd: tomorrow,
      venue: 'Arena',
      em: 'John Doe',
      aem: 'Jane Smith',
      remark: 'Setup: day before',
      whatsappContent: '*Sample Concert (Arena)*\nVenue: Arena\nDate: Today\nEM: John Doe\nAEM: Jane Smith\n\n*Event Info*\n1800hrs: Gates Open\n2000hrs: Show Start\n2300hrs: Show End\n\n*Conditions of Entry*\nAllowed:\n- Backpacks\n- Umbrellas\n\nNOT ALLOWED:\n- Glass bottles',
      pdfCount: 1,
      pdfs: []
    },
    {
      id: 'sample-2',
      eventName: 'Tennis Tournament',
      dateStart: nextWeek,
      dateEnd: nextWeek,
      venue: 'KTH',
      em: 'Alice Tan',
      aem: '',
      remark: '',
      whatsappContent: '*Tennis Tournament*\nVenue: KTH\nDate: Next Week\nEM: Alice Tan\n\n(No PDF processed)',
      pdfCount: 0,
      pdfs: []
    }
  ];
}
