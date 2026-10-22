'use strict';

// Mapa muscular: un cos esquemàtic vist de davant i de darrere, amb cada grup muscular
// com a forma SVG. Les formes es defineixen per a la meitat dreta i es reflecteixen.

(function () {
  const NAMES = {
    pit: 'Pit',
    espatlles: 'Espatlles',
    deltposterior: 'Deltoide posterior',
    esquenaalta: 'Esquena alta',
    dorsals: 'Dorsals',
    lumbar: 'Lumbar',
    abdominals: 'Abdominals',
    oblics: 'Oblics',
    biceps: 'Bíceps',
    triceps: 'Tríceps',
    avantbracos: 'Avantbraços',
    glutis: 'Glutis',
    abductors: 'Abductors',
    adductors: 'Adductors',
    quadriceps: 'Quàdriceps',
    isquios: 'Isquiotibials',
    bessons: 'Bessons',
  };

  // Silueta (meitat dreta) i cap, iguals per a les dues vistes.
  const BODY_HALF = 'M60,34 L66,34 L67,42 C80,43 88,47 90,54 L86,72 C84,88 83,100 84,112 L82,120 L80,162 L78,198 L77,230 L63,230 L63,200 L61,165 L60,122 Z';
  const ARM_HALF = 'M89,54 C96,56 99,62 100,70 L105,100 L108,126 C107,131 102,132 100,129 L95,100 L87,74 C86,66 87,58 89,54 Z';

  // Músculs de la meitat dreta de cada vista. `c` = forma única al centre (no es reflecteix).
  const FRONT = [
    { m: 'pit', d: 'M61,44 C72,44 84,46 87,52 C86,60 80,66 72,66 C66,66 62,64 61,62 Z' },
    { m: 'espatlles', e: [92, 54, 8, 8] },
    { m: 'biceps', e: [95.5, 79, 4.5, 13, 8] },
    { m: 'avantbracos', e: [102, 109, 4, 15, 10] },
    { m: 'abdominals', c: true, r: [54, 68, 12, 36, 4] },
    { m: 'oblics', d: 'M67,68 L77,70 L78,100 C77,106 70,108 67,104 Z' },
    { m: 'quadriceps', e: [71, 150, 9, 30] },
    { m: 'adductors', e: [63.5, 138, 3.5, 16] },
  ];

  const BACK = [
    { m: 'esquenaalta', d: 'M61,40 L68,42 L84,48 L86,56 L72,76 L61,80 Z' },
    { m: 'deltposterior', e: [92, 54, 8, 8] },
    { m: 'dorsals', d: 'M70,62 L87,58 L85,76 L78,100 L67,100 L64,80 Z' },
    { m: 'lumbar', c: true, r: [54, 88, 12, 26, 4] },
    { m: 'triceps', e: [95.5, 79, 4.5, 13, 8] },
    { m: 'avantbracos', e: [102, 109, 4, 15, 10] },
    { m: 'glutis', e: [69, 124, 10, 12] },
    { m: 'abductors', e: [80, 114, 5, 7] },
    { m: 'isquios', e: [71, 160, 8, 26] },
    { m: 'bessons', e: [70, 206, 6.5, 17] },
  ];

  function shape(s, hl) {
    const cls = `mus${hl[s.m] ? ` ${hl[s.m]}` : ''}`;
    if (s.d) return `<path class="${cls}" d="${s.d}"/>`;
    if (s.r) return `<rect class="${cls}" x="${s.r[0]}" y="${s.r[1]}" width="${s.r[2]}" height="${s.r[3]}" rx="${s.r[4]}"/>`;
    const [cx, cy, rx, ry, rot] = s.e;
    return `<ellipse class="${cls}" cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"${rot ? ` transform="rotate(${rot} ${cx} ${cy})"` : ''}/>`;
  }

  function view(parts, hl) {
    const half = parts.filter((s) => !s.c).map((s) => shape(s, hl)).join('');
    const center = parts.filter((s) => s.c).map((s) => shape(s, hl)).join('');
    return `<circle class="mus-body" cx="60" cy="19" r="13"/>
      <path class="mus-body" d="${BODY_HALF}"/><path class="mus-body" d="${ARM_HALF}"/>
      <g transform="matrix(-1 0 0 1 120 0)"><path class="mus-body" d="${BODY_HALF}"/><path class="mus-body" d="${ARM_HALF}"/></g>
      ${half}<g transform="matrix(-1 0 0 1 120 0)">${half}</g>${center}`;
  }

  // hl: { pit: 'on', triceps: 'aux' }. labels: mostra «Davant» i «Darrere».
  function svg(hl = {}, { labels = false, cls = '' } = {}) {
    const h = labels ? 254 : 236;
    const lab = labels
      ? '<text class="mus-label" x="60" y="250" text-anchor="middle">Davant</text><text class="mus-label" x="180" y="250" text-anchor="middle">Darrere</text>'
      : '';
    return `<svg class="musmap ${cls}" viewBox="0 0 240 ${h}" role="img" aria-hidden="true">
      <g>${view(FRONT, hl)}</g><g transform="translate(120 0)">${view(BACK, hl)}</g>${lab}</svg>`;
  }

  window.MUSCLES = { names: NAMES, ids: Object.keys(NAMES), svg };
})();
