// ============================================================================
// US-IRAN WAR INTELLIGENCE DASHBOARD — APPLICATION ENGINE
// ============================================================================

// Map-mode layer partitioning.
// STATIC: hardcoded order-of-battle reference (bases, missiles, nuclear sites,
//   proxies, air-defense). Only visible in 'oob' mode.
// LIVE:   data-driven layers (conflict zones, air traffic). The 'live-incidents'
//   layer is added dynamically when incidents load, so it isn't listed here —
//   it auto-enables itself in both modes via addLiveIncidents().
const STATIC_LAYER_KEYS = ['us-bases', 'us-navy', 'iran-bases', 'iran-missiles', 'iran-nuclear', 'iran-navy', 'proxy-forces', 'air-defense'];
const LIVE_LAYER_KEYS = ['conflict-zones', 'air-traffic'];

class WarDashboard {
  constructor() {
    this.map = null;
    this.newsItems = [];
    this.activeFilter = 'ai';
    this.layerGroups = {};
    // Map mode: 'threat' (live events only) or 'oob' (full order of battle).
    // Persisted across sessions; threat is the default for new visitors.
    try {
      this.mapMode = localStorage.getItem('sosint.map.mode') === 'oob' ? 'oob' : 'threat';
    } catch (e) { this.mapMode = 'threat'; }
    this.activeLayers = new Set(
      this.mapMode === 'oob' ? [...STATIC_LAYER_KEYS, ...LIVE_LAYER_KEYS] : [...LIVE_LAYER_KEYS]
    );
    this.feedErrors = 0;
    this.feedSuccesses = 0;
    this.airTrafficMarkers = [];
    this.airTrafficCount = 0;
    this.sentimentMode = 'us';
    this.sentimentData = null;
    this.sentimentRefreshTimer = null;
    this.liveIncidents = [];
    this.liveAssets = [];
    this.liveAssets = [];
    this.globalMetrics = null;
    this.telegramData = null;
    this.aiAlerts = null;
    // Warm-start AI alerts from last-cached payload so the panel paints
    // instantly on page load while the fresh fetch runs in the background.
    try {
      const raw = localStorage.getItem('sosint.ai.alerts.v1');
      if (raw) this.aiAlerts = JSON.parse(raw);
    } catch (e) { /* localStorage unavailable */ }
  }

  init() {
    this.renderLayout();
    this.startClock();
    this.initMap();
    // Render default active tab for each panel
    this.renderMilitaryComparison(); // right-top: Assets tab (default)
    this.renderProxyForces();        // left-bottom: Proxies tab (default)
    this.renderSentimentPanel();     // right-bottom: Sentiment tab (default)

    // AI Alerts is the default Strat Intel Feed tab — paint cached payload
    // immediately, then kick the network refresh.
    this.renderAiAlerts();
    this.fetchAiAlerts();
    setInterval(() => this.fetchAiAlerts(), 5 * 60 * 1000); // poll every 5 min

    this.loadNewsFeeds();
    // Initialize live tracking layers
    this.loadAirTraffic();
    // Refresh intervals
    setInterval(() => this.loadNewsFeeds(), 300000);    // News: 5 min
    setInterval(() => this.loadAirTraffic(), 60000);    // Air: 60s (server-side scraper updates every 10 min)

    // Live OSINT Data (Incidents & Assets)
    this.fetchLiveData();
    setInterval(() => this.fetchLiveData(), 60000); // Live Data: 1 min

    this.initSentimentRefresh();
  }

  // ── Layout ──────────────────────────────────────────────────────────────
  renderLayout() {
    document.getElementById('app').innerHTML = `
      <div class="top-bar">
        <div class="logo">
          <div class="logo-icon">⚔</div>
          <div class="logo-text">
            <span class="logo-title">N8RA - WarTracker</span>
            <span class="logo-subtitle">Aggregated Strat Intel Dashboard</span>
          </div>
        </div>
        <div class="status-bar">
          <div class="status-item"><span class="status-dot live"></span> FEEDS ACTIVE</div>
          <div class="status-item"><span class="status-dot warn"></span> <span id="feed-count">0</span> SOURCES</div>
          <div class="threat-level">THREAT: HIGH</div>
          <div class="status-item"><span class="status-dot alert"></span> DEFCON 3</div>
          <div class="clock" id="clock">--:--:-- UTC</div>
        </div>
      </div>
      <div id="ai-marquee" class="ai-marquee ai-marquee-empty">
        <div class="ai-marquee-label">
          <span class="ai-marquee-icon">⚠</span>
          <span class="ai-marquee-title">AI ALERTS</span>
          <span class="ai-marquee-badge">CLAUDE OPUS 4.7</span>
        </div>
        <div class="ai-marquee-viewport">
          <div class="ai-marquee-track" id="ai-marquee-track"></div>
        </div>
        <div class="ai-marquee-meta" id="ai-marquee-meta"></div>
      </div>
      <div class="dashboard">
        <!-- Left Column -->
        <div class="panel" id="panel-news">
          <div class="panel-header">
            <span class="panel-icon">📡</span>
            <span class="panel-title">Strat Intel Feed</span>
            <span class="panel-badge live">LIVE</span>
          </div>
          <div class="news-filter-bar" style="padding: 4px 10px;">
            <button class="news-filter news-filter-ai active" data-filter="ai"><span class="news-filter-ai-icon">⚠</span> AI</button>
            <button class="news-filter" data-filter="all">All</button>
            <button class="news-filter" data-filter="wire">News</button>
            <button class="news-filter" data-filter="intel">Defence</button>
            <button class="news-filter" data-filter="gov">Govt</button>
            <button class="news-filter" data-filter="alert">Alert</button>
            <button class="news-filter" data-filter="mainstream">Media</button>
          </div>
          <div class="panel-content" id="news-content">
            <div class="feed-loading"><div class="spinner"></div> Loading intelligence feeds...</div>
          </div>
        </div>

        <!-- Center Column (Map) -->
        <div class="panel panel-map" id="panel-map">
          <div class="panel-header">
            <span class="panel-icon">🗺️</span>
            <span class="panel-title">Strat Intel Picture (Aggregated)</span>
            <span class="panel-badge alert">ACTIVE OPS</span>
          </div>
          <div class="panel-content">
            <div id="theater-map"></div>
          </div>
          <div class="map-legend" id="map-legend"></div>
        </div>

        <!-- Right Column Top -->
        <div class="panel" id="panel-right-top">
          <div class="panel-header">
            <span class="panel-icon">⚡</span>
            <span class="panel-title" id="right-top-title">US - Iran Comparitives</span>
          </div>
          <div class="tab-bar" id="right-top-tabs">
            <button class="tab-btn active" data-tab="assets">Assets</button>
            <button class="tab-btn" data-tab="threat">Threat</button>
            <button class="tab-btn" data-tab="nuclear">Nuclear</button>
            <button class="tab-btn" data-tab="air-def">Air Def</button>
          </div>
          <div class="panel-content" id="right-top-content"></div>
        </div>

        <!-- Left Column Bottom -->
        <div class="panel" id="panel-left-bottom">
          <div class="panel-header">
            <span class="panel-icon">🔥</span>
            <span class="panel-title" id="left-bottom-title">Regional Proxies</span>
          </div>
          <div class="tab-bar" id="left-bottom-tabs">
            <button class="tab-btn active" data-tab="proxies">Proxies</button>
            <button class="tab-btn" data-tab="strait">Hormuz</button>
            <button class="tab-btn" data-tab="sanctions">Sanctions</button>
            <button class="tab-btn" data-tab="telegram">Telegram</button>
          </div>
          <div class="panel-content" id="left-bottom-content"></div>
        </div>

        <!-- Right Column Bottom -->
        <div class="panel" id="panel-right-bottom">
          <div class="panel-header">
            <span class="panel-icon">📊</span>
            <span class="panel-title" id="right-bottom-title">Global Sentiment</span>
          </div>
          <div class="tab-bar" id="right-bottom-tabs">
            <button class="tab-btn active" data-tab="sentiment">Sentiment</button>
            <button class="tab-btn" data-tab="timeline">Timeline</button>
            <button class="tab-btn" data-tab="cyber">Cyber Ops</button>
            <button class="tab-btn" data-tab="naval">Naval</button>
            <button class="tab-btn" data-tab="live-maritime">🚢 Live Ships</button>
          </div>
          <div class="panel-content" id="right-bottom-content"></div>
        </div>
      </div>
    `;

    this.bindTabs();
    this.bindNewsFilters();
  }

  // ── Clock ───────────────────────────────────────────────────────────────
  startClock() {
    const update = () => {
      const now = new Date();
      const utc = now.toISOString().slice(11, 19);
      const el = document.getElementById('clock');
      if (el) el.textContent = utc + ' UTC';
    };
    update();
    setInterval(update, 1000);
  }

  // ── Tab System ──────────────────────────────────────────────────────────
  bindTabs() {
    document.querySelectorAll('.tab-bar').forEach(bar => {
      bar.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          bar.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const tab = btn.dataset.tab;
          const panelId = bar.id;

          if (panelId === 'right-top-tabs') {
            this.switchRightTop(tab);
          } else if (panelId === 'left-bottom-tabs') {
            this.switchLeftBottom(tab);
          } else if (panelId === 'right-bottom-tabs') {
            this.switchRightBottom(tab);
          }
        });
      });
    });
  }

  switchRightTop(tab) {
    const title = document.getElementById('right-top-title');
    const content = document.getElementById('right-top-content');
    switch(tab) {
      case 'assets':
        title.textContent = 'US - Iran Comparitives';
        this.renderMilitaryComparison();
        break;
      case 'threat':
        title.textContent = 'Threat Assessment';
        this.renderThreatLevel();
        break;
      case 'nuclear':
        title.textContent = 'Nuclear Program';
        this.renderNuclearStatus();
        break;
      case 'air-def':
        title.textContent = 'Air Defense Networks';
        this.renderAirDefense();
        break;
    }
  }

  switchLeftBottom(tab) {
    const title = document.getElementById('left-bottom-title');
    switch(tab) {
      case 'proxies':
        title.textContent = 'Regional Proxies';
        this.renderProxyForces();
        break;
      case 'strait':
        title.textContent = 'Strait of Hormuz';
        this.renderStraitMonitor();
        break;
      case 'sanctions':
        title.textContent = 'Sanctions & Economy';
        this.renderSanctions();
        break;
      case 'telegram':
        title.textContent = 'Telegram OSINT';
        this.renderTelegramIntel();
        break;
    }
  }

  switchRightBottom(tab) {
    const title = document.getElementById('right-bottom-title');
    switch(tab) {
      case 'timeline':
        title.textContent = 'Escalation Timeline';
        this.renderTimeline();
        break;
      case 'cyber':
        title.textContent = 'Cyber Operations';
        this.renderCyberOps();
        break;
      case 'naval':
        title.textContent = 'Naval Forces';
        this.renderNavalForces();
        break;
      case 'sentiment':
        title.textContent = 'Global Sentiment';
        this.renderSentimentPanel();
        break;
      case 'live-maritime':
        title.textContent = 'Live Maritime Traffic';
        this.renderLiveMaritime();
        break;
    }
  }

  // ── Live Maritime (MarineTraffic iframe embed) ──────────────────────────
  renderLiveMaritime() {
    const content = document.getElementById('right-bottom-content');
    if (!content) return;

    const view = { lat: 20.4, lon: 67.6, zoom: 6 };

    const src =
      `https://www.marinetraffic.com/en/ais/embed/zoom:${view.zoom}` +
      `/centery:${view.lat}/centerx:${view.lon}/maptype:4/shownames:false` +
      `/mmsi:0/shipid:0/fleet:0/fleet_id:0/vtypes:0/showmenu:false/remember:false`;

    const openUrl =
      `https://www.marinetraffic.com/en/ais/home/centerx:${view.lon}/centery:${view.lat}/zoom:${view.zoom}/maptype:4`;

    content.innerHTML = `
      <div class="live-maritime-container">
        <div class="live-maritime-topbar">
          <span class="live-maritime-label">Arabian Sea · India W. Coast · live AIS</span>
          <a class="live-maritime-open" href="${openUrl}" target="_blank" rel="noopener">Fullscreen ↗</a>
        </div>
        <iframe
          id="live-maritime-iframe"
          src="${src}"
          allowfullscreen
          loading="lazy"
          referrerpolicy="no-referrer-when-downgrade"
          title="MarineTraffic live AIS map">
        </iframe>
        <div class="live-maritime-footer">
          Live AIS data via <a href="https://www.marinetraffic.com" target="_blank" rel="noopener">MarineTraffic</a>
        </div>
      </div>
    `;
  }

  // ── News Filters ────────────────────────────────────────────────────────
  bindNewsFilters() {
    document.querySelector('.news-filter-bar')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.news-filter');
      if (btn) {
        document.querySelectorAll('.news-filter').forEach(f => f.classList.remove('active'));
        btn.classList.add('active');
        this.activeFilter = btn.dataset.filter;
        if (this.activeFilter === 'ai') {
          this.renderAiAlertsList();
        } else {
          this.renderNews();
        }
      }
    });
  }

  // ── News Loading ────────────────────────────────────────────────────────
  async loadNewsFeeds() {
    this.feedErrors = 0;
    this.feedSuccesses = 0;

    // Seed with static intel items so dashboard is always populated
    if (this.newsItems.length === 0) {
      this.seedStaticNews();
      if (this.activeFilter !== 'ai') this.renderNews();
    }

    const allFeeds = Object.values(NEWS_FEEDS).flat();
    const feedCount = document.getElementById('feed-count');
    if (feedCount) feedCount.textContent = allFeeds.length;

    // Load feeds concurrently in batches. Skip repainting when the AI tab
    // is active so the news loader doesn't clobber the cached AI panel.
    const batchSize = 4;
    for (let i = 0; i < allFeeds.length; i += batchSize) {
      const batch = allFeeds.slice(i, i + batchSize);
      await Promise.allSettled(batch.map(feed => this.fetchFeed(feed)));
      if (this.activeFilter !== 'ai') this.renderNews();
    }

    // Update status based on results
    if (this.feedSuccesses > 0) {
      const status = document.querySelector('.status-item:first-child .status-dot');
      if (status) status.className = 'status-dot live';
    }
  }

  seedStaticNews() {
    const staticItems = [
      { title: 'IAEA reports Iran continues enrichment at 60%, breakout time under 2 weeks', source: 'IAEA Monitor', tier: 'gov', date: new Date(Date.now() - 3600000), link: '#' },
      { title: 'CENTCOM confirms increased drone patrols over Strait of Hormuz amid tanker threats', source: 'Pentagon', tier: 'gov', date: new Date(Date.now() - 7200000), link: '#' },
      { title: 'Houthi militants launch anti-ship ballistic missile at commercial vessel in Red Sea', source: 'US-Iran Tensions', tier: 'alert', date: new Date(Date.now() - 5400000), link: '#' },
      { title: 'USS Eisenhower carrier strike group redeploys to 5th Fleet area of operations', source: 'USNI News', tier: 'intel', date: new Date(Date.now() - 10800000), link: '#' },
      { title: 'Iran unveils new underground missile production facility, claims enhanced precision capabilities', source: 'Iran International', tier: 'intel', date: new Date(Date.now() - 14400000), link: '#' },
      { title: 'Kataib Hezbollah claims drone attack on US forces at Al Asad Air Base, Iraq', source: 'Proxy Forces', tier: 'alert', date: new Date(Date.now() - 18000000), link: '#' },
      { title: 'State Department announces new sanctions on Iranian petrochemical network', source: 'State Dept', tier: 'gov', date: new Date(Date.now() - 21600000), link: '#' },
      { title: 'Israeli intelligence assesses Iran could produce nuclear weapon within months', source: 'Reuters ME', tier: 'wire', date: new Date(Date.now() - 25200000), link: '#' },
      { title: 'IRGCN fast boats harass US Coast Guard cutter near Strait of Hormuz', source: 'Breaking Defense', tier: 'intel', date: new Date(Date.now() - 28800000), link: '#' },
      { title: 'Iran test-fires Fattah-2 hypersonic missile in major military exercise', source: 'AP Iran', tier: 'wire', date: new Date(Date.now() - 32400000), link: '#' },
      { title: 'Hezbollah deploys precision-guided missiles near Israel-Lebanon border', source: 'BBC Middle East', tier: 'mainstream', date: new Date(Date.now() - 36000000), link: '#' },
      { title: 'THAAD battery deployed to UAE as precautionary measure', source: 'Defense One', tier: 'intel', date: new Date(Date.now() - 39600000), link: '#' },
      { title: 'Iran\'s Rial hits record low at 650,000 per USD as sanctions bite', source: 'Iran Sanctions', tier: 'alert', date: new Date(Date.now() - 43200000), link: '#' },
      { title: 'Fordow underground enrichment facility expanding centrifuge capacity — IAEA report', source: 'IAEA', tier: 'gov', date: new Date(Date.now() - 46800000), link: '#' },
      { title: 'CSIS analysis: Iran proxy network more capable than any point in last decade', source: 'CSIS', tier: 'intel', date: new Date(Date.now() - 50400000), link: '#' },
      { title: 'US Navy intercepts weapons shipment bound for Houthis in Gulf of Aden', source: 'Military Times', tier: 'intel', date: new Date(Date.now() - 54000000), link: '#' },
      { title: 'Shamoon 3.0: Iranian APT group targets Gulf state energy infrastructure', source: 'Cyber Warfare', tier: 'alert', date: new Date(Date.now() - 57600000), link: '#' },
      { title: 'Iraq PM calls for withdrawal of foreign forces amid Iran-US proxy tensions', source: 'Al Jazeera', tier: 'mainstream', date: new Date(Date.now() - 61200000), link: '#' },
      { title: 'Russia delivers additional S-300 components to Iran air defense network', source: 'The War Zone', tier: 'intel', date: new Date(Date.now() - 64800000), link: '#' },
      { title: 'Oil prices surge 5% on fears of Strait of Hormuz disruption', source: 'Strait of Hormuz', tier: 'alert', date: new Date(Date.now() - 68400000), link: '#' },
    ];
    this.newsItems.push(...staticItems);
  }

  // ── AI Alerts (Claude Opus 4.7) ─────────────────────────────────────────
  async fetchAiAlerts() {
    try {
      const res = await fetch('alerts.json?v=' + Date.now());
      if (!res.ok) return;
      const data = await res.json();
      // Skip re-render when the cached payload is already up-to-date —
      // avoids a DOM flicker on every 5-min poll.
      const unchanged = this.aiAlerts
        && this.aiAlerts.generated_at === data.generated_at
        && (this.aiAlerts.alerts || []).length === (data.alerts || []).length;
      this.aiAlerts = data;
      try { localStorage.setItem('sosint.ai.alerts.v1', JSON.stringify(data)); } catch (e) {}
      if (!unchanged) this.renderAiAlerts();
    } catch (e) {
      // alerts.json may not exist yet — that's fine
    }
  }

  renderAiAlerts() {
    this.renderAiMarquee();
    if (this.activeFilter === 'ai') {
      this.renderAiAlertsList();
    }
  }

  _aiEsc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  renderAiMarquee() {
    const marquee = document.getElementById('ai-marquee');
    const track = document.getElementById('ai-marquee-track');
    const metaEl = document.getElementById('ai-marquee-meta');
    if (!marquee || !track) return;

    const data = this.aiAlerts;
    if (!data || !Array.isArray(data.alerts) || data.alerts.length === 0) {
      marquee.classList.add('ai-marquee-empty');
      return;
    }
    marquee.classList.remove('ai-marquee-empty');

    const esc = this._aiEsc.bind(this);
    const bullet = ' &nbsp;<span class="ai-marquee-bullet">●</span>&nbsp; ';
    const parts = [];
    if (data.analysis_note) {
      parts.push(`<span class="ai-marquee-note">${esc(data.analysis_note)}</span>`);
    }
    data.alerts.forEach(a => {
      const sev = (a.severity || 'medium').toLowerCase();
      parts.push(
        `<span class="ai-marquee-item-sev ai-marquee-sev-${sev}">[${esc(sev.toUpperCase())}]</span> ` +
        `<span class="ai-marquee-item-title">${esc(a.title)}</span>`
      );
    });
    // Duplicate the content so the loop reads as continuous
    const inner = parts.join(bullet);
    track.innerHTML = inner + bullet + inner + bullet;

    if (metaEl && data.generated_at) {
      const minsAgo = Math.max(0, Math.round((Date.now() - new Date(data.generated_at).getTime()) / 60000));
      metaEl.textContent = `${minsAgo}m ago`;
    }
  }

  renderAiAlertsList() {
    const content = document.getElementById('news-content');
    if (!content) return;

    const data = this.aiAlerts;
    if (!data || !Array.isArray(data.alerts) || data.alerts.length === 0) {
      content.innerHTML = `<div class="feed-loading">Awaiting first AI analysis…</div>`;
      return;
    }

    const esc = this._aiEsc.bind(this);
    const tsAgo = data.generated_at
      ? Math.max(0, Math.round((Date.now() - new Date(data.generated_at).getTime()) / 60000))
      : null;
    const meta = data.meta || {};
    const cost = (typeof meta.cost_usd === 'number') ? meta.cost_usd.toFixed(4) : null;

    content.innerHTML = `
      <div class="ai-alerts-panel-header">
        <div class="ai-alerts-panel-note">${esc(data.analysis_note || '')}</div>
        <div class="ai-alerts-panel-meta">
          ${tsAgo !== null ? `<span>Updated ${tsAgo}m ago</span>` : ''}
          ${cost ? `<span>cost: $${cost}</span>` : ''}
          <span class="ai-alerts-panel-model">${esc(data.model || 'claude-opus-4-7')} · ${esc(data.effort || 'xhigh')}</span>
        </div>
      </div>
      <div class="ai-alerts-panel-list">
        ${data.alerts.map(a => {
          const sev = (a.severity || 'medium').toLowerCase();
          const conf = (a.confidence || 'medium').toLowerCase();
          const cat = (a.category || '').replace(/_/g, ' ');
          return `
            <div class="ai-alert-card ai-alert-${sev}">
              <div class="ai-alert-top">
                <span class="ai-alert-sev ai-alert-sev-${sev}">${esc(sev.toUpperCase())}</span>
                <span class="ai-alert-cat">${esc(cat)}</span>
                <span class="ai-alert-region">${esc(a.region || '')}</span>
              </div>
              <div class="ai-alert-title">${esc(a.title)}</div>
              <div class="ai-alert-summary">${esc(a.summary)}</div>
              <div class="ai-alert-meta">
                <span>source: ${esc(a.source || '')}</span>
                <span class="ai-alert-conf ai-alert-conf-${conf}">conf: ${esc(conf)}</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  async fetchLiveData() {
    try {
      // Fetch incidents
      const incRes = await fetch('incidents-data.json?v=' + Date.now());
      if (incRes.ok) {
        const incData = await incRes.json();
        this.liveIncidents = incData.incidents || [];
        this.addLiveIncidents();
      }
      
      // Fetch military assets
      const assetRes = await fetch('military-assets.json?v=' + Date.now());
      if (assetRes.ok) {
        const assetData = await assetRes.json();
        this.liveAssets = assetData.assets || [];
        // Re-render military comparison if that tab is active
        const title = document.getElementById('right-top-title');
        if (title && title.textContent === 'US - Iran Comparitives') {
          this.renderMilitaryComparison();
        }
      }
      
      // Fetch global metrics
      const metricsRes = await fetch('global-metrics.json?v=' + Date.now());
      if (metricsRes.ok) {
        this.globalMetrics = await metricsRes.json();
        
        // Render FIRMS hotspots
        this.addFirmsHotspots();

        // Re-render active tabs if necessary
        const rTopTitle = document.getElementById('right-top-title');
        if (rTopTitle && rTopTitle.textContent === 'Threat Assessment') this.renderThreatLevel();
        if (rTopTitle && rTopTitle.textContent === 'Nuclear Program') this.renderNuclearStatus();
        
        const lBotTitle = document.getElementById('left-bottom-title');
        if (lBotTitle && lBotTitle.textContent === 'Regional Proxies') this.renderProxyForces();
        if (lBotTitle && lBotTitle.textContent === 'Sanctions & Economy') this.renderSanctions();
        
        const rBotTitle = document.getElementById('right-bottom-title');
        if (rBotTitle && rBotTitle.textContent === 'Cyber Operations') this.renderCyberOps();
      }

      // Fetch Telegram OSINT
      const telRes = await fetch('telegram-osint.json?v=' + Date.now());
      if (telRes.ok) {
        this.telegramData = await telRes.json();
        const lBotTitle = document.getElementById('left-bottom-title');
        if (lBotTitle && lBotTitle.textContent === 'Telegram OSINT') this.renderTelegramIntel();
      }
    } catch (e) {
      console.log('Error fetching live OSINT data:', e);
    }
  }

  async fetchFeed(feed) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(feed.url, { signal: controller.signal });
      clearTimeout(timeout);
      
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'text/xml');

      const items = doc.querySelectorAll('item');
      items.forEach(item => {
        const title = item.querySelector('title')?.textContent?.trim() || '';
        const link = item.querySelector('link')?.textContent?.trim() || '';
        let pubDate = item.querySelector('pubDate')?.textContent?.trim();
        
        // Filter for relevant content
        const relevant = this.isRelevant(title);
        if (!relevant && feed.tier !== 'alert') return;

        this.newsItems.push({
          title: this.cleanTitle(title),
          link,
          source: feed.name,
          tier: feed.tier,
          date: pubDate ? new Date(pubDate) : new Date(),
          relevant,
        });
      });
      this.feedSuccesses++;
    } catch (e) {
      this.feedErrors++;
    }
  }

  isRelevant(title) {
    const keywords = [
      'iran', 'iranian', 'tehran', 'irgc', 'persian gulf', 'strait of hormuz',
      'centcom', 'hezbollah', 'houthi', 'yemen', 'red sea', 'iraq militia',
      'nuclear', 'enrichment', 'natanz', 'fordow', 'iaea', 'jcpoa',
      'sanctions', 'middle east', 'proxy', 'ballistic missile', 'drone attack',
      'us military', 'pentagon', 'carrier strike', 'fifth fleet', 'qassem',
      'soleimani', 'levant', 'axis of resistance', 'basij', 'quds force',
      'shahed', 'rial', 'oil tanker', 'gulf', 'arabian sea', 'bahrain',
      'trump iran', 'biden iran', 'hamas', 'gaza', 'israel iran',
    ];
    const lower = title.toLowerCase();
    return keywords.some(k => lower.includes(k));
  }

  cleanTitle(title) {
    // Remove Google News source suffix
    return title.replace(/ - [^-]+$/, '').trim();
  }

  renderNews() {
    const container = document.getElementById('news-content');
    if (!container) return;

    let items = [...this.newsItems].sort((a, b) => b.date - a.date);
    
    // Remove duplicates by title similarity
    const seen = new Set();
    items = items.filter(item => {
      const key = item.title.substring(0, 50).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (this.activeFilter !== 'all') {
      items = items.filter(i => i.tier === this.activeFilter);
    }

    if (items.length === 0) {
      container.innerHTML = `
        <div class="feed-loading"><div class="spinner"></div> ${this.feedSuccesses > 0 ? 'Filtering...' : 'Loading intelligence feeds...'}</div>
      `;
      return;
    }

    container.innerHTML = items.slice(0, 100).map(item => `
      <div class="news-item" onclick="window.open('${item.link}', '_blank')">
        <div class="news-source ${item.tier}">${item.source}</div>
        <div class="news-title">${item.title}</div>
        <div class="news-time">${this.timeAgo(item.date)}</div>
      </div>
    `).join('');
  }

  timeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
    if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
    return Math.floor(seconds / 86400) + 'd ago';
  }

  // ── Map ─────────────────────────────────────────────────────────────────
  initMap() {
    this.map = L.map('theater-map', {
      center: MAP_CONFIG.center,
      zoom: MAP_CONFIG.zoom,
      minZoom: MAP_CONFIG.minZoom,
      maxZoom: MAP_CONFIG.maxZoom,
      zoomControl: true,
      attributionControl: true,
    });

    // Dark basemap
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(this.map);

    this.addConflictZones();
    this.addUSBases();
    this.addUSNavy();
    this.addIranBases();
    this.addIranMissiles();
    this.addIranNuclear();
    this.addIranNavy();
    this.addProxyMarkers();
    this.addAirDefenseOverlay();
    this.addStraitOfHormuz();
    this.addMapModeControl();
    this.renderMapLegend();
  }

  // ── Map Mode (Threat ↔ OOB) ─────────────────────────────────────────────
  addMapModeControl() {
    const self = this;
    const Control = L.Control.extend({
      options: { position: 'topright' },
      onAdd() {
        const div = L.DomUtil.create('div', 'map-mode-toggle');
        div.innerHTML = `
          <button class="map-mode-btn${self.mapMode === 'threat' ? ' active' : ''}" data-mode="threat" title="Live events only (incidents, conflict zones, air traffic)">⚡ THREAT</button>
          <button class="map-mode-btn${self.mapMode === 'oob' ? ' active' : ''}" data-mode="oob" title="Order of Battle — show all hardcoded infrastructure">🛡 OOB</button>
        `;
        L.DomEvent.disableClickPropagation(div);
        L.DomEvent.disableScrollPropagation(div);
        div.addEventListener('click', (e) => {
          const btn = e.target.closest('.map-mode-btn');
          if (btn) self.setMapMode(btn.dataset.mode);
        });
        return div;
      }
    });
    this._mapModeControl = new Control();
    this._mapModeControl.addTo(this.map);
  }

  setMapMode(mode) {
    if (mode !== 'threat' && mode !== 'oob') return;
    if (mode === this.mapMode) return;
    this.mapMode = mode;
    try { localStorage.setItem('sosint.map.mode', mode); } catch (e) {}

    const showStatic = mode === 'oob';
    STATIC_LAYER_KEYS.forEach(key => {
      const group = this.layerGroups[key];
      if (!group) return;
      if (showStatic) {
        this.activeLayers.add(key);
        if (!this.map.hasLayer(group)) this.map.addLayer(group);
      } else {
        this.activeLayers.delete(key);
        if (this.map.hasLayer(group)) this.map.removeLayer(group);
      }
    });

    // Re-sync the toggle button states and legend dim states.
    const toggleEl = document.querySelector('.map-mode-toggle');
    if (toggleEl) {
      toggleEl.querySelectorAll('.map-mode-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.mode === mode);
      });
    }
    this.renderMapLegend();
  }

  createIcon(emoji, size = 20) {
    return L.divIcon({
      html: `<div style="font-size:${size}px;text-align:center;line-height:1;filter:drop-shadow(0 0 4px rgba(0,0,0,0.8));">${emoji}</div>`,
      className: '',
      iconSize: [size + 4, size + 4],
      iconAnchor: [(size + 4) / 2, (size + 4) / 2],
    });
  }

  addConflictZones() {
    const group = L.layerGroup();
    MAP_CONFIG.conflictZones.forEach(zone => {
      L.rectangle(zone.bounds, {
        color: zone.color,
        fillColor: zone.color,
        fillOpacity: 0.04,
        weight: 1,
        opacity: 0.5,
        dashArray: '5, 5',
      }).bindTooltip(zone.name, { className: 'custom-marker-popup' }).addTo(group);
    });
    if (this.activeLayers.has('conflict-zones')) group.addTo(this.map);
    this.layerGroups['conflict-zones'] = group;
  }

  // Cluster options shared by all static OOB layers — keeps overlapping
  // markers manageable when zoomed out across the whole theater.
  _staticClusterOpts() {
    return {
      maxClusterRadius: 38,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
    };
  }

  // Build a clustered layer for static OOB markers. Falls back to a plain
  // L.layerGroup if the markercluster CDN failed to load so the map still
  // works (just without clustering).
  _createStaticGroup() {
    return typeof L.markerClusterGroup === 'function'
      ? L.markerClusterGroup(this._staticClusterOpts())
      : L.layerGroup();
  }

  addUSBases() {
    const group = this._createStaticGroup();
    US_MILITARY.airForce.regionalBases.forEach(base => {
      L.marker(base.pos, { icon: this.createIcon('🇺🇸', 16) })
        .bindPopup(`
          <div class="map-popup-title">🇺🇸 ${base.name}</div>
          <div class="map-popup-detail">
            <strong>Country:</strong> ${base.country}<br>
            <strong>Role:</strong> ${base.role}<br>
            <strong>Aircraft:</strong> ${base.aircraft.join(', ')}
          </div>
        `, { className: 'custom-marker-popup' })
        .addTo(group);
    });
    if (this.activeLayers.has('us-bases')) group.addTo(this.map);
    this.layerGroups['us-bases'] = group;
  }

  addUSNavy() {
    const group = this._createStaticGroup();
    US_MILITARY.navy.carriers.forEach(ship => {
      L.marker(ship.pos, { icon: this.createIcon('⚓', 18) })
        .bindPopup(`
          <div class="map-popup-title">⚓ ${ship.name}</div>
          <div class="map-popup-detail">
            <strong>Class:</strong> ${ship.type}<br>
            <strong>Aircraft:</strong> ${ship.aircraft}<br>
            <strong>Status:</strong> ${ship.status}
          </div>
        `, { className: 'custom-marker-popup' })
        .addTo(group);
    });
    US_MILITARY.navy.destroyers.forEach(ship => {
      L.marker(ship.pos, { icon: this.createIcon('🚢', 14) })
        .bindPopup(`
          <div class="map-popup-title">🚢 ${ship.name}</div>
          <div class="map-popup-detail">
            <strong>Class:</strong> ${ship.type}<br>
            <strong>Status:</strong> ${ship.status}
          </div>
        `, { className: 'custom-marker-popup' })
        .addTo(group);
    });
    US_MILITARY.navy.submarines.forEach(ship => {
      L.marker(ship.pos, { icon: this.createIcon('🔱', 14) })
        .bindPopup(`
          <div class="map-popup-title">🔱 ${ship.name}</div>
          <div class="map-popup-detail">
            <strong>Class:</strong> ${ship.type}<br>
            <strong>Missiles:</strong> ${ship.missiles} Tomahawks<br>
            <strong>Status:</strong> ${ship.status}
          </div>
        `, { className: 'custom-marker-popup' })
        .addTo(group);
    });
    if (this.activeLayers.has('us-navy')) group.addTo(this.map);
    this.layerGroups['us-navy'] = group;
  }

  addIranBases() {
    const group = this._createStaticGroup();
    IRAN_MILITARY.airForce.bases.forEach(base => {
      L.marker(base.pos, { icon: this.createIcon('🇮🇷', 16) })
        .bindPopup(`
          <div class="map-popup-title">🇮🇷 ${base.name}</div>
          <div class="map-popup-detail">
            <strong>Role:</strong> ${base.role}
          </div>
        `, { className: 'custom-marker-popup' })
        .addTo(group);
    });
    if (this.activeLayers.has('iran-bases')) group.addTo(this.map);
    this.layerGroups['iran-bases'] = group;
  }

  addIranMissiles() {
    const group = this._createStaticGroup();
    IRAN_MILITARY.missiles.missileSites.forEach(site => {
      L.marker(site.pos, { icon: this.createIcon('🚀', 16) })
        .bindPopup(`
          <div class="map-popup-title">🚀 ${site.name}</div>
          <div class="map-popup-detail">
            <strong>Type:</strong> Ballistic Missile Site<br>
            <strong>Status:</strong> Active
          </div>
        `, { className: 'custom-marker-popup' })
        .addTo(group);
    });
    if (this.activeLayers.has('iran-missiles')) group.addTo(this.map);
    this.layerGroups['iran-missiles'] = group;
  }

  addIranNuclear() {
    const group = this._createStaticGroup();
    IRAN_MILITARY.nuclear.facilities.forEach(fac => {
      L.marker(fac.pos, { icon: this.createIcon('☢️', 18) })
        .bindPopup(`
          <div class="map-popup-title">☢️ ${fac.name}</div>
          <div class="map-popup-detail">
            <strong>Type:</strong> ${fac.type}<br>
            <strong>Status:</strong> ${fac.status}<br>
            <strong>Detail:</strong> ${fac.detail}
          </div>
        `, { className: 'custom-marker-popup' })
        .addTo(group);
    });
    if (this.activeLayers.has('iran-nuclear')) group.addTo(this.map);
    this.layerGroups['iran-nuclear'] = group;
  }

  addIranNavy() {
    const group = this._createStaticGroup();
    IRAN_MILITARY.navy.irgcn.bases.forEach(base => {
      L.marker(base.pos, { icon: this.createIcon('⛵', 14) })
        .bindPopup(`
          <div class="map-popup-title">⛵ ${base.name}</div>
          <div class="map-popup-detail">
            <strong>Role:</strong> ${base.role}<br>
            <strong>Force:</strong> IRGC Navy
          </div>
        `, { className: 'custom-marker-popup' })
        .addTo(group);
    });
    if (this.activeLayers.has('iran-navy')) group.addTo(this.map);
    this.layerGroups['iran-navy'] = group;
  }

  addProxyMarkers() {
    const group = this._createStaticGroup();
    PROXY_FORCES.forEach(proxy => {
      L.marker(proxy.pos, { icon: this.createIcon('💥', 16) })
        .bindPopup(`
          <div class="map-popup-title">${proxy.name}</div>
          <div class="map-popup-detail">
            <strong>Country:</strong> ${proxy.country}<br>
            <strong>Personnel:</strong> ${proxy.personnel}<br>
            <strong>Status:</strong> ${proxy.status}<br>
            <strong>Capabilities:</strong> ${proxy.capabilities.join(', ')}
          </div>
        `, { className: 'custom-marker-popup' })
        .addTo(group);
    });
    if (this.activeLayers.has('proxy-forces')) group.addTo(this.map);
    this.layerGroups['proxy-forces'] = group;
  }

  addLiveIncidents() {
    if (!this.map || !this.liveIncidents) return;
    
    // Clear existing layer if present
    if (this.layerGroups['live-incidents']) {
      this.map.removeLayer(this.layerGroups['live-incidents']);
    }

    const group = L.layerGroup();
    this.liveIncidents.forEach(incident => {
      // Determine icon based on category
      let iconEmoji = '⚠️';
      if (incident.category === 'airstrike') iconEmoji = '☄️';
      else if (incident.category === 'naval') iconEmoji = '🚢';
      else if (incident.category === 'explosion') iconEmoji = '💥';
      
      const pulseHtml = `
        <div class="incident-marker" style="position:relative;">
          <div style="font-size:16px;text-align:center;line-height:1;filter:drop-shadow(0 0 4px ${incident.color}); z-index:2; position:relative;">${iconEmoji}</div>
          <div style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); width:30px; height:30px; background:${incident.color}44; border-radius:50%; animation: pulse 2s infinite; z-index:1;"></div>
        </div>
      `;

      const icon = L.divIcon({
        html: pulseHtml,
        className: '',
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });

      L.marker([incident.lat, incident.lon], { icon })
        .bindPopup(`
          <div class="map-popup-title" style="color: ${incident.color}">${incident.title}</div>
          <div class="map-popup-detail">
            <strong>Source:</strong> ${incident.domain}<br>
            <strong>Category:</strong> ${incident.category.toUpperCase()}<br>
            <a href="${incident.url}" target="_blank" style="color:#60a5fa;text-decoration:none;font-size:11px;margin-top:4px;display:inline-block;">Read Full Report ↗</a>
          </div>
        `, { className: 'custom-marker-popup' })
        .addTo(group);
    });
    
    group.addTo(this.map);
    this.layerGroups['live-incidents'] = group;
    // Auto-enable the layer
    this.activeLayers.add('live-incidents');
    this.renderMapLegend();
  }

  addAirDefenseOverlay() {
    const group = this._createStaticGroup();
    IRAN_MILITARY.airDefense.sites.forEach(site => {
      L.marker(site.pos, { icon: this.createIcon('🛡️', 14) })
        .bindPopup(`
          <div class="map-popup-title">🛡️ ${site.name}</div>
          <div class="map-popup-detail">
            <strong>Systems:</strong> ${site.systems.join(', ')}
          </div>
        `, { className: 'custom-marker-popup' })
        .addTo(group);
    });
    if (this.activeLayers.has('air-defense')) group.addTo(this.map);
    this.layerGroups['air-defense'] = group;
  }

  addStraitOfHormuz() {
    // Shipping lane indicator
    const straitLine = [
      [26.57, 56.25],
      [26.44, 56.43],
      [26.07, 56.95],
    ];
    L.polyline(straitLine, {
      color: '#f59e0b',
      weight: 3,
      dashArray: '8, 4',
      opacity: 0.7,
    }).bindTooltip('Strait of Hormuz — 21M bbl/day', { className: 'custom-marker-popup' }).addTo(this.map);
  }

  renderMapLegend() {
    const legend = document.getElementById('map-legend');
    const items = [
      { key: 'us-bases', label: 'US Bases', color: '#3b82f6', icon: '🇺🇸' },
      { key: 'us-navy', label: 'US Navy', color: '#3b82f6', icon: '⚓' },
      { key: 'iran-bases', label: 'Iran AF', color: '#ef4444', icon: '🇮🇷' },
      { key: 'iran-missiles', label: 'Missiles', color: '#ef4444', icon: '🚀' },
      { key: 'iran-nuclear', label: 'Nuclear', color: '#8b5cf6', icon: '☢️' },
      { key: 'iran-navy', label: 'Iran Navy', color: '#ef4444', icon: '⛵' },
      { key: 'proxy-forces', label: 'Proxies', color: '#f97316', icon: '💥' },
      { key: 'air-defense', label: 'Air Def', color: '#8b5cf6', icon: '🛡️' },
      { key: 'air-traffic', label: 'Air Traffic', color: '#06b6d4', icon: '✈️', dynamic: true },
      { key: 'india', label: '🇮🇳 India', color: '#ff9933', icon: '🇮🇳', dynamic: true, infoOnly: true },
    ];

    legend.innerHTML = items.map(item => `
      <div class="legend-item ${this.activeLayers.has(item.key) ? '' : 'inactive'}" data-layer="${item.key}">
        <span style="font-size:11px">${item.icon}</span>
        <span>${item.label}</span>
        ${item.dynamic ? `<span class="legend-count" id="count-${item.key}">0</span>` : ''}
      </div>
    `).join('');

    legend.querySelectorAll('.legend-item').forEach(el => {
      el.addEventListener('click', () => {
        const layer = el.dataset.layer;
        if (this.activeLayers.has(layer)) {
          this.activeLayers.delete(layer);
          if (this.layerGroups[layer]) this.map.removeLayer(this.layerGroups[layer]);
          el.classList.add('inactive');
        } else {
          this.activeLayers.add(layer);
          if (this.layerGroups[layer]) this.map.addLayer(this.layerGroups[layer]);
          el.classList.remove('inactive');
        }
      });
    });

    // Re-apply stored live counts (legend HTML rebuilds reset them to 0)
    this.refreshLegendCounts();
  }

  refreshLegendCounts() {
    const air = document.getElementById('count-air-traffic');
    if (air && this._airTrafficCountLabel != null) air.textContent = this._airTrafficCountLabel;
  }

  // ── Military Comparison ─────────────────────────────────────────────────
  renderMilitaryComparison() {
    const content = document.getElementById('right-top-content');
    
    let liveAssetsHtml = '';
    if (this.liveAssets && this.liveAssets.length > 0) {
      liveAssetsHtml = `
        <div class="asset-section" style="border: 1px solid #10b981; background: rgba(16, 185, 129, 0.05); padding: 8px;">
          <div class="asset-section-title" style="color: #10b981; display:flex; justify-content:space-between;">
            <span><span class="status-dot live"></span> LIVE OSINT DEPLOYMENTS</span>
            <span style="font-size: 10px; opacity: 0.7;">via News Feeds</span>
          </div>
          <div style="font-size: 11px; margin-bottom: 6px; color: #cbd5e1;">Tracked US Naval & Amphibious Assets:</div>
          ${this.liveAssets.map(asset => `
            <div style="display:flex; justify-content:space-between; margin-bottom: 4px; font-size: 11px;">
              <span style="color:#60a5fa">⚓ ${asset.name}</span>
              <span style="color:${asset.status.includes('Red Sea') ? '#ef4444' : '#f59e0b'}">${asset.status.replace('Deployed - ', '')}</span>
            </div>
          `).join('')}
        </div>
      `;
    }

    content.innerHTML = `
      ${liveAssetsHtml}
      <div class="asset-section">
        <div class="asset-section-title">🇺🇸 United States vs 🇮🇷 Iran — Personnel</div>
        ${this.compRow('1,328,000', 'Active Military', '610,000', 100, 46)}
        ${this.compRow('800,000', 'Reserves', '350,000', 100, 44)}
        ${this.compRow('45,000', 'CENTCOM Region', '190,000 (IRGC)', 23, 100)}
      </div>
      <div class="asset-section">
        <div class="asset-section-title">Naval Forces</div>
        ${this.compRow('11 Carriers', 'Aircraft Carriers', '0', 100, 0)}
        ${this.compRow('92', 'Destroyers/Cruisers', '6 Frigates', 100, 6)}
        ${this.compRow('68', 'Submarines', '26', 100, 38)}
        ${this.compRow('290', 'Total Warships', '398', 73, 100)}
      </div>
      <div class="asset-section">
        <div class="asset-section-title">Air Power</div>
        ${this.compRow('5,217', 'Total Aircraft', '551', 100, 11)}
        ${this.compRow('1,954', '5th Gen + 4th Gen', '202', 100, 10)}
        ${this.compRow('140', 'Bombers (B-2/B-1/B-52)', '0', 100, 0)}
        ${this.compRow('~400', 'Combat UAVs', 'Mass Prod (Shahed)', 40, 100)}
      </div>
      <div class="asset-section">
        <div class="asset-section-title">Missile Forces</div>
        ${this.compRow('4,000+', 'Cruise Missiles', '~500', 100, 12)}
        ${this.compRow('GBI/SM-3/THAAD', 'BMD Capability', 'Bavar-373/S-300', 100, 45)}
        ${this.compRow('Trident D5', 'Nuclear ICBMs', 'None (claimed)', 100, 0)}
        ${this.compRow('~100', 'Tactical BMs', '~3,000+', 3, 100)}
      </div>
    `;
  }

  compRow(usVal, label, irVal, usPct, irPct) {
    return `
      <div class="comparison-row">
        <div class="comparison-us">
          <div class="comparison-value">${usVal}</div>
          <div class="comparison-bar us" style="width: ${usPct}%"></div>
        </div>
        <div class="comparison-label">${label}</div>
        <div class="comparison-ir">
          <div class="comparison-value">${irVal}</div>
          <div class="comparison-bar ir" style="width: ${irPct}%"></div>
        </div>
      </div>
    `;
  }

  // ── Threat Level ────────────────────────────────────────────────────────
  renderThreatLevel() {
    const content = document.getElementById('right-top-content');
    
    // Use dynamic metrics if available
    let compositeScore = 7;
    let label = "HIGH — ELEVATED";
    let isLive = false;
    
    if (this.globalMetrics && this.globalMetrics.threat) {
        compositeScore = this.globalMetrics.threat.level;
        label = this.globalMetrics.threat.label;
        isLive = true;
    }
    
    const gaugeClass = compositeScore >= 9 ? 'critical' : compositeScore >= 7 ? 'high' : 'medium';
    const gaugeColor = compositeScore >= 9 ? '#ef4444' : compositeScore >= 7 ? '#f97316' : '#f59e0b';
    
    content.innerHTML = `
      <div class="threat-gauge-container">
        ${isLive ? '<div style="position:absolute; top: 10px; right: 10px; font-size: 10px; font-weight: bold; color: #10b981;"><span class="status-dot live"></span> LIVE OSINT</div>' : ''}
        <div class="threat-gauge">
          <div class="threat-gauge-fill ${gaugeClass}" style="background: ${gaugeColor}"></div>
        </div>
        <div class="threat-level-label ${gaugeClass}" style="color: ${gaugeColor}">${label}</div>
      </div>
      <div class="threat-factors">
        <div class="sub-section-title">Threat Factors</div>
        ${this.threatFactor('Nuclear Breakout Risk', compositeScore >= 8 ? 9 : 8, '#ef4444')}
        ${this.threatFactor('Proxy Conflict Intensity', compositeScore >= 8 ? 9 : 8, '#f97316')}
        ${this.threatFactor('Naval Confrontation', compositeScore >= 7 ? 8 : 7, '#f59e0b')}
        ${this.threatFactor('Cyber Operations Tempo', 6, '#f59e0b')}
        ${this.threatFactor('Diplomatic Channels', 3, '#22c55e')}
        ${this.threatFactor('Economic Pressure', 8, '#f97316')}
        ${this.threatFactor('Regional Instability', compositeScore, compositeScore >= 8 ? '#ef4444' : '#f97316')}
        ${this.threatFactor('Direct Military Exchange', compositeScore - 1, '#f59e0b')}
        <div style="margin-top:10px; font-size:9px; color: var(--text-muted); font-family: var(--font-mono);">
          Composite Score: <span style="color: ${gaugeColor}; font-weight:700;">${compositeScore.toFixed(1)} / 10</span>
          <br>Assessment: ${label.toLowerCase()}
        </div>
      </div>
    `;
  }

  threatFactor(label, level, color) {
    return `
      <div class="threat-factor">
        <div class="threat-factor-dot" style="background:${color}; box-shadow: 0 0 4px ${color}"></div>
        <span class="threat-factor-label">${label}</span>
        <span class="threat-factor-value" style="color:${color}">${level}/10</span>
      </div>
    `;
  }

  // ── Nuclear Status ──────────────────────────────────────────────────────
  renderNuclearStatus() {
    const content = document.getElementById('right-top-content');
    const enrichment = IRAN_MILITARY.nuclear.enrichment;
    
    // Live override from globalMetrics
    let enrichmentStr = enrichment.current;
    let breakoutStr = enrichment.breakoutTime;
    let isLive = false;
    
    if (this.globalMetrics && this.globalMetrics.nuclear) {
      enrichmentStr = this.globalMetrics.nuclear.enrichment || enrichmentStr;
      breakoutStr = this.globalMetrics.nuclear.breakout || breakoutStr;
      isLive = true;
    }

    content.innerHTML = `
      <div class="sub-section">
        <div class="sub-section-title" style="display:flex; justify-content:space-between; align-items:center;">
          Enrichment Status
          ${isLive ? '<span style="font-size: 10px; font-weight: bold; color: #10b981;"><span class="status-dot live"></span> LIVE OSINT</span>' : ''}
        </div>
        <div class="enrichment-bar">
          <div class="enrichment-fill" style="width: 66%; background: linear-gradient(90deg, #22c55e 0%, #f59e0b 40%, #f97316 60%, #ef4444 100%);">
            ${enrichmentStr}
          </div>
          <div class="enrichment-marker" style="left: 100%;">
            <div class="enrichment-marker-label">90% WG</div>
          </div>
          <div class="enrichment-marker" style="left: 4.4%;">
            <div class="enrichment-marker-label" style="color: var(--accent-green);">3.67% JCPOA</div>
          </div>
        </div>
        <div class="nuclear-stat">
          <span class="nuclear-label">Current Enrichment</span>
          <span class="nuclear-value danger">${enrichmentStr}</span>
        </div>
        <div class="nuclear-stat">
          <span class="nuclear-label">Weapon-Grade Threshold</span>
          <span class="nuclear-value warning">${enrichment.weaponGrade}</span>
        </div>
        <div class="nuclear-stat">
          <span class="nuclear-label">Estimated Breakout Time</span>
          <span class="nuclear-value danger">${breakoutStr}</span>
        </div>
        <div class="nuclear-stat">
          <span class="nuclear-label">60% HEU Stockpile</span>
          <span class="nuclear-value danger">${enrichment.stockpile}</span>
        </div>
      </div>
      <div class="sub-section">
        <div class="sub-section-title">Nuclear Facilities</div>
        ${IRAN_MILITARY.nuclear.facilities.map(f => `
          <div class="facility-item">
            <span class="facility-icon">☢️</span>
            <div>
              <div class="facility-name">${f.name}</div>
              <div class="facility-type">${f.type}</div>
              <div class="facility-status">${f.status}</div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // ── Air Defense ─────────────────────────────────────────────────────────
  renderAirDefense() {
    const content = document.getElementById('right-top-content');
    content.innerHTML = `
      <div class="sub-section">
        <div class="sub-section-title">🇮🇷 Iranian Air Defense Systems</div>
        ${IRAN_MILITARY.airDefense.systems.map(sys => `
          <div class="defense-system">
            <div>
              <div class="defense-name">${sys.name}</div>
              <div style="font-size:8px; color: var(--text-muted)">${sys.type}</div>
            </div>
            <div class="defense-range">${sys.range}km</div>
            <div class="defense-origin">${sys.origin}</div>
          </div>
        `).join('')}
      </div>
      <div class="sub-section">
        <div class="sub-section-title">🇺🇸 US BMD / Air Defense (Regional)</div>
        <div class="defense-system">
          <div><div class="defense-name">Patriot PAC-3</div><div style="font-size:8px; color: var(--text-muted)">Tactical BMD</div></div>
          <div class="defense-range">160km</div>
          <div class="defense-origin">US (Qatar/UAE/KSA)</div>
        </div>
        <div class="defense-system">
          <div><div class="defense-name">THAAD</div><div style="font-size:8px; color: var(--text-muted)">Theater BMD</div></div>
          <div class="defense-range">200km</div>
          <div class="defense-origin">US (UAE/Israel)</div>
        </div>
        <div class="defense-system">
          <div><div class="defense-name">SM-3 Block IIA</div><div style="font-size:8px; color: var(--text-muted)">Aegis BMD</div></div>
          <div class="defense-range">700km+</div>
          <div class="defense-origin">US Navy</div>
        </div>
        <div class="defense-system">
          <div><div class="defense-name">SM-6</div><div style="font-size:8px; color: var(--text-muted)">AAW/BMD Dual</div></div>
          <div class="defense-range">370km</div>
          <div class="defense-origin">US Navy</div>
        </div>
        <div class="defense-system">
          <div><div class="defense-name">Iron Dome</div><div style="font-size:8px; color: var(--text-muted)">C-RAM</div></div>
          <div class="defense-range">70km</div>
          <div class="defense-origin">Israel (US co-prod)</div>
        </div>
        <div class="defense-system">
          <div><div class="defense-name">Arrow 3</div><div style="font-size:8px; color: var(--text-muted)">Exo-atmospheric BMD</div></div>
          <div class="defense-range">2,400km</div>
          <div class="defense-origin">Israel</div>
        </div>
      </div>
      <div class="sub-section">
        <div class="sub-section-title">Coverage Zones</div>
        ${IRAN_MILITARY.airDefense.sites.map(site => `
          <div style="font-size:9px; padding: 3px 0; color: var(--text-secondary);">
            🛡️ <strong style="color: var(--text-primary)">${site.name}</strong> — ${site.systems.join(', ')}
          </div>
        `).join('')}
      </div>
    `;
  }

  // ── Proxy Forces ────────────────────────────────────────────────────────
  renderProxyForces() {
    const content = document.getElementById('left-bottom-content');
    let liveProxyBadge = '';
    
    if (this.globalMetrics && this.globalMetrics.proxies) {
      liveProxyBadge = '<div style="font-size: 10px; font-weight: bold; color: #10b981; margin-bottom: 8px;"><span class="status-dot live"></span> LIVE OSINT OVERRIDE</div>';
      PROXY_FORCES.forEach(proxy => {
        if (this.globalMetrics.proxies[proxy.name]) {
            proxy.status = this.globalMetrics.proxies[proxy.name];
        }
      });
    }

    content.innerHTML = liveProxyBadge + PROXY_FORCES.map(proxy => {
      const isElevated = proxy.status.toLowerCase().includes('elevated');
      const isDegraded = proxy.status.toLowerCase().includes('degraded');
      const statusClass = isElevated ? 'elevated' : (isDegraded ? 'degraded' : 'active');
      const statusColor = isElevated ? '#ef4444' : (isDegraded ? '#64748b' : '#f59e0b');
      
      return `
      <div class="proxy-card" onclick="dashboard.map.flyTo([${proxy.pos}], 7)">
        <div class="proxy-header">
          <span class="proxy-name" style="color: ${proxy.color}">${proxy.name}</span>
          <span class="proxy-status ${statusClass}" style="color: ${statusColor}; border-color: ${statusColor}">${proxy.status.toUpperCase()}</span>
        </div>
        <div class="proxy-detail">
          <span>📍 ${proxy.country}</span> · <span>👥 ${proxy.personnel}</span><br>
          <span>🎯 ${proxy.capabilities.slice(0, 3).join(', ')}</span><br>
          <span>💰 ${proxy.funding}</span>
          ${proxy.subGroups ? `<br><span style="color: var(--text-muted)">Sub-groups: ${proxy.subGroups.join(', ')}</span>` : ''}
        </div>
      </div>
      `;
    }).join('');
  }

  // ── Strait of Hormuz ────────────────────────────────────────────────────
  renderStraitMonitor() {
    const content = document.getElementById('left-bottom-content');
    const s = STRAIT_OF_HORMUZ;
    content.innerHTML = `
      <div class="sub-section">
        <div class="sub-section-title">Chokepoint Statistics</div>
        <div class="strait-stat"><span class="strait-label">Narrowest Width</span><span class="strait-value">${s.width.narrowest} km</span></div>
        <div class="strait-stat"><span class="strait-label">Shipping Lane Width</span><span class="strait-value">${s.shippingLanes.width} km (each)</span></div>
        <div class="strait-stat"><span class="strait-label">Daily Oil Flow</span><span class="strait-value">${s.oilFlow.daily}M bbl/day</span></div>
        <div class="strait-stat"><span class="strait-label">Global Oil Share</span><span class="strait-value">${s.oilFlow.worldShare}</span></div>
        <div class="strait-stat"><span class="strait-label">LNG Flow</span><span class="strait-value">${s.lngFlow.daily} Bcf/day</span></div>
        <div class="strait-stat"><span class="strait-label">Global LNG Share</span><span class="strait-value">${s.lngFlow.worldShare}</span></div>
      </div>
      <div class="sub-section">
        <div class="sub-section-title">⚠️ Threats</div>
        ${s.threats.map(t => `<div class="strait-threat">${t}</div>`).join('')}
      </div>
      <div class="sub-section">
        <div class="sub-section-title">Recent Incidents</div>
        ${s.recentIncidents.map(inc => `
          <div class="strait-incident">
            <span class="strait-incident-date">${inc.date}</span>
            <span class="strait-incident-text">${inc.event}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  // ── Sanctions ───────────────────────────────────────────────────────────
  renderSanctions() {
    const content = document.getElementById('left-bottom-content');
    const s = SANCTIONS_DATA;
    content.innerHTML = `
      <div class="sub-section">
        <div class="sub-section-title">US Sanctions Designations (${s.usSanctions.totalDesignations}+ total)</div>
        ${s.usSanctions.categories.map(c => `
          <div class="sanction-category">
            <span class="sanction-name">${c.name}</span>
            <span class="sanction-count">${c.count}</span>
          </div>
        `).join('')}
      </div>
      <div class="sub-section">
        <div class="sub-section-title">Economic Impact</div>
        <div class="economic-stat">
          <span class="economic-stat-label">Oil Exports (peak → current)</span>
          <span class="economic-stat-value" style="color: var(--accent-red)">${s.economicImpact.oilExports.peak}M → ${s.economicImpact.oilExports.current}M bbl/d</span>
        </div>
        <div class="economic-stat">
          <span class="economic-stat-label">GDP</span>
          <span class="economic-stat-value">${s.economicImpact.gdp.value}B USD</span>
        </div>
        <div class="economic-stat">
          <span class="economic-stat-label">Inflation</span>
          <span class="economic-stat-value" style="color: var(--accent-red)">${s.economicImpact.inflation}</span>
        </div>
        <div class="economic-stat">
          <span class="economic-stat-label">Brent Crude Oil</span>
          <span class="economic-stat-value" style="color: ${this.globalMetrics?.economy?.brentCrude ? '#10b981' : 'var(--accent-red)'}">${this.globalMetrics?.economy?.brentCrude ? '<span class="status-dot live"></span> $' + this.globalMetrics.economy.brentCrude : '$82.50 (Est)'}</span>
        </div>
        <div class="economic-stat">
          <span class="economic-stat-label">Rial (Official / Market)</span>
          <span class="economic-stat-value" style="color: var(--accent-red)">${s.economicImpact.rialRate.official.toLocaleString()} / <span style="${this.globalMetrics?.economy?.irrFreeMarket ? 'color:#10b981;' : ''}">${this.globalMetrics?.economy?.irrFreeMarket ? '<span class="status-dot live"></span>' + this.globalMetrics.economy.irrFreeMarket.toLocaleString() : s.economicImpact.rialRate.market.toLocaleString()}</span></span>
        </div>
        <div class="economic-stat">
          <span class="economic-stat-label">Unemployment (official / est.)</span>
          <span class="economic-stat-value">${s.economicImpact.unemploymentOfficial} / ${s.economicImpact.unemploymentReality}</span>
        </div>
        <div class="economic-stat">
          <span class="economic-stat-label">Foreign Reserves</span>
          <span class="economic-stat-value">${s.economicImpact.foreignReserves}</span>
        </div>
      </div>
      <div class="sub-section">
        <div class="sub-section-title">Key Sanctions Events</div>
        ${s.keyEvents.map(ev => `
          <div class="strait-incident">
            <span class="strait-incident-date">${ev.date.slice(0, 7)}</span>
            <span class="strait-incident-text"><strong>${ev.event}</strong><br>${ev.impact}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  // ── Cyber Operations ────────────────────────────────────────────────────
  renderCyberOps() {
    const content = document.getElementById('right-bottom-content');
    content.innerHTML = `
      <div class="cyber-section-title">🇺🇸 US / Allied Operations</div>
      ${CYBER_OPS.usOperations.map(op => `
        <div class="cyber-op">
          <div class="cyber-op-name">${op.name} <span class="cyber-op-year">(${op.year})</span></div>
          <div class="cyber-op-target">Target: ${op.target}</div>
          <div class="cyber-op-target">Impact: ${op.impact} · <em>${op.type}</em></div>
        </div>
      `).join('')}
      <div class="cyber-section-title iran">🇮🇷 Iranian Operations</div>
      ${CYBER_OPS.iranianOperations.map(op => `
        <div class="cyber-op">
          <div class="cyber-op-name" style="color: var(--accent-red)">${op.name} <span class="cyber-op-year">(${op.year})</span></div>
          <div class="cyber-op-target">Target: ${op.target}</div>
          <div class="cyber-op-target">Impact: ${op.impact} · <em>${op.type}</em></div>
        </div>
      `).join('')}
    `;

    if (this.globalMetrics && this.globalMetrics.cyber && this.globalMetrics.cyber.length > 0) {
      content.innerHTML = `
        <div class="cyber-section-title" style="color: #10b981; border-bottom: 1px solid #10b98155;"><span class="status-dot live"></span> LIVE CYBER THREAT INTEL</div>
        <div style="margin-bottom: 12px; max-height: 150px; overflow-y: auto;">
          ${this.globalMetrics.cyber.map(news => `
            <div class="cyber-op" style="background: rgba(16,185,129,0.05); margin-bottom: 4px; padding: 6px;">
              <div class="cyber-op-name" style="color: #60a5fa; font-size: 10px;">
                <a href="${news.url}" target="_blank" style="color:inherit; text-decoration:none;">${news.title}</a>
              </div>
              <div style="font-size: 8px; color: var(--text-muted);">${news.published}</div>
            </div>
          `).join('')}
        </div>
      ` + content.innerHTML;
    }
  }

  // ── Timeline ────────────────────────────────────────────────────────────
  renderTimeline() {
    const content = document.getElementById('right-bottom-content');
    const reversed = [...ESCALATION_TIMELINE].reverse();
    content.innerHTML = `
      <div class="timeline-container">
        ${reversed.map(ev => {
          const levelClass = ev.level >= 8 ? 'high' : ev.level >= 5 ? 'medium' : 'low';
          return `
            <div class="timeline-event ${ev.category}">
              <span class="timeline-year">${ev.year}</span>
              <span class="timeline-level ${levelClass}">${ev.level}/10</span>
              <div class="timeline-text">${ev.event}</div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // ── Naval Forces ────────────────────────────────────────────────────────
  renderNavalForces() {
    const content = document.getElementById('right-bottom-content');
    content.innerHTML = `
      <div class="sub-section">
        <div class="sub-section-title">🇺🇸 US 5th Fleet / CENTCOM Naval</div>
        ${US_MILITARY.navy.carriers.map(s => this.navalRow('⚓', s.name, s.type, s.status)).join('')}
        ${US_MILITARY.navy.destroyers.map(s => this.navalRow('🚢', s.name, s.type, s.status)).join('')}
        ${US_MILITARY.navy.submarines.map(s => this.navalRow('🔱', s.name, s.type, s.status)).join('')}
        ${US_MILITARY.navy.amphibious.map(s => this.navalRow('🛳️', s.name, s.type, s.status)).join('')}
      </div>
      <div class="sub-section">
        <div class="sub-section-title">🇮🇷 Iranian Navy (IRIN + IRGCN)</div>
        <div class="naval-asset">
          <span class="naval-icon">🚢</span>
          <div class="naval-info"><span class="naval-name">IRIN Surface Fleet</span><span class="naval-type">6 Frigates, 3 Corvettes, 230 Fast Attack</span></div>
        </div>
        <div class="naval-asset">
          <span class="naval-icon">🔱</span>
          <div class="naval-info"><span class="naval-name">Submarine Force</span><span class="naval-type">3x Kilo-class, 1x Fateh, 23x Ghadir midget</span></div>
        </div>
        <div class="naval-asset">
          <span class="naval-icon">⛵</span>
          <div class="naval-info"><span class="naval-name">IRGCN Fast Attack</span><span class="naval-type">~1,500 armed speedboats (swarm capability)</span></div>
        </div>
        <div class="naval-asset">
          <span class="naval-icon">💣</span>
          <div class="naval-info"><span class="naval-name">Mine Warfare</span><span class="naval-type">5,000+ naval mines inventory</span></div>
        </div>
        <div class="naval-asset">
          <span class="naval-icon">🚀</span>
          <div class="naval-info"><span class="naval-name">Anti-Ship Missiles</span><span class="naval-type">Khalij Fars ASBM, Noor (C-802), Ghader, Nasir</span></div>
        </div>
      </div>
      <div class="sub-section">
        <div class="sub-section-title">🇮🇷 IRGCN Bases</div>
        ${IRAN_MILITARY.navy.irgcn.bases.map(b => `
          <div style="font-size: 9px; padding: 3px 0; color: var(--text-secondary);">
            ⛵ <strong style="color: var(--text-primary)">${b.name}</strong> — ${b.role}
          </div>
        `).join('')}
      </div>
    `;
  }

  navalRow(icon, name, type, status) {
    return `
      <div class="naval-asset">
        <span class="naval-icon">${icon}</span>
        <div class="naval-info">
          <span class="naval-name">${name}</span>
          <span class="naval-type">${type}</span>
        </div>
        <span class="naval-status">${status.split(' - ').pop() || status}</span>
      </div>
    `;
  }
  // ═══════════════════════════════════════════════════════════════════════
  // REAL-TIME AIR TRAFFIC — OpenSky Network API
  // ═══════════════════════════════════════════════════════════════════════

  async loadAirTraffic() {
    if (!this.layerGroups['air-traffic']) {
      this.layerGroups['air-traffic'] = L.layerGroup();
      if (this.activeLayers.has('air-traffic')) {
        this.layerGroups['air-traffic'].addTo(this.map);
      }
    }

    // Live data is now produced server-side by scripts/scrape_air_traffic.py
    // (cron */10) — frontend just reads the committed JSON. This eliminates
    // CORS/proxy flakiness and OpenSky's per-browser-IP rate limits.
    let allAircraft = [];
    let isLive = false;
    let snapshotAgeMin = null;

    try {
      const res = await fetch('air-traffic.json?v=' + Date.now());
      if (res.ok) {
        const data = await res.json();
        allAircraft = (data.aircraft || []).filter(a => a.lat && a.lon);
        if (data.generatedAt) {
          snapshotAgeMin = Math.max(0,
            Math.round((Date.now() - new Date(data.generatedAt).getTime()) / 60000));
        }
        if (allAircraft.length > 0) isLive = true;
      }
    } catch (e) {
      // air-traffic.json missing — fall through to simulation
    }

    // Fallback to simulated traffic when the live snapshot is missing/empty/stale
    if (allAircraft.length === 0 || (snapshotAgeMin != null && snapshotAgeMin > 60)) {
      allAircraft = this.generateSimulatedAirTraffic();
      isLive = false;
    }

    // Filter out ground vehicles and aircraft without position
    allAircraft = allAircraft.filter(a => a.lat && a.lon && !a.onGround);

    // Update the layer
    const group = this.layerGroups['air-traffic'];
    group.clearLayers();
    this.airTrafficCount = allAircraft.length;

    allAircraft.forEach(ac => {
      const alt = ac.altitude ? Math.round(ac.altitude * 3.28084) : '?'; // meters to feet
      const spd = ac.velocity ? Math.round(ac.velocity * 1.944) : '?'; // m/s to knots
      const heading = ac.heading || 0;
      const isIndian = ac.country === 'India' || (ac.callsign && /^(AIC|IGO|6E|SEJ|SG|ALI|VTI|GOW|JAI)/.test(ac.callsign));

      // Indian aircraft get saffron/orange glow; others get cyan
      const glowColor = isIndian ? 'rgba(255,153,51,0.8)' : 'rgba(6,182,212,0.5)';
      const planeColor = isIndian ? '#ff9933' : '#06b6d4';
      const planeSize = isIndian ? 14 : 9;
      // Non-Indian aircraft are visually subordinate so the live-incident
      // and OOB markers remain the primary signal.
      const planeOpacity = isIndian ? 1 : 0.55;

      const icon = L.divIcon({
        html: `<div style="transform: rotate(${heading}deg); opacity:${planeOpacity}; font-size:${planeSize}px; color:${planeColor}; filter: drop-shadow(0 0 4px ${glowColor}); text-align:center; line-height:1;">${isIndian ? '✈' : '✈'}</div>`,
        className: isIndian ? 'air-traffic-icon india-aircraft' : 'air-traffic-icon',
        iconSize: [planeSize + 4, planeSize + 4],
        iconAnchor: [(planeSize + 4) / 2, (planeSize + 4) / 2],
      });

      const indianBadge = isIndian ? '<span style="background:rgba(255,153,51,0.2); border:1px solid #ff9933; padding:1px 5px; border-radius:3px; font-size:8px; color:#ff9933; font-weight:700;">🇮🇳 INDIAN</span><br>' : '';

      L.marker([ac.lat, ac.lon], { icon })
        .bindPopup(`
          <div class="map-popup-title">${isIndian ? '🇮🇳' : '✈️'} ${ac.callsign || ac.icao}</div>
          <div class="map-popup-detail">
            ${indianBadge}
            <strong>Country:</strong> ${ac.country}<br>
            <strong>Altitude:</strong> ${alt} ft<br>
            <strong>Speed:</strong> ${spd} kts<br>
            <strong>Heading:</strong> ${Math.round(heading)}°<br>
            <strong>ICAO:</strong> ${ac.icao}<br>
            <strong>Region:</strong> ${ac.region}
          </div>
        `, { className: 'custom-marker-popup' })
        .addTo(group);
    });

    // Compose count label and apply (survives legend re-renders via refreshLegendCounts)
    this._airTrafficCountLabel = this.airTrafficCount + (
      isLive
        ? ` · LIVE${snapshotAgeMin != null ? ` (${snapshotAgeMin}m)` : ''}`
        : ' · SIM'
    );
    const countEl = document.getElementById('count-air-traffic');
    if (countEl) countEl.textContent = this._airTrafficCountLabel;
  }

  generateSimulatedAirTraffic() {
    // Realistic simulated traffic when OpenSky API is unavailable
    const airlines = [
      // Gulf carriers
      { prefix: 'UAE', country: 'United Arab Emirates', routes: [[25.25, 55.36], [25.08, 55.14]] },
      { prefix: 'QTR', country: 'Qatar', routes: [[25.27, 51.61]] },
      { prefix: 'GFA', country: 'Bahrain', routes: [[26.22, 50.63]] },
      { prefix: 'KAC', country: 'Kuwait', routes: [[29.23, 47.97]] },
      { prefix: 'OMA', country: 'Oman', routes: [[23.59, 58.28]] },
      { prefix: 'SVA', country: 'Saudi Arabia', routes: [[21.67, 39.16], [24.96, 46.70]] },
      // International
      { prefix: 'ETH', country: 'Ethiopia', routes: [[8.98, 38.80]] },
      { prefix: 'THY', country: 'Turkey', routes: [[40.98, 28.82]] },
      { prefix: 'BAW', country: 'United Kingdom', routes: [[51.47, -0.46]] },
      { prefix: 'DLH', country: 'Germany', routes: [[50.03, 8.57]] },
      { prefix: 'AFR', country: 'France', routes: [[49.01, 2.55]] },
      { prefix: 'SIA', country: 'Singapore', routes: [[1.36, 103.99]] },
      { prefix: 'CPA', country: 'Hong Kong', routes: [[22.31, 113.91]] },
      { prefix: 'QFA', country: 'Australia', routes: [[-33.95, 151.18]] },
      { prefix: 'PIA', country: 'Pakistan', routes: [[24.91, 67.16], [33.56, 73.10]] },
      { prefix: 'IRA', country: 'Iran', routes: [[35.69, 51.31]] },
      { prefix: 'MSR', country: 'Egypt', routes: [[30.12, 31.41]] },
      // Indian carriers — heavy representation
      { prefix: 'AIC', country: 'India', routes: [[19.09, 72.87], [28.57, 77.10]] }, // Air India (BOM, DEL)
      { prefix: 'IGO', country: 'India', routes: [[19.09, 72.87], [12.99, 80.17]] }, // IndiGo (BOM, MAA)
      { prefix: 'SEJ', country: 'India', routes: [[19.09, 72.87], [17.24, 78.43]] }, // SpiceJet (BOM, HYD)
      { prefix: 'VTI', country: 'India', routes: [[19.09, 72.87]] },                 // Vistara (BOM)
      { prefix: 'AKJ', country: 'India', routes: [[10.15, 76.40], [15.38, 73.88]] }, // Akasa Air (COK, GOI)
      { prefix: 'AIX', country: 'India', routes: [[23.07, 72.63], [22.31, 70.01]] }, // Air India Express (AMD, RAJ)
      { prefix: 'GOW', country: 'India', routes: [[13.20, 77.71], [26.82, 75.79]] }, // Go First (BLR, JAI)
    ];

    // Indian airline prefixes for weighted selection
    const indianPrefixes = ['AIC', 'IGO', 'SEJ', 'VTI', 'AKJ', 'AIX', 'GOW'];

    const aircraft = [];

    // Generate aircraft over Strait of Hormuz area
    for (let i = 0; i < 25; i++) {
      const airline = airlines[Math.floor(Math.random() * airlines.length)];
      const flightNum = Math.floor(100 + Math.random() * 900);
      const lat = 23.5 + Math.random() * 5.5;
      const lon = 50.0 + Math.random() * 11.0;
      const heading = Math.random() * 360;
      const alt = 8000 + Math.random() * 5000;
      const vel = 200 + Math.random() * 100;

      aircraft.push({
        icao: Math.random().toString(16).slice(2, 8),
        callsign: `${airline.prefix}${flightNum}`,
        country: airline.country,
        lat, lon, altitude: alt, onGround: false, velocity: vel, heading,
        vertRate: (Math.random() - 0.5) * 5, region: 'hormuz',
      });
    }

    // Generate aircraft over Bab al-Mandab / Red Sea area
    for (let i = 0; i < 12; i++) {
      const airline = airlines[Math.floor(Math.random() * airlines.length)];
      const flightNum = Math.floor(100 + Math.random() * 900);
      const lat = 11.5 + Math.random() * 5.0;
      const lon = 41.0 + Math.random() * 5.0;
      const heading = Math.random() * 360;
      const alt = 9000 + Math.random() * 4000;
      const vel = 210 + Math.random() * 90;

      aircraft.push({
        icao: Math.random().toString(16).slice(2, 8),
        callsign: `${airline.prefix}${flightNum}`,
        country: airline.country,
        lat, lon, altitude: alt, onGround: false, velocity: vel, heading,
        vertRate: (Math.random() - 0.5) * 3, region: 'mandab',
      });
    }

    // ── Arabian Sea corridor (Gulf → India) ───────────────────────────────
    // This is one of the busiest air corridors in the world
    for (let i = 0; i < 20; i++) {
      // 60% chance Indian carrier, 40% Gulf carrier
      const isIndian = Math.random() < 0.6;
      let airline;
      if (isIndian) {
        const indianAirlines = airlines.filter(a => indianPrefixes.includes(a.prefix));
        airline = indianAirlines[Math.floor(Math.random() * indianAirlines.length)];
      } else {
        airline = airlines[Math.floor(Math.random() * airlines.length)];
      }
      const flightNum = Math.floor(100 + Math.random() * 900);
      // Arc from Gulf (lon ~57) to India west coast (lon ~72), lat 15-24
      const progress = Math.random();
      const lat = 15.0 + Math.random() * 9.0;
      const lon = 57.0 + progress * 16.0; // 57 to 73
      // Eastbound heading ~90-120° (towards India)
      const heading = 80 + Math.random() * 40;
      const alt = 10000 + Math.random() * 3000;
      const vel = 220 + Math.random() * 60;

      aircraft.push({
        icao: Math.random().toString(16).slice(2, 8),
        callsign: `${airline.prefix}${flightNum}`,
        country: airline.country,
        lat, lon, altitude: alt, onGround: false, velocity: vel, heading,
        vertRate: (Math.random() - 0.5) * 2, region: 'arabian-sea',
      });
    }

    // ── Westbound from India (returning flights) ──────────────────────────
    for (let i = 0; i < 15; i++) {
      const isIndian = Math.random() < 0.6;
      let airline;
      if (isIndian) {
        const indianAirlines = airlines.filter(a => indianPrefixes.includes(a.prefix));
        airline = indianAirlines[Math.floor(Math.random() * indianAirlines.length)];
      } else {
        airline = airlines[Math.floor(Math.random() * airlines.length)];
      }
      const flightNum = Math.floor(100 + Math.random() * 900);
      const progress = Math.random();
      const lat = 16.0 + Math.random() * 8.0;
      const lon = 73.0 - progress * 16.0; // 73 to 57
      // Westbound heading ~260-290° (towards Gulf)
      const heading = 260 + Math.random() * 30;
      const alt = 10000 + Math.random() * 3000;
      const vel = 220 + Math.random() * 60;

      aircraft.push({
        icao: Math.random().toString(16).slice(2, 8),
        callsign: `${airline.prefix}${flightNum}`,
        country: airline.country,
        lat, lon, altitude: alt, onGround: false, velocity: vel, heading,
        vertRate: (Math.random() - 0.5) * 2, region: 'india-coast',
      });
    }

    // ── Indian west coast domestic/approach flights ────────────────────────
    const indianCoastAirports = [
      { name: 'Mumbai BOM', lat: 19.09, lon: 72.87 },
      { name: 'Goa GOI', lat: 15.38, lon: 73.88 },
      { name: 'Cochin COK', lat: 10.15, lon: 76.40 },
      { name: 'Mangalore IXE', lat: 12.96, lon: 74.89 },
      { name: 'Ahmedabad AMD', lat: 23.07, lon: 72.63 },
      { name: 'Trivandrum TRV', lat: 8.48, lon: 76.92 },
      { name: 'Calicut CCJ', lat: 11.14, lon: 75.96 },
    ];

    for (let i = 0; i < 10; i++) {
      const indianAirlines = airlines.filter(a => indianPrefixes.includes(a.prefix));
      const airline = indianAirlines[Math.floor(Math.random() * indianAirlines.length)];
      const flightNum = Math.floor(100 + Math.random() * 900);
      const airport = indianCoastAirports[Math.floor(Math.random() * indianCoastAirports.length)];
      // Near approach — within 2° of airport, coming from west (sea)
      const lat = airport.lat + (Math.random() - 0.5) * 3;
      const lon = airport.lon - 1 - Math.random() * 4; // west of airport, over sea
      const heading = 70 + Math.random() * 40; // eastbound approach
      const alt = 3000 + Math.random() * 8000; // descending
      const vel = 180 + Math.random() * 80;

      aircraft.push({
        icao: Math.random().toString(16).slice(2, 8),
        callsign: `${airline.prefix}${flightNum}`,
        country: 'India',
        lat, lon, altitude: alt, onGround: false, velocity: vel, heading,
        vertRate: -2 - Math.random() * 5, region: 'india-coast',
      });
    }

    return aircraft;
  }


  // ═══════════════════════════════════════════════════════════════════════
  // GLOBAL SENTIMENT ANALYSIS — INFOGRAPHIC & WORD CLOUD
  // ═══════════════════════════════════════════════════════════════════════

  async initSentimentRefresh() {
    try {
      this.sentimentData = await fetchSentimentData(this.sentimentMode);
    } catch (e) {
      this.sentimentData = generateSentimentData(this.sentimentMode);
    }
    // Refresh every 2 hours
    setInterval(async () => {
      _sentimentCache.fetchedAt = 0; // Invalidate cache to force fresh fetch
      try {
        this.sentimentData = await fetchSentimentData(this.sentimentMode);
      } catch (e) {
        this.sentimentData = generateSentimentData(this.sentimentMode);
      }
      // Re-render if sentiment tab is active
      const activeTab = document.querySelector('#right-bottom-tabs .tab-btn.active');
      if (activeTab && activeTab.dataset.tab === 'sentiment') {
        this.renderSentimentPanel();
      }
    }, 7200000);
    // Update countdown every minute
    setInterval(() => {
      const el = document.getElementById('sentiment-refresh-countdown');
      if (el && this.sentimentData) {
        const remaining = this.sentimentData.nextRefresh - Date.now();
        if (remaining > 0) {
          const h = Math.floor(remaining / 3600000);
          const m = Math.floor((remaining % 3600000) / 60000);
          el.textContent = `${h}h ${m}m`;
        } else {
          el.textContent = 'Refreshing...';
        }
      }
    }, 60000);
  }

  async renderSentimentPanel() {
    const content = document.getElementById('right-bottom-content');

    // Show loading state on first load
    if (!this.sentimentData || this.sentimentData.mode !== this.sentimentMode) {
      content.innerHTML = `<div class="sentiment-panel" style="display:flex;align-items:center;justify-content:center;padding:20px;"><div class="spinner"></div><span style="margin-left:10px;color:var(--text-secondary);font-size:11px;">Loading sentiment data...</span></div>`;
      try {
        this.sentimentData = await fetchSentimentData(this.sentimentMode);
      } catch (e) {
        this.sentimentData = generateSentimentData(this.sentimentMode);
      }
    }

    const d = this.sentimentData;
    const elapsed = Date.now() - d.generatedAt.getTime();
    const elapsedMin = Math.floor(elapsed / 60000);
    const remaining = d.nextRefresh - Date.now();
    const remH = Math.floor(Math.max(0, remaining) / 3600000);
    const remM = Math.floor((Math.max(0, remaining) % 3600000) / 60000);

    const isLive = d.dataSource === 'live-rss';
    const sourceLabel = isLive ? '📡 LIVE' : '⚡ SIM';
    const sourceClass = isLive ? 'source-live' : 'source-sim';
    const statsLine = isLive && d.articlesAnalyzed
      ? `<span class="sentiment-stats">${d.articlesAnalyzed} articles · ${d.matchedMentions} mentions</span>`
      : '';

    content.innerHTML = `
      <div class="sentiment-panel">
        <div class="sentiment-mode-toggle">
          <button class="sentiment-mode-btn ${this.sentimentMode === 'us' ? 'active' : ''}" data-mode="us">🇺🇸 US Mode</button>
          <button class="sentiment-mode-btn ${this.sentimentMode === 'india' ? 'active' : ''}" data-mode="india">🇮🇳 India Mode</button>
        </div>

        <div class="sentiment-header-row">
          <div class="sentiment-total">Tracking <span class="sentiment-highlight">${d.totalPersonalities}</span> voices <span class="sentiment-source ${sourceClass}">${sourceLabel}</span></div>
          <div class="sentiment-refresh">Updated ${elapsedMin}m ago · Next: <span id="sentiment-refresh-countdown">${remH}h ${remM}m</span></div>
        </div>
        ${statsLine}

        <div class="sentiment-gauges">
          <div class="sentiment-gauge-row">
            <span class="sentiment-gauge-label positive">POSITIVE</span>
            <div class="sentiment-gauge-track">
              <div class="sentiment-gauge-fill positive" style="width:0%" data-target="${d.positive}"></div>
            </div>
            <span class="sentiment-gauge-pct positive">${d.positive}%</span>
          </div>
          <div class="sentiment-gauge-row">
            <span class="sentiment-gauge-label negative">NEGATIVE</span>
            <div class="sentiment-gauge-track">
              <div class="sentiment-gauge-fill negative" style="width:0%" data-target="${d.negative}"></div>
            </div>
            <span class="sentiment-gauge-pct negative">${d.negative}%</span>
          </div>
          <div class="sentiment-gauge-row">
            <span class="sentiment-gauge-label neutral">NEUTRAL</span>
            <div class="sentiment-gauge-track">
              <div class="sentiment-gauge-fill neutral" style="width:0%" data-target="${d.neutral}"></div>
            </div>
            <span class="sentiment-gauge-pct neutral">${d.neutral}%</span>
          </div>
        </div>

        <div class="sentiment-wordcloud-section">
          <div class="sub-section-title">Dominant Themes — Word Cloud</div>
          <div class="sentiment-wordcloud" id="sentiment-wordcloud"></div>
        </div>
      </div>
    `;

    // Animate gauge fills
    requestAnimationFrame(() => {
      document.querySelectorAll('.sentiment-gauge-fill').forEach(el => {
        const target = el.dataset.target;
        setTimeout(() => { el.style.width = target + '%'; }, 50);
      });
    });

    // Render word cloud
    this.renderWordCloud(d.wordCloud);

    // Bind mode toggle
    content.querySelectorAll('.sentiment-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.sentimentMode = btn.dataset.mode;
        this.sentimentData = generateSentimentData(this.sentimentMode);
        this.renderSentimentPanel();
      });
    });
  }

  renderWordCloud(words) {
    const container = document.getElementById('sentiment-wordcloud');
    if (!container || !words.length) return;

    const maxCount = Math.max(...words.map(w => w.count));
    const minCount = Math.min(...words.map(w => w.count));
    const range = maxCount - minCount || 1;

    // Shuffle for visual variety
    const shuffled = [...words].sort(() => Math.random() - 0.5);

    container.innerHTML = shuffled.map((w, i) => {
      const size = 9 + ((w.count - minCount) / range) * 22;
      const opacity = 0.5 + ((w.count - minCount) / range) * 0.5;
      let colorClass = 'wc-neutral';
      if (w.sentiment === 'positive') colorClass = 'wc-positive';
      if (w.sentiment === 'negative') colorClass = 'wc-negative';

      return `<span class="wc-word ${colorClass}" style="font-size:${size.toFixed(1)}px;opacity:${opacity.toFixed(2)};animation-delay:${(i * 20)}ms">${w.word}</span>`;
    }).join('');
  }
  renderTelegramIntel() {
    const content = document.getElementById('left-bottom-content');
    
    if (!this.telegramData) {
      content.innerHTML = `<div style="padding:20px; text-align:center; color:#64748b;">Loading Telegram OSINT...</div>`;
      return;
    }

    const { topPosts, urgentPosts } = this.telegramData;
    let html = `<div style="overflow-y:auto; height: 100%; padding: 10px;">`;
    
    if (urgentPosts && urgentPosts.length > 0) {
      html += `<div style="margin-bottom:15px; border-bottom: 1px solid rgba(239, 68, 68, 0.3); padding-bottom:10px;">
        <div style="color:var(--status-alert); font-weight:bold; margin-bottom:10px; font-size:12px;">🚨 URGENT ALERTS</div>`;
      urgentPosts.slice(0, 3).forEach(post => {
        html += `
          <div style="background:rgba(239, 68, 68, 0.1); padding:10px; margin-bottom:8px; border-radius:4px; border-left:3px solid var(--status-alert);">
            <div style="font-size:11px; color:var(--text-secondary); margin-bottom:4px;">@${post.channelLabel} • ${(post.views/1000).toFixed(1)}k views</div>
            <div style="font-size:12px; line-height:1.4;">${post.text.substring(0, 150)}...</div>
          </div>
        `;
      });
      html += `</div>`;
    }

    html += `<div style="color:var(--text-secondary); font-weight:bold; margin-bottom:10px; font-size:12px;">TOP INTEL</div>`;
    topPosts.slice(0, 10).forEach(post => {
      html += `
        <div style="background:rgba(255,255,255,0.02); padding:10px; margin-bottom:8px; border-radius:4px; border-left:3px solid #64748b;">
          <div style="font-size:11px; color:var(--text-secondary); margin-bottom:4px;">@${post.channelLabel} • ${(post.views/1000).toFixed(1)}k views</div>
          <div style="font-size:12px; line-height:1.4;">${post.text.substring(0, 120)}...</div>
        </div>
      `;
    });

    html += `</div>`;
    content.innerHTML = html;
  }

  addFirmsHotspots() {
    if (!this.globalMetrics || !this.globalMetrics.firms) return;
    
    if (!this.layerGroups['conflict-zones']) {
      this.layerGroups['conflict-zones'] = L.layerGroup().addTo(this.map);
    }
    const group = this.layerGroups['conflict-zones'];
    
    const firms = this.globalMetrics.firms.highIntensityAnomalies || [];
    firms.forEach(fire => {
      const circle = L.circleMarker([fire.lat, fire.lon], {
        radius: 6 + (fire.frp / 50),
        fillColor: '#ef4444',
        color: '#b91c1c',
        weight: 1,
        opacity: 0.8,
        fillOpacity: 0.6,
        className: 'pulse-slow'
      });
      
      circle.bindPopup(`
        <div style="font-family:'JetBrains Mono',monospace;">
          <strong style="color:#ef4444;">THERMAL ANOMALY (FIRMS)</strong><br>
          <strong>FRP:</strong> ${fire.frp} MW<br>
          <strong>Date:</strong> ${fire.date} ${fire.time}<br>
          <strong>Confidence:</strong> ${fire.confidence}
        </div>
      `, { className: 'custom-marker-popup' });
      
      circle.addTo(group);
    });
  }

}


// ── Initialize ──────────────────────────────────────────────────────────────
const dashboard = new WarDashboard();
document.addEventListener('DOMContentLoaded', () => dashboard.init());
