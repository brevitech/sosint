// ============================================================================
// US-IRAN WAR INTELLIGENCE DASHBOARD — DATA CONFIGURATION
// ============================================================================

const FEED_PROXY = 'https://api.allorigins.win/raw?url=';
const GOOGLE_NEWS_RSS = 'https://news.google.com/rss/search?';

// ── News Feed Sources ────────────────────────────────────────────────────────
const NEWS_FEEDS = {
  wire: [
    { name: 'Reuters ME', url: `${FEED_PROXY}${encodeURIComponent(`${GOOGLE_NEWS_RSS}q=site:reuters.com+(Iran+OR+"Middle+East"+OR+"Persian+Gulf")&hl=en-US&gl=US&ceid=US:en`)}`, tier: 'wire' },
    { name: 'AP Iran', url: `${FEED_PROXY}${encodeURIComponent(`${GOOGLE_NEWS_RSS}q=site:apnews.com+Iran&hl=en-US&gl=US&ceid=US:en`)}`, tier: 'wire' },
  ],
  defense: [
    { name: 'Defense One', url: `${FEED_PROXY}${encodeURIComponent(`${GOOGLE_NEWS_RSS}q=site:defenseone.com+(Iran+OR+CENTCOM+OR+"Middle+East")+when:3d&hl=en-US&gl=US&ceid=US:en`)}`, tier: 'intel' },
    { name: 'Breaking Defense', url: `${FEED_PROXY}${encodeURIComponent(`${GOOGLE_NEWS_RSS}q=site:breakingdefense.com+(Iran+OR+"Persian+Gulf")+when:3d&hl=en-US&gl=US&ceid=US:en`)}`, tier: 'intel' },
    { name: 'The War Zone', url: `${FEED_PROXY}${encodeURIComponent(`${GOOGLE_NEWS_RSS}q=site:thedrive.com/the-war-zone+(Iran+OR+"Strait+of+Hormuz")+when:7d&hl=en-US&gl=US&ceid=US:en`)}`, tier: 'intel' },
    { name: 'Military Times', url: `${FEED_PROXY}${encodeURIComponent(`${GOOGLE_NEWS_RSS}q=site:militarytimes.com+Iran+when:7d&hl=en-US&gl=US&ceid=US:en`)}`, tier: 'intel' },
    { name: 'USNI News', url: `${FEED_PROXY}${encodeURIComponent(`${GOOGLE_NEWS_RSS}q=site:news.usni.org+(Iran+OR+"Persian+Gulf"+OR+CENTCOM)+when:7d&hl=en-US&gl=US&ceid=US:en`)}`, tier: 'intel' },
  ],
  middleeast: [
    { name: 'BBC Middle East', url: `${FEED_PROXY}${encodeURIComponent('https://feeds.bbci.co.uk/news/world/middle_east/rss.xml')}`, tier: 'mainstream' },
    { name: 'Al Jazeera', url: `${FEED_PROXY}${encodeURIComponent('https://www.aljazeera.com/xml/rss/all.xml')}`, tier: 'mainstream' },
    { name: 'Iran International', url: `${FEED_PROXY}${encodeURIComponent(`${GOOGLE_NEWS_RSS}q=site:iranintl.com+when:2d&hl=en-US&gl=US&ceid=US:en`)}`, tier: 'intel' },
    { name: 'Fars News', url: `${FEED_PROXY}${encodeURIComponent(`${GOOGLE_NEWS_RSS}q=site:farsnews.ir+when:2d&hl=en-US&gl=US&ceid=US:en`)}`, tier: 'state' },
  ],
  gov: [
    { name: 'Pentagon', url: `${FEED_PROXY}${encodeURIComponent(`${GOOGLE_NEWS_RSS}q=(Pentagon+OR+CENTCOM+OR+"US+military")+(Iran+OR+"Middle+East")+when:3d&hl=en-US&gl=US&ceid=US:en`)}`, tier: 'gov' },
    { name: 'State Dept', url: `${FEED_PROXY}${encodeURIComponent(`${GOOGLE_NEWS_RSS}q="State+Department"+(Iran+OR+sanctions+OR+"nuclear+deal")+when:3d&hl=en-US&gl=US&ceid=US:en`)}`, tier: 'gov' },
    { name: 'IAEA', url: `${FEED_PROXY}${encodeURIComponent(`${GOOGLE_NEWS_RSS}q=IAEA+(Iran+OR+uranium+OR+enrichment+OR+nuclear)+when:7d&hl=en-US&gl=US&ceid=US:en`)}`, tier: 'gov' },
    { name: 'White House', url: `${FEED_PROXY}${encodeURIComponent(`${GOOGLE_NEWS_RSS}q="White+House"+(Iran+OR+"Persian+Gulf"+OR+sanctions)+when:7d&hl=en-US&gl=US&ceid=US:en`)}`, tier: 'gov' },
  ],
  thinktanks: [
    { name: 'CSIS', url: `${FEED_PROXY}${encodeURIComponent(`${GOOGLE_NEWS_RSS}q=site:csis.org+Iran+when:14d&hl=en-US&gl=US&ceid=US:en`)}`, tier: 'intel' },
    { name: 'Atlantic Council', url: `${FEED_PROXY}${encodeURIComponent(`${GOOGLE_NEWS_RSS}q=site:atlanticcouncil.org+Iran+when:14d&hl=en-US&gl=US&ceid=US:en`)}`, tier: 'intel' },
    { name: 'War on the Rocks', url: `${FEED_PROXY}${encodeURIComponent(`${GOOGLE_NEWS_RSS}q=site:warontherocks.com+(Iran+OR+"Persian+Gulf")+when:14d&hl=en-US&gl=US&ceid=US:en`)}`, tier: 'intel' },
    { name: 'Foreign Policy', url: `${FEED_PROXY}${encodeURIComponent(`${GOOGLE_NEWS_RSS}q=site:foreignpolicy.com+Iran+when:14d&hl=en-US&gl=US&ceid=US:en`)}`, tier: 'intel' },
  ],
  conflict: [
    { name: 'US-Iran Tensions', url: `${FEED_PROXY}${encodeURIComponent(`${GOOGLE_NEWS_RSS}q=("US+Iran"+OR+"Iran+attack"+OR+"Iran+missile"+OR+"Iran+drone"+OR+"IRGC")+when:2d&hl=en-US&gl=US&ceid=US:en`)}`, tier: 'alert' },
    { name: 'Strait of Hormuz', url: `${FEED_PROXY}${encodeURIComponent(`${GOOGLE_NEWS_RSS}q=("Strait+of+Hormuz"+OR+"oil+tanker"+OR+"Persian+Gulf"+shipping)+when:3d&hl=en-US&gl=US&ceid=US:en`)}`, tier: 'alert' },
    { name: 'Iran Nuclear', url: `${FEED_PROXY}${encodeURIComponent(`${GOOGLE_NEWS_RSS}q=(Iran+nuclear+OR+Iran+enrichment+OR+Iran+uranium+OR+JCPOA)+when:3d&hl=en-US&gl=US&ceid=US:en`)}`, tier: 'alert' },
    { name: 'Proxy Forces', url: `${FEED_PROXY}${encodeURIComponent(`${GOOGLE_NEWS_RSS}q=(Hezbollah+OR+Houthi+OR+"Iraqi+militia"+OR+"Iran+proxy")+when:3d&hl=en-US&gl=US&ceid=US:en`)}`, tier: 'alert' },
    { name: 'Iran Sanctions', url: `${FEED_PROXY}${encodeURIComponent(`${GOOGLE_NEWS_RSS}q=(Iran+sanctions+OR+"Iran+oil"+OR+"Iran+economy")+when:3d&hl=en-US&gl=US&ceid=US:en`)}`, tier: 'alert' },
    { name: 'Cyber Warfare', url: `${FEED_PROXY}${encodeURIComponent(`${GOOGLE_NEWS_RSS}q=(Iran+cyber+OR+"Iranian+hackers"+OR+Iran+cyberattack)+when:7d&hl=en-US&gl=US&ceid=US:en`)}`, tier: 'alert' },
  ]
};

// ── US Military Assets ───────────────────────────────────────────────────────
const US_MILITARY = {
  personnel: { active: 1328000, reserve: 800000, centcom: 45000 },
  navy: {
    carriers: [
      { name: 'USS Dwight D. Eisenhower (CVN-69)', type: 'Nimitz-class', aircraft: 75, pos: [25.5, 56.5], status: 'Deployed - 5th Fleet' },
      { name: 'USS Abraham Lincoln (CVN-72)', type: 'Nimitz-class', aircraft: 75, pos: [21.3, 60.0], status: 'Deployed - Arabian Sea' },
      { name: 'USS Gerald R. Ford (CVN-78)', type: 'Ford-class', aircraft: 75, pos: [36.0, 15.0], status: 'Mediterranean - Ready' },
    ],
    destroyers: [
      { name: 'USS Carney (DDG-64)', type: 'Arleigh Burke-class', pos: [15.5, 42.0], status: 'Red Sea Ops' },
      { name: 'USS Mason (DDG-87)', type: 'Arleigh Burke-class', pos: [13.2, 43.5], status: 'Red Sea Ops' },
      { name: 'USS Laboon (DDG-58)', type: 'Arleigh Burke-class', pos: [26.0, 55.0], status: 'Persian Gulf' },
      { name: 'USS Thomas Hudner (DDG-116)', type: 'Arleigh Burke-class', pos: [24.5, 58.5], status: 'Gulf of Oman' },
    ],
    submarines: [
      { name: 'USS Florida (SSGN-728)', type: 'Ohio-class SSGN', missiles: 154, pos: [25.0, 57.0], status: 'Persian Gulf' },
      { name: 'USS Georgia (SSGN-729)', type: 'Ohio-class SSGN', missiles: 154, pos: [22.0, 62.0], status: 'Arabian Sea' },
    ],
    amphibious: [
      { name: 'USS Bataan (LHD-5)', type: 'Wasp-class', marines: 2200, pos: [14.5, 42.5], status: 'Red Sea' },
    ],
    totalShips: 290,
    combatFleet: 53,
  },
  airForce: {
    fighters: { f22: 186, f35: 614, f15: 218, f16: 936 },
    bombers: { b2: 19, b1b: 45, b52: 76 },
    regionalBases: [
      { name: 'Al Udeid AB', country: 'Qatar', pos: [25.12, 51.31], aircraft: ['F-15E', 'F-22', 'KC-135', 'B-52', 'E-8 JSTARS', 'RQ-4'], role: 'CENTCOM CAOC' },
      { name: 'Al Dhafra AB', country: 'UAE', pos: [24.25, 54.55], aircraft: ['F-35A', 'F-22', 'RQ-4 Global Hawk', 'U-2'], role: 'ISR Hub' },
      { name: 'Ali Al Salem AB', country: 'Kuwait', pos: [29.35, 47.52], aircraft: ['AH-64', 'UH-60', 'F/A-18'], role: 'Army Aviation' },
      { name: 'Ahmad Al Jaber AB', country: 'Kuwait', pos: [28.94, 47.79], aircraft: ['A-10', 'F-16'], role: 'Close Air Support' },
      { name: 'Prince Sultan AB', country: 'Saudi Arabia', pos: [24.06, 47.58], aircraft: ['F-15C/E', 'Patriot'], role: 'Air Defense' },
      { name: 'Camp Lemonnier', country: 'Djibouti', pos: [11.55, 43.15], aircraft: ['MQ-9 Reaper', 'P-8A'], role: 'CT / ISR' },
      { name: 'Incirlik AB', country: 'Turkey', pos: [37.00, 35.43], aircraft: ['F-16', 'KC-135'], role: 'NATO Forward' },
      { name: 'Muwaffaq Salti AB', country: 'Jordan', pos: [32.35, 36.78], aircraft: ['F-16', 'MQ-9'], role: 'Syria/Iraq Ops' },
      { name: 'NSA Bahrain', country: 'Bahrain', pos: [26.27, 50.63], aircraft: ['P-8A Poseidon'], role: '5th Fleet HQ' },
    ],
    totalAircraft: 5217,
  },
  missiles: {
    tomahawk: { range: 2500, inventory: 4000 },
    jassm: { range: 370, variant: 'JASSM-ER: 926km' },
    sm3: { range: 700, role: 'BMD' },
    sm6: { range: 370, role: 'AAW/BMD' },
    patriot: { range: 160, units: 15 },
    thaad: { range: 200, units: 7, deployed: ['UAE', 'Israel', 'Guam'] },
  },
  specialOps: { total: 70000, centcomDeployed: 5000 },
};

// ── Iranian Military Assets ─────────────────────────────────────────────────
const IRAN_MILITARY = {
  personnel: { active: 610000, reserve: 350000, irgc: 190000, basij: 600000 },
  navy: {
    irin: {
      frigates: 6,
      corvettes: 3,
      submarines: [
        { name: 'Fateh-class', count: 1, type: 'Submarine', displacement: 593 },
        { name: 'Ghadir-class', count: 23, type: 'Midget Submarine', displacement: 120 },
        { name: 'Kilo-class (Tareq)', count: 3, type: 'Submarine', displacement: 3076 },
      ],
      fastAttack: 230,
      mines: 5000,
    },
    irgcn: {
      fastAttack: 1500,
      missiles: ['C-802 Noor', 'Ghader', 'Khalij Fars ASBM'],
      bases: [
        { name: 'Bandar Abbas', pos: [27.18, 56.28], role: 'IRIN HQ' },
        { name: 'Bushehr Naval', pos: [28.92, 50.83], role: 'IRGCN Base' },
        { name: 'Jask', pos: [25.64, 57.77], role: 'Strait Control' },
        { name: 'Chahbahar', pos: [25.30, 60.63], role: 'Indian Ocean' },
        { name: 'Abu Musa Island', pos: [25.87, 55.03], role: 'Island Garrison' },
        { name: 'Qeshm Island', pos: [26.85, 55.90], role: 'IRGCN Forward' },
      ],
    },
  },
  airForce: {
    fighters: {
      f14: { count: 24, note: 'Tomcat (aging, partially operational)' },
      mig29: { count: 36, note: 'Fulcrum' },
      su24: { count: 24, note: 'Fencer' },
      f4: { count: 63, note: 'Phantom II (aging)' },
      f5: { count: 43, note: 'Tiger II (aging)' },
      kowsar: { count: 12, note: 'Domestic (F-5 derivative)' },
    },
    uavs: {
      shahed136: { count: 'Mass production', range: 2500, type: 'Loitering Munition' },
      mohajer6: { count: 100, range: 200, type: 'MALE UAV' },
      ababil: { count: 'Large inventory', range: 150, type: 'Tactical UAV' },
      shahed129: { count: 50, range: 1700, type: 'MALE UCAV' },
      kaman22: { count: 'Unknown', range: 3000, type: 'Stealth UCAV' },
    },
    totalAircraft: 551,
    bases: [
      { name: 'Isfahan AFB (8th TAB)', pos: [32.75, 51.86], role: 'Fighter Base' },
      { name: 'Mehrabad (1st TAB)', pos: [35.69, 51.31], role: 'Transport/Fighter' },
      { name: 'Shiraz (7th TAB)', pos: [29.54, 52.59], role: 'Fighter Base' },
      { name: 'Dezful (4th TAB)', pos: [32.43, 48.38], role: 'Fighter Base' },
      { name: 'Bandar Abbas AFB', pos: [27.22, 56.23], role: 'Naval Aviation' },
      { name: 'Bushehr AB', pos: [28.95, 50.84], role: 'Air Defense' },
      { name: 'Omidiyeh AB', pos: [30.83, 49.53], role: 'Tactical Fighter' },
    ],
  },
  missiles: {
    ballistic: [
      { name: 'Shahab-3', range: 2000, payload: 750, type: 'MRBM', count: 'Unknown', cep: '500m' },
      { name: 'Ghadr-110', range: 1800, payload: 750, type: 'MRBM', count: 'Unknown', cep: '300m' },
      { name: 'Emad', range: 1700, payload: 750, type: 'MRBM', count: 'Unknown', cep: '50m' },
      { name: 'Sejjil-2', range: 2500, payload: 750, type: 'MRBM', count: 'Unknown', cep: '50m' },
      { name: 'Khorramshahr-4 (Kheibar Shekan)', range: 2000, payload: 1500, type: 'MRBM', count: 'Unknown', cep: '30m' },
      { name: 'Fattah-1', range: 1400, payload: 'Unknown', type: 'Hypersonic MRBM', count: 'New', cep: 'Maneuverable' },
      { name: 'Dezful', range: 1000, payload: 450, type: 'SRBM', count: 'Unknown', cep: '10m' },
      { name: 'Fateh-313', range: 500, payload: 450, type: 'SRBM', count: 'Hundreds', cep: '10m' },
      { name: 'Zolfaghar', range: 700, payload: 450, type: 'SRBM', count: 'Hundreds', cep: '30m' },
    ],
    cruise: [
      { name: 'Hoveyzeh', range: 1350, type: 'LACM' },
      { name: 'Soumar', range: 2500, type: 'LACM' },
      { name: 'Ya Ali', range: 700, type: 'LACM' },
      { name: 'Quds-1', range: 800, type: 'LACM (Houthi variant)' },
    ],
    antiShip: [
      { name: 'Khalij Fars', range: 300, type: 'ASBM', note: 'Anti-ship ballistic' },
      { name: 'Noor (C-802)', range: 170, type: 'AShM' },
      { name: 'Ghader', range: 300, type: 'AShM' },
      { name: 'Nasir', range: 100, type: 'AShM' },
    ],
    totalEstimated: 3000,
    missileSites: [
      { name: 'Tabriz Missile Base', pos: [38.07, 46.30] },
      { name: 'Khorramabad Underground', pos: [33.49, 48.36] },
      { name: 'Shahrud Missile Range', pos: [36.42, 54.97] },
      { name: 'Parchin Complex', pos: [35.52, 51.77] },
      { name: 'Bid Kaneh', pos: [34.40, 50.40] },
      { name: 'Semnan Launch Site', pos: [35.23, 53.92] },
      { name: 'Isfahan Missile Facility', pos: [32.65, 51.65] },
    ],
  },
  airDefense: {
    systems: [
      { name: 'S-300PMU2', type: 'Long-range SAM', range: 200, count: 4, origin: 'Russia' },
      { name: 'Bavar-373', type: 'Long-range SAM', range: 300, count: 'Unknown', origin: 'Iran' },
      { name: 'Khordad-15', type: 'Medium-range SAM', range: 120, count: 'Unknown', origin: 'Iran' },
      { name: 'Sayyad-3', type: 'Medium-range SAM', range: 120, count: 'Unknown', origin: 'Iran' },
      { name: 'Mersad', type: 'Short-range SAM', range: 40, count: 'Unknown', origin: 'Iran' },
      { name: 'Rapier', type: 'Short-range SAM', range: 8, count: 30, origin: 'UK' },
    ],
    sites: [
      { name: 'Tehran AD Zone', pos: [35.69, 51.39], systems: ['S-300PMU2', 'Bavar-373', 'Khordad-15'] },
      { name: 'Isfahan AD Zone', pos: [32.65, 51.68], systems: ['S-300PMU2', 'Bavar-373'] },
      { name: 'Natanz AD Zone', pos: [33.72, 51.73], systems: ['S-300PMU2', 'Bavar-373', 'Khordad-15'] },
      { name: 'Bushehr Nuclear AD', pos: [28.83, 50.90], systems: ['S-300PMU2', 'Mersad'] },
      { name: 'Bandar Abbas AD', pos: [27.18, 56.28], systems: ['Khordad-15', 'Mersad'] },
      { name: 'Tabriz AD Zone', pos: [38.08, 46.29], systems: ['Bavar-373'] },
    ],
  },
  nuclear: {
    facilities: [
      { name: 'Natanz FEP', pos: [33.72, 51.73], type: 'Enrichment', status: 'Active - 60% U-235', detail: 'Underground centrifuge halls, ~9,000 IR-1, IR-2m, IR-4, IR-6' },
      { name: 'Fordow FFEP', pos: [34.88, 51.59], type: 'Enrichment', status: 'Active - 60% U-235', detail: 'Underground facility, hardened in mountain, ~1,000 centrifuges' },
      { name: 'Isfahan UCF', pos: [32.60, 51.68], type: 'Conversion', status: 'Active', detail: 'Uranium Conversion Facility' },
      { name: 'Bushehr NPP', pos: [28.83, 50.90], type: 'Power Reactor', status: 'Operational', detail: '1,000MW VVER-1000, Russian-built' },
      { name: 'Arak IR-40', pos: [34.38, 49.24], type: 'Heavy Water Reactor', status: 'Modified/Redesigned', detail: 'Originally plutonium-capable, modified under JCPOA' },
      { name: 'Parchin', pos: [35.52, 51.77], type: 'Military-Nuclear', status: 'Suspected', detail: 'Explosive testing, weapons research suspected' },
    ],
    enrichment: {
      current: '60% U-235',
      weaponGrade: '90% U-235',
      breakoutTime: '~1-2 weeks (estimated)',
      stockpile: '~122 kg of 60% enriched uranium (Feb 2026)',
    },
  },
};

// ── Proxy Forces ─────────────────────────────────────────────────────────────
const PROXY_FORCES = [
  {
    name: 'Hezbollah',
    country: 'Lebanon',
    personnel: '100,000+',
    missiles: '150,000+',
    funding: '$700M/yr from Iran',
    pos: [33.87, 35.51],
    status: 'Active - Post-2024 conflict',
    capabilities: ['Precision-guided missiles', 'Kornet ATGMs', 'UAVs', 'Tunnels'],
    color: '#f59e0b',
  },
  {
    name: 'Houthis (Ansar Allah)',
    country: 'Yemen',
    personnel: '30,000+',
    missiles: 'Ballistic, Cruise, USVs',
    funding: 'Iran IRGC-QF',
    pos: [15.36, 44.21],
    status: 'Active - Red Sea attacks on shipping',
    capabilities: ['Anti-ship missiles', 'Shahed-136 UAVs', 'Ballistic missiles', 'Naval mines', 'USVs'],
    color: '#ef4444',
  },
  {
    name: 'Iraqi Shiite Militias (PMF)',
    country: 'Iraq',
    personnel: '120,000+',
    missiles: 'Rockets, Drones',
    funding: 'Iran IRGC-QF + Iraqi budget',
    pos: [33.31, 44.37],
    status: 'Active - Attacks on US bases',
    capabilities: ['122mm rockets', 'Shahed-series UAVs', 'IEDs/EFPs', 'Manpads'],
    color: '#f97316',
    subGroups: ['Kataib Hezbollah', 'Asaib Ahl al-Haq', 'Kataib Sayyid al-Shuhada', 'Harakat Hezbollah al-Nujaba'],
  },
  {
    name: 'Hamas',
    country: 'Palestine (Gaza)',
    personnel: '25,000-40,000',
    missiles: 'Rockets, Tunnels',
    funding: 'Iran + Qatar + Other',
    pos: [31.52, 34.45],
    status: 'Degraded post-Oct 2023',
    capabilities: ['Qassam rockets', 'Tunnel networks', 'ATGMs', 'RPGs'],
    color: '#22c55e',
  },
  {
    name: 'Palestinian Islamic Jihad',
    country: 'Palestine (Gaza/WB)',
    personnel: '12,000+',
    missiles: 'Rockets',
    funding: 'Iran - Primary',
    pos: [31.44, 34.40],
    status: 'Active',
    capabilities: ['Rockets', 'IEDs', 'Suicide operations'],
    color: '#14b8a6',
  },
];

// ── Sanctions Data ───────────────────────────────────────────────────────────
const SANCTIONS_DATA = {
  usSanctions: {
    totalDesignations: 1500,
    categories: [
      { name: 'Nuclear Program', count: 285, agency: 'OFAC/Treasury' },
      { name: 'Ballistic Missiles', count: 195, agency: 'OFAC/State' },
      { name: 'IRGC / Military', count: 320, agency: 'Treasury/Defense' },
      { name: 'Terrorism Financing', count: 180, agency: 'Treasury/Justice' },
      { name: 'Human Rights', count: 245, agency: 'Treasury/State' },
      { name: 'Oil & Energy', count: 175, agency: 'Treasury/Commerce' },
      { name: 'Cyber Activities', count: 68, agency: 'Treasury/Justice' },
      { name: 'Petrochemical', count: 92, agency: 'OFAC' },
    ],
  },
  economicImpact: {
    oilExports: { peak: 2.5, current: 1.3, unit: 'M barrels/day' },
    gdp: { value: 388, currency: 'USD Billion (2024 est.)' },
    inflation: '40%+',
    rialRate: { official: 42000, market: 620000, unit: 'per USD' },
    unemploymentOfficial: '9.7%',
    unemploymentReality: '~25-30%',
    foreignReserves: '$32B (estimated)',
  },
  keyEvents: [
    { date: '2018-05-08', event: 'US withdraws from JCPOA', impact: 'Maximum Pressure campaign begins' },
    { date: '2019-04-08', event: 'IRGC designated Foreign Terrorist Org', impact: 'First sovereign military designation' },
    { date: '2020-01-03', event: 'Soleimani assassination', impact: 'Major escalation, IRGC retaliates on Al Asad' },
    { date: '2023-10-07', event: 'Hamas attack on Israel', impact: 'Iran proxies escalate across region' },
    { date: '2024-04-13', event: 'Iran direct attack on Israel', impact: '300+ missiles/drones, mostly intercepted' },
    { date: '2024-10-01', event: 'Iran second missile barrage on Israel', impact: '180+ ballistic missiles' },
    { date: '2024-10-26', event: 'Israel retaliatory strikes on Iran', impact: 'Air defense & missile facilities targeted' },
  ],
};

// ── Escalation Timeline ──────────────────────────────────────────────────────
const ESCALATION_TIMELINE = [
  { year: 1979, event: 'Islamic Revolution & US Embassy Hostage Crisis', level: 9, category: 'crisis' },
  { year: 1980, event: 'Iran-Iraq War begins (US supports Iraq)', level: 7, category: 'war' },
  { year: 1988, event: 'USS Vincennes shoots down Iran Air 655', level: 8, category: 'military' },
  { year: 1988, event: 'Operation Praying Mantis - US Navy strikes', level: 8, category: 'military' },
  { year: 1995, event: 'Clinton imposes comprehensive sanctions', level: 5, category: 'sanctions' },
  { year: 2002, event: 'Bush names Iran in "Axis of Evil"', level: 6, category: 'diplomatic' },
  { year: 2003, event: 'Natanz enrichment facility revealed', level: 7, category: 'nuclear' },
  { year: 2006, event: 'UN Security Council sanctions begin', level: 6, category: 'sanctions' },
  { year: 2010, event: 'Stuxnet cyberattack on centrifuges', level: 7, category: 'cyber' },
  { year: 2012, event: 'Iran threatens to close Strait of Hormuz', level: 7, category: 'military' },
  { year: 2015, event: 'JCPOA nuclear deal signed', level: 2, category: 'diplomatic' },
  { year: 2018, event: 'Trump withdraws from JCPOA', level: 7, category: 'sanctions' },
  { year: 2019, event: 'Iran shoots down US RQ-4A drone', level: 8, category: 'military' },
  { year: 2019, event: 'Attacks on Saudi Aramco (Abqaiq)', level: 8, category: 'proxy' },
  { year: 2020, event: 'Soleimani assassination / Al Asad retaliation', level: 9, category: 'military' },
  { year: 2021, event: 'Natanz centrifuge sabotage', level: 6, category: 'cyber' },
  { year: 2023, event: 'Iran enriches to 84% briefly', level: 8, category: 'nuclear' },
  { year: 2023, event: 'Oct 7 attack & Axis of Resistance activation', level: 8, category: 'proxy' },
  { year: 2024, event: 'Houthi Red Sea shipping attacks', level: 7, category: 'proxy' },
  { year: 2024, event: 'Iran launches 300+ missiles/drones at Israel', level: 10, category: 'military' },
  { year: 2024, event: 'Israel strikes Iran air defenses', level: 9, category: 'military' },
  { year: 2025, event: 'Continued proxy attacks on US forces', level: 7, category: 'proxy' },
  { year: 2025, event: 'Iran unveils Fattah-2 hypersonic missile', level: 7, category: 'military' },
  { year: 2026, event: 'Nuclear breakout time under 2 weeks (IAEA)', level: 9, category: 'nuclear' },
];

// ── Cyber Operations ─────────────────────────────────────────────────────────
const CYBER_OPS = {
  usOperations: [
    { name: 'Stuxnet', year: 2010, target: 'Natanz centrifuges', impact: '1,000+ centrifuges destroyed', type: 'Sabotage' },
    { name: 'Operation Olympic Games', year: '2006-2012', target: 'Nuclear program', impact: 'Sustained cyber campaign', type: 'Espionage/Sabotage' },
    { name: 'Flame', year: 2012, target: 'Iranian networks', impact: 'Mass espionage', type: 'Espionage' },
    { name: 'Nitro Zeus', year: '2014-2016', target: 'Iran infrastructure', impact: 'Contingency plan for kinetic conflict, disabled air defenses', type: 'Preparation' },
    { name: 'CENTCOM Cyber Strike', year: 2019, target: 'IRGC missile systems', impact: 'Degraded launch capabilities', type: 'Offensive' },
    { name: 'CyberCom IRGC Ops', year: 2020, target: 'IRGCN targeting systems', impact: 'Post-Soleimani response', type: 'Offensive' },
  ],
  iranianOperations: [
    { name: 'Shamoon', year: 2012, target: 'Saudi Aramco', impact: '30,000 computers wiped', type: 'Destructive' },
    { name: 'Shamoon 2.0', year: 2016, target: 'Saudi government', impact: 'Second wave attacks', type: 'Destructive' },
    { name: 'APT33 (Elfin)', year: '2013-present', target: 'Aerospace/Energy', impact: 'Ongoing espionage', type: 'Espionage' },
    { name: 'APT34 (OilRig)', year: '2014-present', target: 'ME governments/orgs', impact: 'Intelligence collection', type: 'Espionage' },
    { name: 'APT35 (Charming Kitten)', year: '2014-present', target: 'US/Israel/UK', impact: 'Political espionage', type: 'Espionage' },
    { name: 'Dam Attack Attempt', year: 2013, target: 'Bowman Dam, New York', impact: 'Access gained, no damage', type: 'Probing' },
    { name: 'Albanian Gov Attack', year: 2022, target: 'Albanian government', impact: 'Systems destroyed, MEK data targeted', type: 'Destructive' },
    { name: 'Water Utility Hack', year: 2023, target: 'US water systems', impact: 'Aliquippa PA municipal water', type: 'Probing' },
    { name: 'MuddyWater', year: '2017-present', target: 'ME/US government', impact: 'Espionage collection', type: 'Espionage' },
  ],
};

// ── Strait of Hormuz Data ────────────────────────────────────────────────────
const STRAIT_OF_HORMUZ = {
  width: { narrowest: 33, unit: 'km' },
  shippingLanes: { width: 3.2, unit: 'km each direction' },
  oilFlow: { daily: 21, unit: 'M barrels/day', worldShare: '~21% of global oil' },
  lngFlow: { daily: 14, unit: 'Bcf/day', worldShare: '~25% of global LNG' },
  threats: [
    'Iranian naval mines (5,000+ inventory)',
    'IRGCN fast attack boats (1,500+)',
    'Anti-ship cruise missiles (coastal batteries)',
    'Anti-ship ballistic missiles (Khalij Fars)',
    'Submarine operations (26 subs)',
    'UAV/Drone swarm attacks',
  ],
  recentIncidents: [
    { date: '2024-01', event: 'Houthi attacks on commercial vessels in Red Sea' },
    { date: '2024-04', event: 'IRGC seizes MSC Aries container ship' },
    { date: '2024-11', event: 'Multiple tanker harassments by IRGCN' },
    { date: '2025-02', event: 'Continued Houthi missile/drone attacks on shipping' },
    { date: '2025-08', event: 'IRGCN exercises near Strait' },
    { date: '2026-01', event: 'Increased patrols by US 5th Fleet' },
  ],
  coordinates: {
    entry: [26.57, 56.25],
    exit: [26.07, 56.95],
    center: [26.57, 56.43],
  },
};

// ── Map Configuration ────────────────────────────────────────────────────────
const MAP_CONFIG = {
  center: [22.0, 58.0],
  zoom: 4,
  minZoom: 3,
  maxZoom: 12,
  conflictZones: [
    { name: 'Persian Gulf', bounds: [[23, 48], [30, 57]], color: '#ef444466' },
    { name: 'Strait of Hormuz', bounds: [[25.5, 55.5], [27, 57.5]], color: '#f5920066' },
    { name: 'Red Sea / Bab al-Mandab', bounds: [[12, 41], [16, 45]], color: '#ef444466' },
    { name: 'Eastern Mediterranean', bounds: [[32, 33], [36, 37]], color: '#f5920066' },
    { name: 'Arabian Sea Corridor', bounds: [[14, 58], [24, 72]], color: '#ff993320' },
  ],
};

// ══════════════════════════════════════════════════════════════════════════════
// GLOBAL SENTIMENT ANALYSIS — DATA ENGINE
// ══════════════════════════════════════════════════════════════════════════════

const SENTIMENT_PERSONALITIES = {
  us: {
    government: [
      'Joe Biden','Donald Trump','Kamala Harris','Mike Johnson','Chuck Schumer',
      'Mitch McConnell','Hakeem Jeffries','Nancy Pelosi','Marco Rubio','Pete Hegseth',
      'Jake Sullivan','Antony Blinken','Lloyd Austin','Avril Haines','William Burns',
      'Janet Yellen','Merrick Garland','Gina Raimondo','Tom Cotton','Lindsey Graham',
      'Ted Cruz','Bernie Sanders','Elizabeth Warren','AOC','Ron DeSantis',
      'Gavin Newsom','Greg Abbott','JD Vance','Mike Pompeo','Nikki Haley',
      'John Kirby','Karine Jean-Pierre','Matt Gaetz','Jim Jordan','Adam Schiff',
      'Ro Khanna','Tulsi Gabbard','Vivek Ramaswamy','Tim Scott','Josh Hawley',
      'Chris Murphy','Mark Warner','Ben Cardin','John Fetterman','Cory Booker',
      'Pete Buttigieg','Samantha Power','Linda Thomas-Greenfield','Robert Lighthizer','Susan Rice'
    ],
    business: [
      'Elon Musk','Tim Cook','Satya Nadella','Mark Zuckerberg','Jeff Bezos',
      'Jensen Huang','Sundar Pichai','Andy Jassy','Sam Altman','Jamie Dimon',
      'Warren Buffett','Larry Fink','Brian Moynihan','David Solomon','Mary Barra',
      'Pat Gelsinger','Lisa Su','Arvind Krishna','Marc Benioff','Reed Hastings',
      'Bob Iger','Brian Chesky','Dara Khosrowshahi','Daniel Ek','Jack Dorsey',
      'Peter Thiel','Reid Hoffman','Sheryl Sandberg','Susan Wojcicki','Safra Catz',
      'Doug McMillon','Laxman Narasimhan','James Gorman','Jane Fraser','Charles Scharf',
      'Brian Cornell','Karen Lynch','Mike Wirth','Darren Woods','Ryan Lance',
      'Shantanu Narayen','Chuck Robbins','Keith Block','Abigail Johnson','Ken Griffin',
      'Ray Dalio','Larry Ellison','Michael Dell','Meg Whitman','Ginni Rometty'
    ],
    entertainment: [
      'Taylor Swift','Beyoncé','Drake','Bad Bunny','Travis Scott',
      'Rihanna','Selena Gomez','Dwayne Johnson','Ryan Reynolds','Zendaya',
      'Tom Holland','Timothée Chalamet','Florence Pugh','Margot Robbie','Keanu Reeves',
      'Leonardo DiCaprio','Scarlett Johansson','Chris Hemsworth','Robert Downey Jr','Tom Hanks',
      'Oprah Winfrey','Kim Kardashian','Kylie Jenner','Travis Kelce','Jimmy Fallon',
      'Stephen Colbert','Trevor Noah','John Oliver','Seth Meyers','Jimmy Kimmel',
      'Billie Eilish','Olivia Rodrigo','SZA','Doja Cat','Post Malone',
      'Morgan Wallen','Luke Combs','Miley Cyrus','Lady Gaga','Ed Sheeran',
      'Adele','Bruno Mars','The Weeknd','Cardi B','Megan Thee Stallion',
      'Jennifer Aniston','Chris Pratt','Gal Gadot','Pedro Pascal','Sydney Sweeney'
    ],
    sports: [
      'LeBron James','Stephen Curry','Patrick Mahomes','Aaron Rodgers','Lamar Jackson',
      'Lionel Messi','Cristiano Ronaldo','Shohei Ohtani','Aaron Judge','Bryce Harper',
      'Caitlin Clark','Angel Reese','Simone Biles','Serena Williams','Naomi Osaka',
      'Connor McDavid','Sidney Crosby','Travis Kelce','Tyreek Hill','Ja Morant',
      'Giannis Antetokounmpo','Luka Dončić','Nikola Jokić','Kevin Durant','Jimmy Butler',
      'Tiger Woods','Rory McIlroy','Scottie Scheffler','Max Verstappen','Lewis Hamilton',
      'Tom Brady','Peyton Manning','Derek Jeter','Mike Trout','Mookie Betts',
      'Alex Ovechkin','Megan Rapinoe','Alex Morgan','Christian Pulisic','Weston McKennie',
      'Sabrina Ionescu','Diana Taurasi','Breanna Stewart','Sha\'Carri Richardson','Noah Lyles',
      'Caeleb Dressel','Katie Ledecky','Suni Lee','Jordan Chiles','Jayson Tatum'
    ],
    eminent: [
      'Neil deGrasse Tyson','Elon Musk','Bill Gates','Melinda French Gates','Barack Obama',
      'Michelle Obama','Hillary Clinton','George W. Bush','Al Gore','John Kerry',
      'Anthony Fauci','Vivek Murthy','Jerome Powell','Christine Lagarde','Kristalina Georgieva',
      'António Guterres','Jens Stoltenberg','Volodymyr Zelenskyy','Emmanuel Macron','Keir Starmer',
      'Olaf Scholz','Justin Trudeau','Benjamin Netanyahu','MBS','Pope Francis',
      'Dalai Lama','Malala Yousafzai','Greta Thunberg','Jane Goodall','David Attenborough',
      'Noam Chomsky','Yuval Noah Harari','Jordan Peterson','Ben Shapiro','Joe Rogan',
      'Tucker Carlson','Rachel Maddow','Anderson Cooper','Wolf Blitzer','Sean Hannity',
      'Bob Woodward','Malcolm Gladwell','Ta-Nehisi Coates','Ibram X. Kendi','Cornell West',
      'Nassim Taleb','Paul Krugman','Larry Summers','Niall Ferguson','Fareed Zakaria',
      'Thomas Friedman','David Brooks','Ezra Klein','Kara Swisher','Scott Galloway',
      'Lex Fridman','Andrew Huberman','Tim Ferriss','Brené Brown','Adam Grant',
      'Ray Kurzweil','Demis Hassabis','Yann LeCun','Geoffrey Hinton','Fei-Fei Li',
      'Kai-Fu Lee','Sam Harris','Mehdi Hasan','Chris Hayes','Joy Reid',
      'George Stephanopoulos','Jake Tapper','Dana Bash','Kristen Welker','Savannah Guthrie',
      'Bono','Steven Spielberg','Martin Scorsese','Quentin Tarantino','Christopher Nolan',
      'James Cameron','Denis Villeneuve','Ava DuVernay','Spike Lee','Guillermo del Toro',
      'JK Rowling','Stephen King','Colleen Hoover','James Patterson','Margaret Atwood',
      'Neil Gaiman','George RR Martin','Chimamanda Ngozi Adichie','Ta-Nehisi Coates','Roxane Gay',
      'Jeff Sachs','Daron Acemoglu','Abhijit Banerjee','Esther Duflo','Joseph Stiglitz'
    ]
  },
  india: {
    government: [
      'Narendra Modi','Rahul Gandhi','Amit Shah','Rajnath Singh','Nirmala Sitharaman',
      'S Jaishankar','Nitin Gadkari','Piyush Goyal','Smriti Irani','Dharmendra Pradhan',
      'Anurag Thakur','Kiren Rijiju','Jyotiraditya Scindia','Ashwini Vaishnaw','Mansukh Mandaviya',
      'Mamata Banerjee','Arvind Kejriwal','MK Stalin','Yogi Adityanath','Nitish Kumar',
      'Akhilesh Yadav','K Chandrashekar Rao','Pinarayi Vijayan','Siddaramaiah','Naveen Patnaik',
      'Uddhav Thackeray','Sharad Pawar','Mayawati','Lalu Prasad Yadav','Tejashwi Yadav',
      'Priyanka Gandhi','Mallikarjun Kharge','P Chidambaram','Kapil Sibal','Asaduddin Owaisi',
      'Shashi Tharoor','Subrahmanyam Jaishankar','Nana Patole','Omar Abdullah','Mehbooba Mufti',
      'Devendra Fadnavis','Eknath Shinde','Ajit Pawar','Hemant Soren','Bhagwant Mann',
      'Himanta Biswa Sarma','Pramod Sawant','Basavaraj Bommai','Droupadi Murmu','Jagdeep Dhankhar'
    ],
    business: [
      'Mukesh Ambani','Gautam Adani','Ratan Tata','Azim Premji','Shiv Nadar',
      'N Chandrasekaran','Salil Parekh','C Vijayakumar','Thierry Delaporte','Rishad Premji',
      'Kumar Mangalam Birla','Anand Mahindra','Sajjan Jindal','Lakshmi Mittal','Sunil Mittal',
      'Uday Kotak','Deepak Parekh','Kiran Mazumdar-Shaw','Falguni Nayar','Radhakishan Damani',
      'Dilip Shanghvi','Cyrus Poonawalla','Adar Poonawalla','Harsh Mariwala','Adi Godrej',
      'Naveen Jindal','Rahul Bajaj','Sanjiv Bajaj','Pankaj Munjal','Venu Srinivasan',
      'TV Narendran','Aditya Puri','Romesh Sobti','Sandeep Bakhshi','Amitabh Chaudhry',
      'Sashidhar Jagdishan','Nithin Kamath','Zerodha Nikhil','Bhavish Aggarwal','Vijay Shekhar Sharma',
      'Byju Raveendran','Ashneer Grover','Deepinder Goyal','Ritesh Agarwal','Kunal Shah',
      'Sridhar Vembu','Girish Mathrubootham','Sachin Bansal','Binny Bansal','Nandan Nilekani'
    ],
    entertainment: [
      'Shah Rukh Khan','Amitabh Bachchan','Aamir Khan','Salman Khan','Akshay Kumar',
      'Ranveer Singh','Ranbir Kapoor','Hrithik Roshan','Deepika Padukone','Priyanka Chopra',
      'Alia Bhatt','Katrina Kaif','Kareena Kapoor','Anushka Sharma','Rashmika Mandanna',
      'Allu Arjun','Ram Charan','Jr NTR','Prabhas','Yash',
      'Rajinikanth','Kamal Haasan','Vijay','Mohanlal','Mammootty',
      'SS Rajamouli','Sanjay Leela Bhansali','Rajkumar Hirani','Zoya Akhtar','Karan Johar',
      'Arijit Singh','AR Rahman','Shreya Ghoshal','Atif Aslam','Badshah',
      'Yo Yo Honey Singh','Diljit Dosanjh','AP Dhillon','Anuv Jain','King',
      'Samantha Ruth Prabhu','Nayanthara','Janhvi Kapoor','Sara Ali Khan','Kiara Advani',
      'Tiger Shroff','Varun Dhawan','Kartik Aaryan','Vicky Kaushal','Ayushmann Khurrana'
    ],
    sports: [
      'Virat Kohli','Rohit Sharma','MS Dhoni','Jasprit Bumrah','Hardik Pandya',
      'Rishabh Pant','Shubman Gill','Suryakumar Yadav','Ravindra Jadeja','KL Rahul',
      'PV Sindhu','Neeraj Chopra','Saina Nehwal','Mary Kom','Mirabai Chanu',
      'Bajrang Punia','Vinesh Phogat','Lovlina Borgohain','Nikhat Zareen','Aman Sehrawat',
      'Sunil Chhetri','Bhaichung Bhutia','Gurpreet Singh Sandhu','Smriti Mandhana','Harmanpreet Kaur',
      'Sania Mirza','Rohan Bopanna','Sumit Nagal','Leander Paes','Mahesh Bhupathi',
      'Abhinav Bindra','Manu Bhaker','Saurabh Chaudhary','Avinash Sable','Hima Das',
      'Dutee Chand','PR Sreejesh','Manpreet Singh','Rupinder Pal Singh','Amit Panghal',
      'Lakshya Sen','HS Prannoy','Kidambi Srikanth','Satwiksairaj Rankireddy','Chirag Shetty',
      'Anish Bhanwala','Elavenil Valarivan','Praggnanandhaa R','D Gukesh','Koneru Humpy'
    ],
    eminent: [
      'APJ Abdul Kalam (legacy)','Amartya Sen','Raghuram Rajan','Arvind Subramanian','Bibek Debroy',
      'Shashi Tharoor','Amish Tripathi','Chetan Bhagat','Arundhati Roy','Sudha Murty',
      'Narayana Murthy','Ratan Tata','Sadhguru','Sri Sri Ravi Shankar','Baba Ramdev',
      'Mohan Bhagwat','Gaur Gopal Das','BK Shivani','Prashant Kishor','Yogendra Yadav',
      'Ravish Kumar','Rajdeep Sardesai','Barkha Dutt','Arnab Goswami','Sudhir Chaudhary',
      'Dhruv Rathee','Abhigya Anand','Sandeep Maheshwari','Ranveer Allahbadia','Ankur Warikoo',
      'Tanmay Bhat','Kunal Kamra','Zakir Khan','Vir Das','Kapil Sharma',
      'Vishal Dadlani','Shankar Mahadevan','Asha Bhosle','Lata Mangeshkar (legacy)','Zakir Hussain',
      'Anand Kumar','Kiran Bedi','Medha Patkar','Anna Hazare','Vandana Shiva',
      'Sunita Williams','Kalpana Chawla (legacy)','K Sivan','S Somanath','Tessy Thomas',
      'Arunima Sinha','Manoj Bajpayee','Pankaj Tripathi','Nawazuddin Siddiqui','Irrfan Khan (legacy)',
      'Vishal Sikka','Jayant Sinha','Amitabh Kant','Krishnamurthy Subramanian','Sanjeev Sanyal',
      'TV Mohandas Pai','Kris Gopalakrishnan','S Gopalakrishnan','Venkatraman Ramakrishnan','C N R Rao',
      'Infosys Founders','Wipro Founders','TCS Leadership','HCL Founders','Tech Mahindra Leaders',
      'Sanjay Mehrotra','Ajay Banga','Indra Nooyi','Sundar Pichai','Satya Nadella',
      'Shantanu Narayen','Arvind Krishna','Parag Agrawal','Laxman Narasimhan','Leena Nair',
      'Jayathi Murthy','Sethuraman Panchanathan','Atul Gawande','Siddhartha Mukherjee','Raj Chetty',
      'Abhijit Banerjee','Esther Duflo','Venki Ramakrishnan','Har Gobind Khorana (legacy)','Subrahmanyan Chandrasekhar (legacy)',
      'Rabindranath Tagore (legacy)','Satyajit Ray (legacy)','Zubin Mehta','Ravi Shankar (legacy)','Zakir Hussain',
      'Deepak Chopra','Siddharth Malhotra','Rajkummar Rao','Taapsee Pannu','Kangana Ranaut'
    ]
  }
};

// ── Sentiment Word Pools ─────────────────────────────────────────────────────
const SENTIMENT_WORD_POOLS = {
  us: {
    positive: ['freedom','democracy','innovation','growth','prosperity','unity','progress','opportunity','justice','security','strength','leadership','recovery','resilience','jobs','economy','bipartisan','cooperation','peace','technology','AI','space','clean-energy','infrastructure','allies','diplomacy','markets','rally','breakthrough','success','vaccine','investment','startup','entrepreneurship','optimism'],
    negative: ['war','conflict','inflation','recession','division','extremism','polarization','sanctions','threat','crisis','shutdown','deficit','debt','cyberthreat','disinformation','inequality','corruption','violence','immigration','border','fentanyl','surveillance','censorship','tariffs','escalation','nuclear','proxy','terrorism','instability','unemployment','layoffs','misinformation','authoritarian'],
    neutral: ['election','congress','senate','policy','legislation','regulation','trade','budget','defense','military','NATO','G7','UN','summit','agreement','negotiation','bilateral','strategy','assessment','analysis','intelligence','briefing','committee','amendment','vote','debate','caucus','reform','review','framework','initiative','agenda','protocol','mandate','oversight']
  },
  india: {
    positive: ['development','Digital-India','Make-in-India','startup','growth','Atmanirbhar','infrastructure','metro','expressway','ISRO','Chandrayaan','UPI','Aadhaar','smart-city','renewable','solar','yoga','Ayurveda','unity','diversity','cricket','IPL','tourism','exports','FDI','manufacturing','semiconductor','5G','Vande-Bharat','bullet-train','inclusion','empowerment','Skill-India','education','Jan-Dhan'],
    negative: ['pollution','unemployment','inflation','poverty','communal','caste','corruption','scam','protest','farmers','reservation','violence','lynching','sedition','censorship','media-freedom','GDP-slowdown','NPAs','rupee-fall','brain-drain','migration','water-crisis','flood','drought','heatwave','traffic','encroachment','malnutrition','healthcare-gap','inequality','radicalization','fake-news','trolling'],
    neutral: ['Lok-Sabha','Rajya-Sabha','Parliament','budget','GST','RBI','SEBI','NITI-Aayog','election','BJP','Congress','AAP','coalition','NDA','INDIA-bloc','manifesto','judiciary','Supreme-Court','PIL','amendment','ordinance','census','survey','GDP','fiscal','monetary','bilateral','QUAD','BRICS','G20','SCO','ASEAN','diplomacy','foreign-policy','defence']
  }
};

// ── Sentiment Data Generator ─────────────────────────────────────────────────
function generateSentimentData(mode = 'us') {
  const seed = Math.floor(Date.now() / 7200000); // Changes every 2 hours
  const seededRandom = (n) => {
    let x = Math.sin(seed * 9301 + n * 49297 + 49831) * 10000;
    return x - Math.floor(x);
  };

  // Base sentiment ranges differ by mode
  const basePositive = mode === 'us' ? 32 + seededRandom(1) * 18 : 38 + seededRandom(1) * 16;
  const baseNegative = mode === 'us' ? 28 + seededRandom(2) * 16 : 24 + seededRandom(2) * 14;
  const baseNeutral = 100 - basePositive - baseNegative;

  // Category-level breakdowns
  const categories = ['government','business','entertainment','sports','eminent'];
  const categoryData = {};
  categories.forEach((cat, i) => {
    const pVar = (seededRandom(10 + i) - 0.5) * 20;
    const nVar = (seededRandom(20 + i) - 0.5) * 16;
    let p = Math.max(5, Math.min(85, basePositive + pVar));
    let n = Math.max(5, Math.min(85, baseNegative + nVar));
    let neu = Math.max(5, 100 - p - n);
    const total = p + n + neu;
    categoryData[cat] = {
      positive: Math.round(p / total * 100),
      negative: Math.round(n / total * 100),
      neutral: Math.round(neu / total * 100),
      count: SENTIMENT_PERSONALITIES[mode][cat]?.length || 50
    };
  });

  // Word cloud generation
  const pools = SENTIMENT_WORD_POOLS[mode];
  const allWords = [];
  const usedWords = new Set();

  const addWords = (pool, sentiment, baseCount) => {
    pool.forEach((word, i) => {
      if (usedWords.has(word)) return;
      usedWords.add(word);
      const count = Math.max(1, Math.round(baseCount * (1 - i * 0.02) * (0.6 + seededRandom(i + word.length) * 0.8)));
      allWords.push({ word, count, sentiment });
    });
  };

  addWords(pools.positive, 'positive', 45);
  addWords(pools.negative, 'negative', 40);
  addWords(pools.neutral, 'neutral', 35);

  // Sort by count desc, take top 80
  allWords.sort((a, b) => b.count - a.count);
  const wordCloud = allWords.slice(0, 30);

  // Top voices (simulated influential accounts)
  const personas = SENTIMENT_PERSONALITIES[mode];
  const topVoices = [];
  categories.forEach(cat => {
    const list = personas[cat];
    if (list && list.length) {
      const idx = Math.floor(seededRandom(50 + cat.length) * Math.min(5, list.length));
      topVoices.push({ name: list[idx], category: cat });
    }
  });

  return {
    mode,
    positive: Math.round(basePositive),
    negative: Math.round(baseNegative),
    neutral: Math.round(baseNeutral),
    categoryData,
    wordCloud,
    topVoices,
    totalPersonalities: Object.values(personas).reduce((s, a) => s + a.length, 0),
    generatedAt: new Date(),
    nextRefresh: new Date(Date.now() + 7200000)
  };
}
