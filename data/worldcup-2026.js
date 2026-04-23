/* ================================================================
   COMPETITION CONFIG — FIFA WORLD CUP 2026 (TEMPLATE)
   ================================================================
   To activate: in index.html, change
       <script src="data/epl-2025-26.js"></script>
   to
       <script src="data/worldcup-2026.js"></script>

   Fill in the teams list with the 48 qualified nations, set the
   predictions to whatever tiered structure you want (knockout brackets,
   group winners, etc.), and you're live.

   For knockout competitions, a sensible predictions model would be:
     - topN: 4   (semi-finalists, ordered: 1st/2nd/3rd/4th)
     - botN: 0   (no "bottom" in a knockout)
     - Tiebreakers: golden boot, golden ball, golden glove, biggest
       upset, most goals in a match, etc.
   ================================================================ */

window.COMPETITION = {
  key: 'worldcup-2026',
  shortName: 'World Cup',
  longName: 'FIFA World Cup 2026',
  tagline: 'Predict the semi-finalists and Golden Boot winner',
  totalGames: 7,
  baselineDate: '11 June 2026',
  seasonEndDate: '19 July 2026',

  topN: 4,
  botN: 0,

  topLabel: 'FINAL FOUR',
  topSubLabel: 'SEMI-FINALISTS',
  botLabel: '',
  botSubLabel: '',

  scoring: {
    exact: 6,
    correctGroup: 3,
  },

  tiebreakers: [
    {
      id: 'champion',
      label: 'WORLD CHAMPIONS',
      subLabel: 'Who lifts the trophy?',
      points: 10,
      source: 'manual',
      candidates: [],
    },
    {
      id: 'goldenBoot',
      label: 'GOLDEN BOOT',
      subLabel: 'Top scorer',
      points: 8,
      source: 'manual',
      candidatePlayers: [],
    },
  ],

  // TODO: Populate with 48 qualified nations once the draw is settled.
  teams: [
    // { abbr: 'ARG', name: 'Argentina', full: 'Argentina',
    //   color: '#75AADB', fg: '#ffffff', accent: '#FFD700',
    //   badge: 'stripes-v',
    //   espnMatch: ['Argentina'],
    //   topScorer: {
    //     name: 'Messi',
    //     style: { hair: '#3A2515', skin: '#E8B085', facial: 'beard', hairstyle: 'medium' }
    //   },
    //   baseline: { rank: 1, pts: 0, gp: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0 }
    // },
    // ... repeat for all 48 nations
  ],

  liveSource: {
    type: 'espn',
    url: 'https://site.web.api.espn.com/apis/v2/sports/soccer/fifa.world/standings',
    cacheMinutes: 5,
  },
};
