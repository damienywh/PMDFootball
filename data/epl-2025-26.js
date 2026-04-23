/* ================================================================
   COMPETITION CONFIG — PREMIER LEAGUE 2025/26
   ================================================================
   To pivot this site to a different competition (e.g. World Cup),
   copy this file, edit, and change the <script> tag in index.html.
   See data/worldcup-2026.js for the template.

   Top scorer names & attributes are best-effort guesses for April 2026
   — edit the `topScorer` fields freely to reflect latest state.
   ================================================================ */

window.COMPETITION = {
  key: 'epl-2025-26',
  shortName: 'Premier League',
  longName: 'PMDF Football Predictor — Premier League 2025/26',
  tagline: 'Predict the final top 5 & bottom 3 — highest score wins',
  totalGames: 38,
  baselineDate: '21 April 2026',
  seasonEndDate: '24 May 2026',

  topN: 5,
  botN: 3,

  topLabel: 'TOP FIVE',
  topSubLabel: 'CHAMPIONS LEAGUE',
  botLabel: 'BOTTOM THREE',
  botSubLabel: 'RELEGATION',

  scoring: {
    exact: 5,
    correctGroup: 2,
  },

  tiebreakers: [
    {
      id: 'europaSpot',
      label: '6TH PLACE',
      subLabel: 'Europa League qualifier — auto-tracked',
      points: 4,
      source: 'rank6',
      candidates: [],
    },
    {
      id: 'mostGoals',
      label: 'MOST GOALS SCORED',
      subLabel: 'Team with highest GF — auto-tracked',
      points: 4,
      source: 'topGF',
      candidates: [],
    },
    {
      id: 'mostHated',
      label: 'MOST HATED TEAM',
      subLabel: 'PMDF crowd vote — majority wins',
      points: 4,
      source: 'mode',   // winner = most-picked team across all players
      candidates: [],   // any team
    },
    {
      id: 'goldenBoot',
      label: 'GOLDEN BOOT',
      subLabel: 'Top scorer — set by admin at seasons end',
      points: 6,
      source: 'manual',
      // Real PL top 10 as of April 2026 — source: Sporting News.
      // "Others" covers anyone outside this list who mounts a late charge.
      candidatePlayers: [
        { id: 'haaland',       name: 'Haaland',       team: 'MCI' },
        { id: 'thiago',        name: 'Igor Thiago',   team: 'BRE' },
        { id: 'semenyo',       name: 'Semenyo',       team: 'BOU' },
        { id: 'joao-pedro',    name: 'Joao Pedro',    team: 'CHE' },
        { id: 'ekitike',       name: 'Ekitike',       team: 'LIV' },
        { id: 'calvert-lewin', name: 'Calvert-Lewin', team: 'LEE' },
        { id: 'gyokeres',      name: 'Gyokeres',      team: 'ARS' },
        { id: 'welbeck',       name: 'Welbeck',       team: 'BHA' },
        { id: 'wilson',        name: 'Wilson',        team: 'FUL' },
        { id: 'bruno-g',       name: 'Bruno Guimaraes', team: 'NEW' },
        { id: 'others',        name: 'Anyone else',   team: null  },
      ],
    },
  ],

  /* ================================================================
     TEAMS — 20 Premier League clubs
     ================================================================
     badge template: 'roundel' | 'stripes-v' | 'stripes-h' | 'shield' | 'cross' | 'hoops'
     topScorer.style.hairstyle: 'short' | 'buzz' | 'medium' | 'long' | 'bald' | 'mohawk'
     topScorer.style.facial: 'none' | 'beard' | 'moustache' | 'stubble'
     ================================================================ */
  teams: [
    { abbr: 'MCI', name: 'Man City', full: 'Manchester City',
      color: '#6CABDD', fg: '#ffffff', accent: '#1C2C5B',
      badge: 'stripes-h',
      espnMatch: ['Manchester City', 'Man City'],
      topScorer: { name: 'Haaland', style: { hair: '#E6C78F', skin: '#F4CFA3', facial: 'none', hairstyle: 'medium' } },
      baseline: { rank: 1, pts: 70, gp: 33, w: 21, d: 7, l: 5, gf: 76, ga: 28, gd: 48 }
    },
    { abbr: 'ARS', name: 'Arsenal', full: 'Arsenal FC',
      color: '#EF0107', fg: '#ffffff', accent: '#FFFFFF',
      badge: 'cross',
      espnMatch: ['Arsenal'],
      topScorer: { name: 'Gyokeres', style: { hair: '#C89655', skin: '#F4CFA3', facial: 'stubble', hairstyle: 'short' } },
      baseline: { rank: 2, pts: 70, gp: 33, w: 21, d: 7, l: 5, gf: 68, ga: 30, gd: 38 }
    },
    { abbr: 'MUN', name: 'Man United', full: 'Manchester United',
      color: '#DA020E', fg: '#ffffff', accent: '#FFE500',
      badge: 'shield',
      espnMatch: ['Manchester United', 'Man United'],
      topScorer: { name: 'Mbeumo', style: { hair: '#0A0604', skin: '#5C3B22', facial: 'stubble', hairstyle: 'buzz' } },
      baseline: { rank: 3, pts: 58, gp: 33, w: 16, d: 10, l: 7, gf: 55, ga: 40, gd: 15 }
    },
    { abbr: 'AVL', name: 'Aston Villa', full: 'Aston Villa',
      color: '#670E36', fg: '#95BFE5', accent: '#95BFE5',
      badge: 'shield',
      espnMatch: ['Aston Villa'],
      topScorer: { name: 'Watkins', style: { hair: '#2A1810', skin: '#6B4426', facial: 'none', hairstyle: 'short' } },
      baseline: { rank: 4, pts: 58, gp: 33, w: 17, d: 7, l: 9, gf: 58, ga: 46, gd: 12 }
    },
    { abbr: 'LIV', name: 'Liverpool', full: 'Liverpool FC',
      color: '#C8102E', fg: '#ffffff', accent: '#00B2A9',
      badge: 'stripes-h',
      espnMatch: ['Liverpool', 'Liverpool FC'],
      topScorer: { name: 'Ekitike', style: { hair: '#2A1810', skin: '#8A5A33', facial: 'none', hairstyle: 'medium' } },
      baseline: { rank: 5, pts: 55, gp: 33, w: 16, d: 7, l: 10, gf: 60, ga: 42, gd: 18 }
    },
    { abbr: 'BHA', name: 'Brighton', full: 'Brighton & Hove Albion',
      color: '#0057B8', fg: '#ffffff', accent: '#FFFFFF',
      badge: 'stripes-v',
      espnMatch: ['Brighton', 'Brighton & Hove Albion', 'Brighton Hove Albion'],
      topScorer: { name: 'Welbeck', style: { hair: '#1A0F0A', skin: '#6B4426', facial: 'beard', hairstyle: 'short' } },
      baseline: { rank: 6, pts: 50, gp: 34, w: 13, d: 11, l: 10, gf: 52, ga: 46, gd: 6 }
    },
    { abbr: 'BOU', name: 'Bournemouth', full: 'AFC Bournemouth',
      color: '#DA291C', fg: '#ffffff', accent: '#000000',
      badge: 'stripes-h',
      espnMatch: ['Bournemouth', 'AFC Bournemouth'],
      topScorer: { name: 'Semenyo', style: { hair: '#0A0604', skin: '#6B4426', facial: 'none', hairstyle: 'short' } },
      baseline: { rank: 7, pts: 49, gp: 34, w: 11, d: 16, l: 7, gf: 48, ga: 42, gd: 6 }
    },
    { abbr: 'CHE', name: 'Chelsea', full: 'Chelsea FC',
      color: '#034694', fg: '#ffffff', accent: '#DBA111',
      badge: 'cross',
      espnMatch: ['Chelsea', 'Chelsea FC'],
      topScorer: { name: 'Joao Pedro', style: { hair: '#2A1810', skin: '#C89773', facial: 'stubble', hairstyle: 'medium' } },
      baseline: { rank: 8, pts: 48, gp: 34, w: 13, d: 9, l: 12, gf: 54, ga: 48, gd: 6 }
    },
    { abbr: 'BRE', name: 'Brentford', full: 'Brentford FC',
      color: '#E30613', fg: '#ffffff', accent: '#FFFFFF',
      badge: 'stripes-v',
      espnMatch: ['Brentford', 'Brentford FC'],
      topScorer: { name: 'Igor Thiago', style: { hair: '#0A0604', skin: '#6B4426', facial: 'stubble', hairstyle: 'short' } },
      baseline: { rank: 9, pts: 48, gp: 33, w: 13, d: 9, l: 11, gf: 50, ga: 48, gd: 2 }
    },
    { abbr: 'EVE', name: 'Everton', full: 'Everton FC',
      color: '#003399', fg: '#ffffff', accent: '#FFFFFF',
      badge: 'roundel',
      espnMatch: ['Everton', 'Everton FC'],
      topScorer: { name: 'Beto', style: { hair: '#0A0604', skin: '#5C3B22', facial: 'none', hairstyle: 'buzz' } },
      baseline: { rank: 10, pts: 47, gp: 33, w: 13, d: 8, l: 12, gf: 44, ga: 46, gd: -2 }
    },
    { abbr: 'SUN', name: 'Sunderland', full: 'Sunderland AFC',
      color: '#EB172B', fg: '#ffffff', accent: '#000000',
      badge: 'stripes-v',
      espnMatch: ['Sunderland', 'Sunderland AFC'],
      topScorer: { name: 'Diarra', style: { hair: '#0A0604', skin: '#5C3B22', facial: 'none', hairstyle: 'short' } },
      baseline: { rank: 11, pts: 46, gp: 33, w: 12, d: 10, l: 11, gf: 40, ga: 42, gd: -2 }
    },
    { abbr: 'FUL', name: 'Fulham', full: 'Fulham FC',
      color: '#FFFFFF', fg: '#000000', accent: '#000000',
      badge: 'stripes-h',
      espnMatch: ['Fulham', 'Fulham FC'],
      topScorer: { name: 'Wilson', style: { hair: '#6B4426', skin: '#E8B085', facial: 'none', hairstyle: 'short' } },
      baseline: { rank: 12, pts: 45, gp: 33, w: 13, d: 6, l: 14, gf: 48, ga: 50, gd: -2 }
    },
    { abbr: 'CRY', name: 'Crystal Palace', full: 'Crystal Palace',
      color: '#1B458F', fg: '#FFFFFF', accent: '#C4122E',
      badge: 'stripes-h',
      espnMatch: ['Crystal Palace'],
      topScorer: { name: 'Mateta', style: { hair: '#0A0604', skin: '#5C3B22', facial: 'beard', hairstyle: 'short' } },
      baseline: { rank: 13, pts: 43, gp: 32, w: 11, d: 10, l: 11, gf: 44, ga: 48, gd: -4 }
    },
    { abbr: 'NEW', name: 'Newcastle', full: 'Newcastle United',
      color: '#241F20', fg: '#ffffff', accent: '#FFFFFF',
      badge: 'stripes-v',
      espnMatch: ['Newcastle', 'Newcastle United'],
      topScorer: { name: 'Isak', style: { hair: '#2A1810', skin: '#D4A574', facial: 'none', hairstyle: 'medium' } },
      baseline: { rank: 14, pts: 42, gp: 33, w: 12, d: 6, l: 15, gf: 50, ga: 54, gd: -4 }
    },
    { abbr: 'LEE', name: 'Leeds', full: 'Leeds United',
      color: '#FFCD00', fg: '#1D428A', accent: '#1D428A',
      badge: 'shield',
      espnMatch: ['Leeds', 'Leeds United'],
      topScorer: { name: 'Calvert-Lewin', style: { hair: '#2A1810', skin: '#5C3B22', facial: 'none', hairstyle: 'buzz' } },
      baseline: { rank: 15, pts: 40, gp: 34, w: 9, d: 13, l: 12, gf: 40, ga: 48, gd: -8 }
    },
    { abbr: 'NFO', name: 'Nottm Forest', full: 'Nottingham Forest',
      color: '#DD0000', fg: '#ffffff', accent: '#FFFFFF',
      badge: 'shield',
      espnMatch: ['Nottingham Forest'],
      topScorer: { name: 'Wood', style: { hair: '#8A5A2B', skin: '#E8B085', facial: 'stubble', hairstyle: 'short' } },
      baseline: { rank: 16, pts: 36, gp: 33, w: 9, d: 9, l: 15, gf: 42, ga: 52, gd: -10 }
    },
    { abbr: 'WHU', name: 'West Ham', full: 'West Ham United',
      color: '#7A263A', fg: '#F3D459', accent: '#F3D459',
      badge: 'roundel',
      espnMatch: ['West Ham', 'West Ham United'],
      topScorer: { name: 'Bowen', style: { hair: '#8A5A2B', skin: '#F4CFA3', facial: 'stubble', hairstyle: 'short' } },
      baseline: { rank: 17, pts: 33, gp: 33, w: 8, d: 9, l: 16, gf: 38, ga: 54, gd: -16 }
    },
    { abbr: 'TOT', name: 'Tottenham', full: 'Tottenham Hotspur',
      color: '#132257', fg: '#ffffff', accent: '#FFFFFF',
      badge: 'cross',
      espnMatch: ['Tottenham', 'Tottenham Hotspur'],
      topScorer: { name: 'Solanke', style: { hair: '#0A0604', skin: '#5C3B22', facial: 'none', hairstyle: 'short' } },
      baseline: { rank: 18, pts: 31, gp: 33, w: 7, d: 10, l: 16, gf: 40, ga: 56, gd: -16 }
    },
    { abbr: 'BUR', name: 'Burnley', full: 'Burnley FC',
      color: '#6C1D45', fg: '#99D6EA', accent: '#99D6EA',
      badge: 'shield',
      espnMatch: ['Burnley', 'Burnley FC'],
      topScorer: { name: 'Foster', style: { hair: '#2A1810', skin: '#E8B085', facial: 'stubble', hairstyle: 'medium' } },
      baseline: { rank: 19, pts: 20, gp: 34, w: 4, d: 8, l: 22, gf: 30, ga: 64, gd: -34 }
    },
    { abbr: 'WOL', name: 'Wolves', full: 'Wolverhampton Wanderers',
      color: '#FDB913', fg: '#231F20', accent: '#231F20',
      badge: 'hoops',
      espnMatch: ['Wolves', 'Wolverhampton Wanderers'],
      topScorer: { name: 'Larsen', style: { hair: '#C89655', skin: '#F4CFA3', facial: 'none', hairstyle: 'medium' } },
      baseline: { rank: 20, pts: 17, gp: 33, w: 3, d: 8, l: 22, gf: 24, ga: 62, gd: -38 }
    },
  ],

  // Live data source (ESPN unofficial API — CORS-enabled, no key required)
  liveSource: {
    type: 'espn',
    url: 'https://site.web.api.espn.com/apis/v2/sports/soccer/eng.1/standings?season=2025',
    cacheMinutes: 5,
  },
};
