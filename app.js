// ============================================================================
// US-IRAN WAR INTELLIGENCE DASHBOARD — APPLICATION ENGINE
// ============================================================================

class WarDashboard {
  constructor() {
    this.map = null;
    this.newsItems = [];
    this.activeFilter = 'all';
    this.layerGroups = {};
    this.activeLayers = new Set(['us-bases', 'iran-bases', 'iran-missiles', 'iran-nuclear', 'us-navy', 'iran-navy', 'proxy-forces', 'air-defense', 'conflict-zones', 'air-traffic', 'maritime']);
    this.feedErrors = 0;
    this.feedSuccesses = 0;
    this.airTrafficMarkers = [];
    this.maritimeMarkers = [];
    this.maritimeVessels = [];
    this.airTrafficCount = 0;
    this.maritimeCount = 0;
  }

  init() {
    this.renderLayout();
    this.startClock();
    this.initMap();
    // Render default active tab for each panel
    this.renderMilitaryComparison(); // right-top: Assets tab (default)
    this.renderProxyForces();        // left-bottom: Proxies tab (default)
    this.renderTimeline();           // right-bottom: Timeline tab (default)
    this.loadNewsFeeds();
    // Initialize live tracking layers
    this.initMaritimeSimulation();
    this.loadAirTraffic();
    // Refresh intervals
    setInterval(() => this.loadNewsFeeds(), 300000);    // News: 5 min
    setInterval(() => this.loadAirTraffic(), 15000);    // Air: 15 sec
    setInterval(() => this.updateMaritimePositions(), 3000); // Ships: 3 sec
  }

  // ── Layout ──────────────────────────────────────────────────────────────
  renderLayout() {
    document.getElementById('app').innerHTML = `
      <div class="top-bar">
        <div class="logo">
          <div class="logo-icon">⚔</div>
          <div class="logo-text">
            <span class="logo-title">N8RA - WarTracker</span>
            <span class="logo-subtitle">US-IRAN Intelligence Dashboard</span>
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
      <div class="dashboard">
        <!-- Left Column -->
        <div class="panel" id="panel-news">
          <div class="panel-header">
            <span class="panel-icon">📡</span>
            <span class="panel-title">Strat Int Feed</span>
            <span class="panel-badge live">LIVE</span>
          </div>
          <div class="news-filter-bar" style="padding: 4px 10px;">
            <button class="news-filter active" data-filter="all">All</button>
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
            <span class="panel-title">Strat Picture (Aggregated)</span>
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
            <span class="panel-title" id="right-top-title">Force Comparison</span>
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
          </div>
          <div class="panel-content" id="left-bottom-content"></div>
        </div>

        <!-- Right Column Bottom -->
        <div class="panel" id="panel-right-bottom">
          <div class="panel-header">
            <span class="panel-icon">📊</span>
            <span class="panel-title" id="right-bottom-title">Timeline</span>
          </div>
          <div class="tab-bar" id="right-bottom-tabs">
            <button class="tab-btn active" data-tab="timeline">Timeline</button>
            <button class="tab-btn" data-tab="cyber">Cyber Ops</button>
            <button class="tab-btn" data-tab="naval">Naval</button>
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
        title.textContent = 'Force Comparison';
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
    }
  }

  // ── News Filters ────────────────────────────────────────────────────────
  bindNewsFilters() {
    document.querySelector('.news-filter-bar')?.addEventListener('click', (e) => {
      if (e.target.classList.contains('news-filter')) {
        document.querySelectorAll('.news-filter').forEach(f => f.classList.remove('active'));
        e.target.classList.add('active');
        this.activeFilter = e.target.dataset.filter;
        this.renderNews();
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
      this.renderNews();
    }

    const allFeeds = Object.values(NEWS_FEEDS).flat();
    const feedCount = document.getElementById('feed-count');
    if (feedCount) feedCount.textContent = allFeeds.length;

    // Load feeds concurrently in batches
    const batchSize = 4;
    for (let i = 0; i < allFeeds.length; i += batchSize) {
      const batch = allFeeds.slice(i, i + batchSize);
      await Promise.allSettled(batch.map(feed => this.fetchFeed(feed)));
      this.renderNews();
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
        fillOpacity: 0.1,
        weight: 1,
        dashArray: '5, 5',
      }).bindTooltip(zone.name, { className: 'custom-marker-popup' }).addTo(group);
    });
    group.addTo(this.map);
    this.layerGroups['conflict-zones'] = group;
  }

  addUSBases() {
    const group = L.layerGroup();
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
    group.addTo(this.map);
    this.layerGroups['us-bases'] = group;
  }

  addUSNavy() {
    const group = L.layerGroup();
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
    group.addTo(this.map);
    this.layerGroups['us-navy'] = group;
  }

  addIranBases() {
    const group = L.layerGroup();
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
    group.addTo(this.map);
    this.layerGroups['iran-bases'] = group;
  }

  addIranMissiles() {
    const group = L.layerGroup();
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

      // Add range ring for longest-range missile (Sejjil-2, 2500km)
      L.circle(site.pos, {
        radius: 2500000,
        color: 'rgba(239, 68, 68, 0.2)',
        fillColor: 'rgba(239, 68, 68, 0.03)',
        weight: 1,
        dashArray: '4, 4',
      }).addTo(group);
    });
    group.addTo(this.map);
    this.layerGroups['iran-missiles'] = group;
  }

  addIranNuclear() {
    const group = L.layerGroup();
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
    group.addTo(this.map);
    this.layerGroups['iran-nuclear'] = group;
  }

  addIranNavy() {
    const group = L.layerGroup();
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
    group.addTo(this.map);
    this.layerGroups['iran-navy'] = group;
  }

  addProxyMarkers() {
    const group = L.layerGroup();
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
    group.addTo(this.map);
    this.layerGroups['proxy-forces'] = group;
  }

  addAirDefenseOverlay() {
    const group = L.layerGroup();
    IRAN_MILITARY.airDefense.sites.forEach(site => {
      L.marker(site.pos, { icon: this.createIcon('🛡️', 14) })
        .bindPopup(`
          <div class="map-popup-title">🛡️ ${site.name}</div>
          <div class="map-popup-detail">
            <strong>Systems:</strong> ${site.systems.join(', ')}
          </div>
        `, { className: 'custom-marker-popup' })
        .addTo(group);

      // 200km range ring for S-300
      L.circle(site.pos, {
        radius: 200000,
        color: 'rgba(139, 92, 246, 0.25)',
        fillColor: 'rgba(139, 92, 246, 0.05)',
        weight: 1,
        dashArray: '3, 3',
      }).addTo(group);
    });
    group.addTo(this.map);
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
      { key: 'maritime', label: 'Ships', color: '#10b981', icon: '🚢', dynamic: true },
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
  }

  // ── Military Comparison ─────────────────────────────────────────────────
  renderMilitaryComparison() {
    const content = document.getElementById('right-top-content');
    content.innerHTML = `
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
    content.innerHTML = `
      <div class="threat-gauge-container">
        <div class="threat-gauge">
          <div class="threat-gauge-fill high"></div>
        </div>
        <div class="threat-level-label high">HIGH — ELEVATED</div>
      </div>
      <div class="threat-factors">
        <div class="sub-section-title">Threat Factors</div>
        ${this.threatFactor('Nuclear Breakout Risk', 9, '#ef4444')}
        ${this.threatFactor('Proxy Conflict Intensity', 8, '#f97316')}
        ${this.threatFactor('Naval Confrontation', 7, '#f59e0b')}
        ${this.threatFactor('Cyber Operations Tempo', 6, '#f59e0b')}
        ${this.threatFactor('Diplomatic Channels', 3, '#22c55e')}
        ${this.threatFactor('Economic Pressure', 8, '#f97316')}
        ${this.threatFactor('Regional Instability', 8, '#ef4444')}
        ${this.threatFactor('Direct Military Exchange', 7, '#f59e0b')}
        <div style="margin-top:10px; font-size:9px; color: var(--text-muted); font-family: var(--font-mono);">
          Composite Score: <span style="color: var(--accent-red); font-weight:700;">7.0 / 10</span>
          <br>Assessment: Sustained high tension with active proxy warfare
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
    content.innerHTML = `
      <div class="sub-section">
        <div class="sub-section-title">Enrichment Status</div>
        <div class="enrichment-bar">
          <div class="enrichment-fill" style="width: 66%; background: linear-gradient(90deg, #22c55e 0%, #f59e0b 40%, #f97316 60%, #ef4444 100%);">
            60%
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
          <span class="nuclear-value danger">${enrichment.current}</span>
        </div>
        <div class="nuclear-stat">
          <span class="nuclear-label">Weapon-Grade Threshold</span>
          <span class="nuclear-value warning">${enrichment.weaponGrade}</span>
        </div>
        <div class="nuclear-stat">
          <span class="nuclear-label">Estimated Breakout Time</span>
          <span class="nuclear-value danger">${enrichment.breakoutTime}</span>
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
    content.innerHTML = PROXY_FORCES.map(proxy => `
      <div class="proxy-card" onclick="dashboard.map.flyTo([${proxy.pos}], 7)">
        <div class="proxy-header">
          <span class="proxy-name" style="color: ${proxy.color}">${proxy.name}</span>
          <span class="proxy-status ${proxy.status.includes('Degraded') ? 'degraded' : 'active'}">${proxy.status.includes('Active') ? 'ACTIVE' : 'DEGRADED'}</span>
        </div>
        <div class="proxy-detail">
          <span>📍 ${proxy.country}</span> · <span>👥 ${proxy.personnel}</span><br>
          <span>🎯 ${proxy.capabilities.slice(0, 3).join(', ')}</span><br>
          <span>💰 ${proxy.funding}</span>
          ${proxy.subGroups ? `<br><span style="color: var(--text-muted)">Sub-groups: ${proxy.subGroups.join(', ')}</span>` : ''}
        </div>
      </div>
    `).join('');
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
          <span class="economic-stat-label">Rial (Official / Market)</span>
          <span class="economic-stat-value" style="color: var(--accent-red)">${s.economicImpact.rialRate.official.toLocaleString()} / ${s.economicImpact.rialRate.market.toLocaleString()}</span>
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
      this.layerGroups['air-traffic'] = L.layerGroup().addTo(this.map);
    }

    // Bounding boxes for both straits + wider theater + India corridor
    const regions = [
      // Strait of Hormuz + Persian Gulf
      { name: 'hormuz', lamin: 24.0, lomin: 50.0, lamax: 28.0, lomax: 58.0 },
      // Bab al-Mandab + Red Sea
      { name: 'mandab', lamin: 11.0, lomin: 41.0, lamax: 16.0, lomax: 46.0 },
      // Gulf of Oman / Arabian Sea approach
      { name: 'oman', lamin: 22.0, lomin: 57.0, lamax: 26.5, lomax: 62.0 },
      // Arabian Sea mid-corridor (Oman → India)
      { name: 'arabian-sea', lamin: 16.0, lomin: 60.0, lamax: 22.0, lomax: 68.0 },
      // Indian West Coast approaches (Gujarat → Kerala)
      { name: 'india-coast', lamin: 8.0, lomin: 68.0, lamax: 24.0, lomax: 77.0 },
      // Arabian Sea south (Lakshadweep / Maldives corridor)
      { name: 'india-south', lamin: 8.0, lomin: 60.0, lamax: 16.0, lomax: 68.0 },
    ];

    const PROXY = 'https://api.allorigins.win/raw?url=';
    let allAircraft = [];

    for (const region of regions) {
      try {
        const url = `https://opensky-network.org/api/states/all?lamin=${region.lamin}&lomin=${region.lomin}&lamax=${region.lamax}&lomax=${region.lomax}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        // Try direct first (may fail due to CORS)
        let res;
        try {
          res = await fetch(url, { signal: controller.signal });
        } catch(e) {
          // Fallback to CORS proxy
          res = await fetch(PROXY + encodeURIComponent(url), { signal: controller.signal });
        }
        clearTimeout(timeout);

        if (res.ok) {
          const data = await res.json();
          if (data.states) {
            allAircraft.push(...data.states.map(s => ({
              icao: s[0],
              callsign: (s[1] || '').trim(),
              country: s[2],
              lon: s[5],
              lat: s[6],
              altitude: s[7] || s[13] || 0,
              onGround: s[8],
              velocity: s[9],
              heading: s[10] || 0,
              vertRate: s[11],
              category: s[17] || 0,
              region: region.name,
            })));
          }
        }
      } catch (e) {
        // Silent fail — will use fallback
      }
    }

    // If API fails, use simulated air traffic
    if (allAircraft.length === 0) {
      allAircraft = this.generateSimulatedAirTraffic();
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
      const glowColor = isIndian ? 'rgba(255,153,51,0.8)' : 'rgba(6,182,212,0.6)';
      const planeColor = isIndian ? '#ff9933' : '#06b6d4';
      const planeSize = isIndian ? 16 : 14;

      const icon = L.divIcon({
        html: `<div style="transform: rotate(${heading}deg); font-size:${planeSize}px; color:${planeColor}; filter: drop-shadow(0 0 4px ${glowColor}); text-align:center; line-height:1;">${isIndian ? '✈' : '✈'}</div>`,
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

    // Update count in legend
    const countEl = document.getElementById('count-air-traffic');
    if (countEl) countEl.textContent = this.airTrafficCount;
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
  // CIVILIAN MARITIME TRAFFIC — Simulated AIS Data
  // ═══════════════════════════════════════════════════════════════════════

  initMaritimeSimulation() {
    if (!this.layerGroups['maritime']) {
      this.layerGroups['maritime'] = L.layerGroup().addTo(this.map);
    }

    // Shipping lane waypoints
    const hormuzLane = [
      [26.90, 56.10], [26.55, 56.30], [26.40, 56.50], [26.15, 56.80],
      [25.80, 57.20], [25.40, 57.70], [25.20, 58.30], [25.00, 59.00],
      [24.70, 59.80], [24.30, 60.50], [23.80, 61.50],
    ];
    const hormuzLaneReverse = [...hormuzLane].reverse().map(p => [p[0] + 0.05, p[1] - 0.05]);

    const mandabLane = [
      [12.40, 43.30], [12.55, 43.40], [12.70, 43.55], [12.90, 43.50],
      [13.10, 43.30], [13.40, 43.10], [13.70, 42.80], [14.20, 42.50],
      [14.80, 42.10], [15.50, 41.60], [16.20, 41.10],
    ];
    const mandabLaneReverse = [...mandabLane].reverse().map(p => [p[0] - 0.03, p[1] + 0.04]);

    // Persian Gulf internal shipping
    const gulfLane = [
      [29.30, 48.50], [28.80, 49.30], [28.20, 50.00], [27.50, 50.80],
      [27.00, 51.50], [26.50, 52.50], [26.10, 53.50], [25.80, 54.50],
      [25.60, 55.50], [25.50, 56.00], [26.00, 56.30],
    ];

    // ── Indian Ocean / Arabian Sea shipping lanes ─────────────────────────
    // Hormuz → Mumbai/JNPT (primary crude oil import route for India)
    const hormuzToMumbai = [
      [23.80, 61.50], [23.00, 62.50], [22.00, 64.00], [21.00, 66.00],
      [20.50, 68.00], [20.00, 70.00], [19.50, 71.50], [19.10, 72.80],
    ];
    // Mumbai/JNPT → Hormuz (return / ballast)
    const mumbaiToHormuz = [...hormuzToMumbai].reverse().map(p => [p[0] - 0.08, p[1] + 0.05]);

    // Hormuz → Mundra/Kandla (Gujarat crude terminals)
    const hormuzToKandla = [
      [23.80, 61.50], [23.50, 63.00], [23.20, 64.50], [23.00, 66.00],
      [22.80, 67.50], [22.70, 69.00], [22.80, 69.80], [23.00, 70.10],
    ];
    const kandlaToHormuz = [...hormuzToKandla].reverse().map(p => [p[0] + 0.06, p[1] - 0.04]);

    // Arabian Sea → Cochin (Kerala, LNG & container)
    const hormuzToCochin = [
      [23.80, 61.50], [22.00, 63.00], [20.00, 65.00], [18.00, 67.00],
      [16.00, 69.50], [14.00, 72.00], [12.00, 74.00], [10.00, 76.20],
    ];
    const cochinToHormuz = [...hormuzToCochin].reverse().map(p => [p[0] + 0.06, p[1] - 0.06]);

    // Arabian Sea → Mangalore (Karnataka, crude & LPG)
    const hormuzToMangalore = [
      [23.80, 61.50], [22.50, 63.50], [21.00, 65.50], [19.00, 68.00],
      [17.00, 70.50], [15.00, 73.00], [13.00, 74.80],
    ];

    // Bab al-Mandab → India west coast (Suez Canal route)
    const mandabToIndia = [
      [12.40, 43.30], [12.00, 46.00], [12.50, 49.00], [13.50, 52.00],
      [15.00, 56.00], [16.50, 60.00], [17.50, 64.00], [18.50, 68.00],
      [19.00, 71.00], [19.10, 72.80],
    ];
    const indiaToMandab = [...mandabToIndia].reverse().map(p => [p[0] - 0.06, p[1] + 0.05]);

    const vesselTypes = [
      { type: 'VLCC Tanker', icon: '🛢️', size: 16, category: 'tanker', color: '#f59e0b' },
      { type: 'Suezmax Tanker', icon: '🛢️', size: 14, category: 'tanker', color: '#f59e0b' },
      { type: 'Aframax Tanker', icon: '🛢️', size: 14, category: 'tanker', color: '#f59e0b' },
      { type: 'LNG Carrier', icon: '⛽', size: 15, category: 'lng', color: '#06b6d4' },
      { type: 'Container Ship', icon: '📦', size: 14, category: 'container', color: '#10b981' },
      { type: 'Bulk Carrier', icon: '🚢', size: 14, category: 'bulk', color: '#8b5cf6' },
      { type: 'General Cargo', icon: '🚢', size: 12, category: 'cargo', color: '#64748b' },
      { type: 'Vehicle Carrier', icon: '🚗', size: 13, category: 'roro', color: '#ec4899' },
      { type: 'Chemical Tanker', icon: '⚗️', size: 13, category: 'chemical', color: '#eab308' },
    ];

    const flagStates = [
      { flag: '🇱🇷', country: 'Liberia' },
      { flag: '🇵🇦', country: 'Panama' },
      { flag: '🇲🇭', country: 'Marshall Islands' },
      { flag: '🇭🇰', country: 'Hong Kong' },
      { flag: '🇸🇬', country: 'Singapore' },
      { flag: '🇧🇸', country: 'Bahamas' },
      { flag: '🇲🇹', country: 'Malta' },
      { flag: '🇬🇷', country: 'Greece' },
      { flag: '🇳🇴', country: 'Norway' },
      { flag: '🇨🇳', country: 'China' },
      { flag: '🇯🇵', country: 'Japan' },
      { flag: '🇰🇷', country: 'South Korea' },
      { flag: '🇮🇳', country: 'India' },
      { flag: '🇸🇦', country: 'Saudi Arabia' },
      { flag: '🇦🇪', country: 'UAE' },
      { flag: '🇮🇷', country: 'Iran' },
      { flag: '🇬🇧', country: 'United Kingdom' },
      { flag: '🇩🇪', country: 'Germany' },
      { flag: '🇹🇷', country: 'Turkey' },
      { flag: '🇮🇹', country: 'Italy' },
    ];

    // Indian-specific flag for dedicated India lanes
    const indianFlag = { flag: '🇮🇳', country: 'India' };

    const vesselNames = [
      'Pacific Explorer', 'Arabian Star', 'Gulf Harmony', 'Eastern Promise', 'Ocean Grace',
      'Hormuz Spirit', 'Desert Pearl', 'Coral Enterprise', 'Sapphire Express', 'Golden Phoenix',
      'Maritime Pioneer', 'Star of Dubai', 'Orient Venture', 'Neptune Glory', 'Emerald Seas',
      'Brave Voyager', 'Silver Dawn', 'Royal Fortune', 'Crimson Tide', 'Blue Horizon',
      'Fortune Bridge', 'Asia Progress', 'Suez Challenger', 'Olympic Spirit', 'Aegean Dignity',
      'Fujairah Bay', 'Ras Tanura', 'Jebel Ali Star', 'Basra Pioneer', 'Muscat Trader',
      'Bengal Tiger', 'Karachi Express', 'Mumbai Star', 'Colombo Pearl', 'Chennai Spirit',
      'Aden Voyager', 'Djibouti Gate', 'Eritrea Sun', 'Yanbu Promise', 'Jeddah Merchant',
      // Indian vessel names
      'SCI Yamuna', 'SCI Delhi', 'Desh Apna', 'Maharaja Agrasen', 'Swarna Krishna',
      'Desh Rakshak', 'Vishva Kaumudi', 'Ratna Shruti', 'Desh Vibhor', 'Jag Lalit',
      'SCI Nalanda', 'Great Eastern Sun', 'Essar Mumbai', 'Adani Mundra', 'Kandla Spirit',
      'INS Supply', 'Reliance Gujarat', 'Mangalore Express', 'Cochin Gateway', 'Malabar Coast',
    ];

    // Create vessels along all lanes
    const allLanes = [
      { lane: hormuzLane, name: 'Hormuz Inbound', count: 18 },
      { lane: hormuzLaneReverse, name: 'Hormuz Outbound', count: 16 },
      { lane: mandabLane, name: 'Bab al-Mandab North', count: 12 },
      { lane: mandabLaneReverse, name: 'Bab al-Mandab South', count: 10 },
      { lane: gulfLane, name: 'Persian Gulf', count: 14 },
      // Indian Ocean routes — India-bound
      { lane: hormuzToMumbai, name: 'Hormuz → Mumbai/JNPT', count: 12, indianRoute: true },
      { lane: mumbaiToHormuz, name: 'Mumbai → Hormuz (Ballast)', count: 8, indianRoute: true },
      { lane: hormuzToKandla, name: 'Hormuz → Mundra/Kandla', count: 10, indianRoute: true },
      { lane: kandlaToHormuz, name: 'Kandla → Hormuz', count: 6, indianRoute: true },
      { lane: hormuzToCochin, name: 'Arabian Sea → Cochin', count: 8, indianRoute: true },
      { lane: cochinToHormuz, name: 'Cochin → Arabian Sea', count: 5, indianRoute: true },
      { lane: hormuzToMangalore, name: 'Hormuz → Mangalore', count: 6, indianRoute: true },
      { lane: mandabToIndia, name: 'Red Sea → India W.Coast', count: 8, indianRoute: true },
      { lane: indiaToMandab, name: 'India → Red Sea/Suez', count: 6, indianRoute: true },
    ];

    let nameIdx = 0;
    allLanes.forEach(({ lane, name: laneName, count, indianRoute }) => {
      for (let i = 0; i < count; i++) {
        const progress = Math.random(); // 0-1 along the lane
        const vType = vesselTypes[Math.floor(Math.random() * vesselTypes.length)];
        // Indian routes: 50% chance Indian flag, rest random
        let flagState;
        if (indianRoute && Math.random() < 0.5) {
          flagState = indianFlag;
        } else {
          flagState = flagStates[Math.floor(Math.random() * flagStates.length)];
        }
        const vesselName = vesselNames[nameIdx % vesselNames.length];
        nameIdx++;

        const pos = this.interpolateLane(lane, progress);
        const speed = 8 + Math.random() * 8; // 8-16 knots
        const imo = 9000000 + Math.floor(Math.random() * 999999);
        // Indian MMSI range: 419xxxxxx
        const mmsi = flagState.country === 'India'
          ? 419000000 + Math.floor(Math.random() * 999999)
          : 200000000 + Math.floor(Math.random() * 799999999);

        const isIndianVessel = flagState.country === 'India';

        this.maritimeVessels.push({
          name: vesselName,
          type: vType.type,
          icon: vType.icon,
          size: isIndianVessel ? vType.size + 2 : vType.size,
          category: vType.category,
          color: isIndianVessel ? '#ff9933' : vType.color,
          flag: flagState.flag,
          country: flagState.country,
          lane,
          laneName,
          progress,
          speed, // knots
          speedIncrement: (0.0001 + Math.random() * 0.0003) * (laneName.includes('Outbound') || laneName.includes('South') || laneName.includes('→ Hormuz') || laneName.includes('→ Red') || laneName.includes('→ Arabian') || laneName.includes('Ballast') ? -1 : 1),
          imo: `IMO ${imo}`,
          mmsi: mmsi.toString(),
          pos,
          heading: 0,
          isIndian: isIndianVessel,
          indianRoute: !!indianRoute,
        });
      }
    });

    this.maritimeCount = this.maritimeVessels.length;
    this.renderMaritimeLayer();
  }

  interpolateLane(lane, progress) {
    const totalSegments = lane.length - 1;
    const segFloat = progress * totalSegments;
    const segIdx = Math.min(Math.floor(segFloat), totalSegments - 1);
    const t = segFloat - segIdx;

    const p1 = lane[segIdx];
    const p2 = lane[segIdx + 1];
    return [
      p1[0] + (p2[0] - p1[0]) * t + (Math.random() - 0.5) * 0.02,
      p1[1] + (p2[1] - p1[1]) * t + (Math.random() - 0.5) * 0.02,
    ];
  }

  getHeading(p1, p2) {
    const dLon = (p2[1] - p1[1]) * Math.PI / 180;
    const lat1 = p1[0] * Math.PI / 180;
    const lat2 = p2[0] * Math.PI / 180;
    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
  }

  updateMaritimePositions() {
    this.maritimeVessels.forEach(v => {
      v.progress += v.speedIncrement;
      // Wrap around
      if (v.progress > 1) v.progress = 0;
      if (v.progress < 0) v.progress = 1;

      const oldPos = v.pos;
      v.pos = this.interpolateLane(v.lane, Math.abs(v.progress));
      v.heading = this.getHeading(oldPos, v.pos);
    });

    this.renderMaritimeLayer();
  }

  renderMaritimeLayer() {
    const group = this.layerGroups['maritime'];
    if (!group) return;
    group.clearLayers();

    const indianCount = { ships: 0, aircraft: 0 };

    this.maritimeVessels.forEach(v => {
      if (v.isIndian) indianCount.ships++;

      const glowIntensity = v.isIndian ? '0 0 6px' : '0 0 3px';
      const icon = L.divIcon({
        html: `<div style="font-size:${v.size}px; text-align:center; line-height:1; filter: drop-shadow(${glowIntensity} ${v.color});">${v.icon}</div>`,
        className: v.isIndian ? 'maritime-icon india-vessel' : 'maritime-icon',
        iconSize: [v.size + 4, v.size + 4],
        iconAnchor: [(v.size + 4) / 2, (v.size + 4) / 2],
      });

      const indianBadge = v.isIndian ? '<span style="background:rgba(255,153,51,0.2); border:1px solid #ff9933; padding:1px 5px; border-radius:3px; font-size:8px; color:#ff9933; font-weight:700;">🇮🇳 INDIAN VESSEL</span><br>' : '';
      const routeTag = v.indianRoute ? `<span style="color:#ff9933; font-size:8px;">🇮🇳 India Route</span><br>` : '';

      L.marker(v.pos, { icon })
        .bindPopup(`
          <div class="map-popup-title">${v.flag} ${v.name}</div>
          <div class="map-popup-detail">
            ${indianBadge}
            <strong>Type:</strong> ${v.type}<br>
            <strong>Flag:</strong> ${v.flag} ${v.country}<br>
            <strong>Speed:</strong> ${v.speed.toFixed(1)} kts<br>
            <strong>Heading:</strong> ${Math.round(v.heading)}°<br>
            <strong>Route:</strong> ${v.laneName}<br>
            ${routeTag}
            <strong>${v.imo}</strong> · MMSI ${v.mmsi}
          </div>
        `, { className: 'custom-marker-popup' })
        .addTo(group);
    });

    // Update counts in legend
    const countEl = document.getElementById('count-maritime');
    if (countEl) countEl.textContent = this.maritimeCount;
    const indiaCountEl = document.getElementById('count-india');
    if (indiaCountEl) indiaCountEl.textContent = indianCount.ships;
  }
}

// ── Initialize ──────────────────────────────────────────────────────────────
const dashboard = new WarDashboard();
document.addEventListener('DOMContentLoaded', () => dashboard.init());
