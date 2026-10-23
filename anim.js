'use strict';

// Animacions esquemàtiques de la tècnica.
//
// Cada postura dona l'angle de cada segment en graus (0 = cap a la dreta, 90 = avall,
// -90 = amunt). Un braç o una cama es pot definir amb angles ([braç, avantbraç]) o amb un
// punt on ha d'arribar la mà o el turmell (armNt, legNt...), útil quan el peu o la mà
// queden fixos a terra o a una nansa. Les escales (armNs...) escurcen un segment per
// simular que va cap a qui mira. El motor interpola entre postures.
//
// N = costat proper; F = costat llunyà (més clar). En vista frontal (`front`), N és el
// costat dret de la figura, F l'esquerre, i amb `sym` F és el mirall de N.

(function () {
  const L = { torso: 52, head: 16, upperArm: 21, foreArm: 19, thigh: 40, shin: 34, foot: 10 };
  const FAR_OFFSET = [6, -1];
  const FRONT_SHOULDER = 14;
  const FRONT_HIP = 9;
  const LIMBS = ['armN', 'armF', 'legN', 'legF'];

  // ---------- Peces comunes ----------

  const SEATED = {
    hip: [100, 100], torso: -92, head: -88,
    armN: [90, 90], armF: [90, 90], legN: [0, 90], legF: [0, 90],
  };

  // Seient i potes; amb respatller opcional (x de la part de dalt i de baix).
  const seat = (back) => `
    <rect class="a-prop" x="74" y="105" width="56" height="7" rx="3"/>
    <rect class="a-prop" x="99" y="112" width="6" height="25"/>
    ${back ? `<line class="a-prop-line" x1="${back[0]}" y1="102" x2="${back[1]}" y2="${back[2]}"/>` : ''}`;

  const BIRDDOG = {
    hip: [90, 80], torso: 0, head: 12,
    armN: [90, 90], armF: [90, 90], legN: [90, 180], legF: [90, 180],
  };

  const DEADBUG = {
    hip: [150, 111], torso: 180, head: 180,
    armN: [-90, -90], armF: [-90, -90], legN: [-90, 0], legF: [-90, 0],
  };

  const FRONT_SEATED = {
    hip: [120, 96], torso: -90, head: -90,
    armN: [80, 90], legN: [70, 92], legNs: [0.35, 1],
  };

  const frontSeat = `
    <rect class="a-prop" x="100" y="36" width="40" height="62" rx="5"/>
    <rect class="a-prop" x="88" y="99" width="64" height="7" rx="3"/>`;

  const PRESS_BACK = seat([92, 87, 44]);

  // Premsa de cames: postura del tronc i seient, compartits per la premsa i els bessons a la premsa.
  const PRESS_BASE = { hip: [95, 95], torso: -115, head: -108, armN: [70, 20], armF: [70, 20] };
  const PRESS_PROPS = `<rect class="a-prop" x="70" y="100" width="50" height="7" rx="3"/>
        <rect class="a-prop" x="92" y="107" width="6" height="30"/>
        <line class="a-prop-line" x1="88" y1="99" x2="66" y2="52"/>`;

  function twoLines(x, y, a, b) {
    return `<text class="a-label" x="${x}" y="${y}" text-anchor="end">${a}</text>
      <text class="a-label" x="${x}" y="${y + 12}" text-anchor="end">${b}</text>`;
  }

  // ---------- Exercicis ----------

  const DEFS = {
    // --- Terra ---
    birddog: {
      view: [0, 50, 240, 78], floor: 120, feet: false,
      guide: `<line class="a-guide" x1="88" y1="69" x2="144" y2="69"/>
        <text class="a-label" x="116" y="61" text-anchor="middle">Esquena plana</text>`,
      steps: [
        { pose: BIRDDOG, move: 0.8, hold: 0.8, say: 'Mans sota les espatlles i genolls sota els malucs.' },
        { pose: { ...BIRDDOG, armN: [-10, -10], legF: [180, 180] }, move: 1.4, hold: 2.2, say: 'Estira el braç i la cama contraris sense girar el maluc. Aguanta 5–8 s.' },
        { pose: BIRDDOG, move: 1.2, hold: 0.5, say: 'Torna a poc a poc.' },
        { pose: { ...BIRDDOG, armF: [-10, -10], legN: [180, 180] }, move: 1.4, hold: 2.2, say: "Ara l'altre costat. L'esquena no es mou." },
        { pose: BIRDDOG, move: 1.2, hold: 0.5, say: 'Torna a poc a poc.' },
      ],
    },

    deadbug: {
      view: [0, 62, 240, 78], floor: 120, feet: false,
      guide: `<line class="a-guide solid" x1="120" y1="122" x2="152" y2="122"/>
        <text class="a-label" x="136" y="135" text-anchor="middle">Lumbar a terra</text>`,
      steps: [
        { pose: DEADBUG, move: 0.8, hold: 0.8, say: 'Braços amunt i genolls a 90°. La lumbar enganxada a terra.' },
        { pose: { ...DEADBUG, armN: [-165, -165], legF: [-12, -8] }, move: 1.6, hold: 1.2, say: 'Baixa un braç i la cama contrària, lentament.' },
        { pose: DEADBUG, move: 1.4, hold: 0.5, say: "Torna sense que la lumbar s'aixequi." },
        { pose: { ...DEADBUG, armF: [-165, -165], legN: [-12, -8] }, move: 1.6, hold: 1.2, say: "Ara l'altre costat." },
        { pose: DEADBUG, move: 1.4, hold: 0.5, say: "Torna sense que la lumbar s'aixequi." },
      ],
    },

    curlup: {
      view: [30, 66, 200, 68], floor: 120,
      guide: `<text class="a-label" x="140" y="132" text-anchor="middle">Mans sota la lumbar</text>`,
      steps: [
        { pose: { hip: [140, 111], torso: 180, head: 180, armN: [12, 8], armF: [12, 8], legNt: [186, 116], legF: [0, 0] }, move: 0.8, hold: 1.0, say: 'Una cama doblegada, les mans sota la lumbar.' },
        { pose: { hip: [140, 111], torso: 187, head: 196, armN: [12, 8], armF: [12, 8], legNt: [186, 116], legF: [0, 0] }, move: 1.0, hold: 2.4, say: "Aixeca només el cap i les espatlles 2–3 cm. Aguanta 8 s." },
        { pose: { hip: [140, 111], torso: 180, head: 180, armN: [12, 8], armF: [12, 8], legNt: [186, 116], legF: [0, 0] }, move: 1.0, hold: 0.6, say: 'Baixa a poc a poc.' },
      ],
    },

    plank: {
      view: [10, 72, 200, 56], floor: 121,
      guide: `<line class="a-guide" x1="152" y1="88" x2="26" y2="109"/>
        <text class="a-label" x="100" y="86" text-anchor="middle">Cos en línia recta</text>`,
      steps: [
        { pose: { hip: [100, 110], torso: -14.6, head: -14.6, armN: [90, 0], armF: [90, 0], legN: [168.5, 180], legF: [168.5, 180] }, move: 0.8, hold: 0.8, say: 'Colzes sota les espatlles.' },
        { pose: { hip: [98.7, 105.6], torso: -9.5, head: -9.5, armN: [90, 0], armF: [90, 0], legN: [170.5, 170.5], legF: [170.5, 170.5] }, move: 1.2, hold: 3.5, say: 'Aixeca els genolls. Gluti i abdomen activats, sense deixar caure els malucs.' },
        { pose: { hip: [100, 110], torso: -14.6, head: -14.6, armN: [90, 0], armF: [90, 0], legN: [168.5, 180], legF: [168.5, 180] }, move: 1.2, hold: 0.6, say: 'Descansa i repeteix.' },
      ],
    },

    sideplank: {
      view: [10, 72, 200, 56], floor: 121,
      guide: `<line class="a-guide" x1="152" y1="88" x2="26" y2="109"/>
        <text class="a-label" x="100" y="86" text-anchor="middle">Malucs amunt, cos recte</text>`,
      steps: [
        { pose: { hip: [101, 114], torso: -19.1, head: -19.1, armN: [90, 0], armF: [115, 20], armFs: [0.8, 0.7], legN: [178, 178], legF: [178, 178] }, move: 0.8, hold: 0.8, say: 'De costat, colze sota l’espatlla.' },
        { pose: { hip: [98.7, 105.6], torso: -9.5, head: -9.5, armN: [90, 0], armF: [110, 15], armFs: [0.8, 0.7], legN: [170.5, 170.5], legF: [170.5, 170.5] }, move: 1.0, hold: 3.5, say: 'Aixeca els malucs i aguanta 20–30 s. Genolls flexionats si cal.' },
        { pose: { hip: [101, 114], torso: -19.1, head: -19.1, armN: [90, 0], armF: [115, 20], armFs: [0.8, 0.7], legN: [178, 178], legF: [178, 178] }, move: 1.0, hold: 0.6, say: "Baixa i després fes l'altre costat." },
      ],
    },

    hyper: {
      view: [20, 14, 220, 130], floor: 134,
      props: `<line class="a-prop-line" x1="122" y1="90" x2="72" y2="137"/>`,
      guide: `<line class="a-guide" x1="114" y1="76" x2="160" y2="30"/>
        <text class="a-label" x="24" y="30">Fins a línia recta</text>`,
      marks: [{ at: 'hip', r: 7, off: [7, 7] }, { at: 'ankleN', r: 5, off: [-5, -5] }],
      steps: [
        { pose: { hip: [112, 78], torso: 50, head: 50, armN: [215, 115], armF: [215, 115], armNs: [0.6, 0.6], armFs: [0.6, 0.6], legN: [135, 135], legF: [135, 135] }, move: 0.8, hold: 0.8, say: 'Malucs al coixí i braços creuats al pit.' },
        { pose: { hip: [112, 78], torso: -45, head: -45, armN: [120, 20], armF: [120, 20], armNs: [0.6, 0.6], armFs: [0.6, 0.6], legN: [135, 135], legF: [135, 135] }, move: 1.6, hold: 4, say: "Puja fins a línia recta i aguanta 20–30 s. El moviment surt del maluc; l'esquena no s'arrodoneix." },
        { pose: { hip: [112, 78], torso: 50, head: 50, armN: [215, 115], armF: [215, 115], armNs: [0.6, 0.6], armFs: [0.6, 0.6], legN: [135, 135], legF: [135, 135] }, move: 1.8, hold: 0.4, say: 'Baixa a poc a poc.' },
      ],
    },

    glutebridge: {
      view: [30, 60, 200, 68], floor: 120, feet: false,
      guide: `<line class="a-guide" x1="88" y1="104" x2="168" y2="104"/>
        <text class="a-label" x="128" y="98" text-anchor="middle">Genolls, malucs i espatlles en línia</text>`,
      steps: [
        { pose: { hip: [140, 111], torso: 180, head: 180, armN: [0, 0], armF: [0, 0], legNt: [184, 116], legFt: [184, 116] }, move: 0.8, hold: 0.8, say: 'Estirat, genolls doblegats i peus a terra a prop del cul.' },
        { pose: { hip: [140, 92], torso: 160, head: 182, armN: [0, 0], armF: [0, 0], legNt: [184, 116], legFt: [184, 116] }, move: 1.2, hold: 1.6, say: 'Apreta el gluti i puja els malucs fins a línia recta. No arquegis la lumbar.' },
        { pose: { hip: [140, 111], torso: 180, head: 180, armN: [0, 0], armF: [0, 0], legNt: [184, 116], legFt: [184, 116] }, move: 1.0, hold: 0.5, say: 'Baixa a poc a poc.' },
      ],
    },

    // --- Tronc: tirar ---
    latpull: {
      view: [20, 0, 200, 140], floor: 137,
      props: seat(null) + '<rect class="a-prop" x="126" y="88" width="22" height="6" rx="3"/>',
      cable: { from: [106, 0], to: 'handN' },
      marks: [{ at: 'handN', r: 4.5 }],
      steps: [
        { pose: { ...SEATED, armN: [-78, -85], armF: [-78, -85] }, move: 0.8, hold: 0.6, say: 'Agafada ampla, pit amunt.' },
        { pose: { ...SEATED, armN: [85, -75], armF: [85, -75] }, move: 1.2, hold: 0.5, say: 'Baixa la barra fins a la clavícula.' },
        { pose: { ...SEATED, armN: [-78, -85], armF: [-78, -85] }, move: 1.6, hold: 0.3, say: 'Torna controlant, sense tirar el tronc enrere.' },
      ],
    },

    facepull: {
      view: [20, 0, 200, 140], floor: 137,
      props: seat(null) + '<rect class="a-prop" x="126" y="88" width="22" height="6" rx="3"/>',
      cable: { from: [150, 0], to: 'handN' },
      marks: [{ at: 'handN', r: 4 }],
      steps: [
        { pose: { ...SEATED, armN: [-60, -60], armF: [-60, -60] }, move: 0.8, hold: 0.5, say: 'Corda a la politja alta, braços estirats.' },
        { pose: { ...SEATED, armN: [-150, -10], armF: [-150, -10], armNs: [0.6, 1], armFs: [0.6, 1] }, move: 1.2, hold: 0.6, say: 'Estira cap a la cara obrint els colzes.' },
        { pose: { ...SEATED, armN: [-60, -60], armF: [-60, -60] }, move: 1.6, hold: 0.3, say: 'Torna a poc a poc. Pes lleuger.' },
      ],
    },

    straightarm: {
      view: [20, -4, 200, 160], floor: 150,
      cable: { from: [190, -4], to: 'handN' },
      marks: [{ at: 'handN', r: 4 }],
      steps: [
        { pose: { hip: [100, 76], torso: -80, head: -80, armN: [-30, -30], armF: [-30, -30], legN: [92, 90], legF: [88, 90] }, move: 0.8, hold: 0.5, say: 'Dret, abdomen activat, braços gairebé rectes.' },
        { pose: { hip: [100, 76], torso: -80, head: -80, armN: [78, 80], armF: [78, 80], legN: [92, 90], legF: [88, 90] }, move: 1.4, hold: 0.5, say: 'Baixa la barra fins a les cuixes.' },
        { pose: { hip: [100, 76], torso: -80, head: -80, armN: [-30, -30], armF: [-30, -30], legN: [92, 90], legF: [88, 90] }, move: 1.6, hold: 0.3, say: 'Torna a poc a poc.' },
      ],
    },

    lowrow: rowDef('Pit enganxat al coixí, braços estirats.', 'Tira amb els colzes enrere i aguanta 1 s.', 'Torna estirant els braços.'),
    lowrowwide: rowDef('Pit al coixí, nanses amples.', 'Tira amb els colzes oberts.', 'Torna a poc a poc.'),
    psrow: rowDef('Pit recolzat, braços estirats.', 'Colzes a 45–60° del cos; junta les escàpules.', 'Torna a poc a poc.'),

    chin: {
      view: [40, 0, 160, 172], floor: 168,
      props: `<line class="a-prop-line" x1="160" y1="10" x2="160" y2="168"/>
        <line class="a-prop-line" x1="160" y1="22" x2="126" y2="22"/>`,
      marks: [{ at: 'handN', r: 4 }, { at: 'kneeN', type: 'bar', angle: 0, len: 30, off: [-8, 7] }],
      steps: [
        { pose: { hip: [118, 108], torso: -90, head: -90, armNt: [124, 22], armFt: [124, 22], legN: [100, 180], legF: [100, 180] }, move: 0.8, hold: 0.6, say: 'Genolls a la plataforma, agafada neutra.' },
        { pose: { hip: [118, 84], torso: -90, head: -90, armNt: [124, 22], armFt: [124, 22], legN: [100, 180], legF: [100, 180] }, move: 1.4, hold: 0.4, say: 'Puja fins que la barbeta passi les nanses.' },
        { pose: { hip: [118, 108], torso: -90, head: -90, armNt: [124, 22], armFt: [124, 22], legN: [100, 180], legF: [100, 180] }, move: 1.8, hold: 0.3, say: 'Baixa a poc a poc. Com menys assistència, més difícil.' },
      ],
    },

    // --- Tronc: empènyer ---
    chestpress: {
      view: [10, 10, 210, 130], floor: 137,
      props: PRESS_BACK,
      guide: twoLines(80, 40, 'Esquena', 'recolzada'),
      marks: [{ at: 'handN', r: 4 }],
      steps: [
        { pose: { ...SEATED, torso: -95, head: -92, armN: [145, 0], armF: [145, 0], armNs: [0.8, 1], armFs: [0.8, 1] }, move: 0.8, hold: 0.5, say: 'Esquena al respatller, nanses a l’alçada del pit.' },
        { pose: { ...SEATED, torso: -95, head: -92, armN: [5, 5], armF: [5, 5] }, move: 1.2, hold: 0.4, say: 'Empeny sense arquejar la lumbar.' },
        { pose: { ...SEATED, torso: -95, head: -92, armN: [145, 0], armF: [145, 0], armNs: [0.8, 1], armFs: [0.8, 1] }, move: 1.8, hold: 0.3, say: 'Torna a poc a poc.' },
      ],
    },

    incline: {
      view: [10, 10, 210, 130], floor: 137,
      props: seat([93, 71, 56]),
      guide: twoLines(66, 66, 'Esquena', 'recolzada'),
      marks: [{ at: 'handN', r: 4 }],
      steps: [
        { pose: { ...SEATED, torso: -115, head: -110, armN: [140, -30], armF: [140, -30], armNs: [0.8, 1], armFs: [0.8, 1] }, move: 0.8, hold: 0.5, say: 'Recolzat al respatller, nanses al pit.' },
        { pose: { ...SEATED, torso: -115, head: -110, armN: [-30, -30], armF: [-30, -30] }, move: 1.2, hold: 0.4, say: 'Empeny amunt i endavant.' },
        { pose: { ...SEATED, torso: -115, head: -110, armN: [140, -30], armF: [140, -30], armNs: [0.8, 1], armFs: [0.8, 1] }, move: 1.8, hold: 0.3, say: 'Torna a poc a poc.' },
      ],
    },

    shoulder: {
      view: [10, 0, 210, 140], floor: 137,
      props: seat([91, 90, 44]),
      guide: twoLines(82, 70, 'Esquena', 'recolzada'),
      marks: [{ at: 'handN', r: 4 }],
      steps: [
        { pose: { ...SEATED, armN: [75, -88], armF: [75, -88], armNs: [0.85, 1], armFs: [0.85, 1] }, move: 0.8, hold: 0.5, say: "Nanses a l'alçada de les espatlles." },
        { pose: { ...SEATED, armN: [-85, -88], armF: [-85, -88] }, move: 1.2, hold: 0.4, say: 'Empeny amunt amb tota l’esquena al respatller.' },
        { pose: { ...SEATED, armN: [75, -88], armF: [75, -88], armNs: [0.85, 1], armFs: [0.85, 1] }, move: 1.8, hold: 0.3, say: 'Baixa a poc a poc.' },
      ],
    },

    pecfly: flyDef(false, [
      'Braços oberts, colzes lleugerament flexionats.',
      'Tanca fins a ajuntar les mans i aguanta 1 s.',
      'Obre a poc a poc.',
    ]),
    reardelt: flyDef(true, [
      'De cara al respatller, braços endavant.',
      'Obre els braços gairebé estirats.',
      'Torna a poc a poc.',
    ]),

    lateral: {
      view: [40, 0, 160, 150], floor: 146, front: true, sym: true, feet: false,
      props: frontSeat,
      marks: [{ at: 'elbowN', r: 5, off: [5, 0], both: true }],
      steps: [
        { pose: { ...FRONT_SEATED, armN: [92, 90], armNs: [1, 0.25] }, move: 0.8, hold: 0.5, say: 'Colzes contra els coixins.' },
        { pose: { ...FRONT_SEATED, armN: [-2, 0], armNs: [1, 0.25] }, move: 1.2, hold: 0.5, say: "Puja fins a l'alçada de les espatlles." },
        { pose: { ...FRONT_SEATED, armN: [92, 90], armNs: [1, 0.25] }, move: 1.8, hold: 0.3, say: 'Baixa a poc a poc.' },
      ],
    },

    armcurl: armDef([40, -95], ['Braç recolzat al coixí.', 'Puja sense aixecar el colze.', 'Baixa a poc a poc.']),
    armext: armDef([-95, 30], ['Braç recolzat, colze doblegat.', 'Estira el braç del tot.', 'Torna a poc a poc.']),

    // --- Cames ---
    legpress: pressDef(['Peus a la plataforma, esquena al respatller.', 'Baixa fins on la lumbar segueix enganxada.', 'Empeny sense bloquejar els genolls.']),
    legpresshigh: pressDef(['Peus a la part alta de la plataforma.', 'Baixa fins on la lumbar segueix enganxada.', 'Empeny amb els talons.']),

    hipthrust: {
      view: [10, 40, 220, 104], floor: 138,
      props: `<rect class="a-prop" x="16" y="88" width="54" height="12" rx="4"/>
        <rect class="a-prop" x="38" y="100" width="6" height="38"/>`,
      marks: [{ at: 'hip', r: 7, off: [0, -9] }],
      steps: [
        { pose: { hip: [108, 112], torso: 214, head: 214, armNt: [100, 108], armFt: [100, 108], legNt: [152, 134], legFt: [152, 134] }, move: 0.8, hold: 0.6, say: "Part alta de l'esquena al coixí, peus a terra." },
        { pose: { hip: [116, 84], torso: 180, head: 195, armNt: [108, 80], armFt: [108, 80], legNt: [152, 134], legFt: [152, 134] }, move: 1.2, hold: 1.0, say: 'Puja fins que el tronc quedi recte; no arquegis la lumbar.' },
        { pose: { hip: [108, 112], torso: 214, head: 214, armNt: [100, 108], armFt: [100, 108], legNt: [152, 134], legFt: [152, 134] }, move: 1.6, hold: 0.3, say: 'Baixa controlant.' },
      ],
    },

    legcurl: {
      view: [40, 14, 180, 126], floor: 137,
      props: seat([91, 90, 44]) + '<rect class="a-prop" x="118" y="86" width="26" height="7" rx="3"/>',
      marks: [{ at: 'ankleN', r: 5, off: [-4, 4] }],
      steps: [
        { pose: { ...SEATED, legN: [0, 15], legF: [0, 15] }, move: 0.8, hold: 0.4, say: 'Cames estirades, coixí sobre els genolls.' },
        { pose: { ...SEATED, legN: [0, 100], legF: [0, 100] }, move: 1.0, hold: 0.3, say: 'Doblega els genolls.' },
        { pose: { ...SEATED, legN: [0, 15], legF: [0, 15] }, move: 3.0, hold: 0.4, say: 'Torna lentament, en 3 s.' },
      ],
    },

    legext: legExtDef(true, ['Esquena recolzada, coixí sobre els turmells.', 'Estira les cames i aguanta 1 s a dalt.', 'Baixa a poc a poc.']),
    legext1: legExtDef(false, ['Una sola cama.', 'Estira la cama i aguanta 1 s a dalt.', "Baixa a poc a poc i després l'altra cama."]),

    abductor: hipDef(true),
    adductor: hipDef(false),

    calf: {
      view: [50, 14, 160, 128], floor: 138,
      props: `<rect class="a-prop" x="74" y="105" width="56" height="7" rx="3"/>
        <rect class="a-prop" x="99" y="112" width="6" height="26"/>
        <rect class="a-prop" x="146" y="127" width="16" height="11" rx="2"/>`,
      marks: [{ at: 'kneeN', r: 6, off: [-6, -7] }],
      steps: [
        { pose: { ...SEATED, torso: -90, legNt: [140, 130], legFt: [140, 130], footN: -15, footF: -15 }, move: 0.8, hold: 0.4, say: 'Puntes dels peus a la plataforma, coixí sobre els genolls.' },
        { pose: { ...SEATED, torso: -90, legNt: [140, 121], legFt: [140, 121], footN: 28, footF: 28 }, move: 1.0, hold: 0.6, say: 'Puja els talons tant com puguis.' },
        { pose: { ...SEATED, torso: -90, legNt: [140, 130], legFt: [140, 130], footN: -15, footF: -15 }, move: 1.6, hold: 0.4, say: 'Baixa fins a estirar els bessons.' },
      ],
    },

    // Bessons a la premsa: cames estirades, les puntes a la vora de la plataforma i el taló es mou.
    calfpress: {
      view: [10, 20, 210, 120], floor: 137,
      props: PRESS_PROPS,
      // La plataforma va amb les puntes dels peus: en empènyer, s'allunya.
      marks: [{ at: 'toeN', type: 'bar', angle: 75, len: 36 }],
      steps: [
        { pose: { ...PRESS_BASE, legNt: [166, 76], legFt: [166, 76], footN: -110, footF: -110 }, move: 0.8, hold: 0.5, say: 'Cames estirades, només les puntes dels peus a la vora de la plataforma.' },
        { pose: { ...PRESS_BASE, legNt: [166, 76], legFt: [166, 76], footN: -60, footF: -60 }, move: 1.0, hold: 0.6, say: 'Empeny amb les puntes: la plataforma s’allunya.' },
        { pose: { ...PRESS_BASE, legNt: [166, 76], legFt: [166, 76], footN: -110, footF: -110 }, move: 1.6, hold: 0.4, say: 'Baixa els talons fins a notar l’estirament.' },
      ],
    },

    // Pallof press, vista de cara: la politja és al costat i estira cap a ell; el tronc no gira.
    pallof: {
      view: [20, -14, 200, 164], floor: 146, front: true, sym: true, feet: false,
      cable: { from: [218, 34], to: 'handN' },
      guide: `<line class="a-guide" x1="120" y1="-8" x2="120" y2="68"/>
        <text class="a-label" x="100" y="0" text-anchor="end">Sense girar</text>`,
      marks: [{ at: 'handN', r: 4.5 }],
      steps: [
        { pose: { hip: [120, 72], torso: -90, head: -90, legN: [84, 90], armN: [60, 185], armNs: [0.8, 1] }, move: 0.8, hold: 0.6, say: 'De costat a la politja, peus a l’amplada de les espatlles, mans al pit.' },
        { pose: { hip: [120, 72], torso: -90, head: -90, legN: [84, 90], armN: [120, 120], armNs: [0.55, 0.5] }, move: 1.2, hold: 1.6, say: 'Estira els braços endavant sense que el tronc giri. Aguanta 2 s.' },
        { pose: { hip: [120, 72], torso: -90, head: -90, legN: [84, 90], armN: [60, 185], armNs: [0.8, 1] }, move: 1.2, hold: 0.4, say: "Torna les mans al pit. Després, l'altre costat." },
      ],
    },

    prone: {
      view: [20, 40, 200, 80], floor: 118,
      props: `<rect class="a-prop" x="76" y="92" width="102" height="8" rx="3"/>
        <rect class="a-prop" x="96" y="100" width="6" height="18"/><rect class="a-prop" x="150" y="100" width="6" height="18"/>`,
      guide: '<line class="a-guide solid" x1="96" y1="90" x2="124" y2="90"/>',
      marks: [{ at: 'ankleN', r: 5, off: [0, -6] }, { at: 'handN', r: 3.5 }],
      steps: [
        { pose: { hip: [110, 86], torso: 0, head: 8, armN: [70, 20], armF: [70, 20], legN: [180, 180], legF: [180, 180] }, move: 0.8, hold: 0.5, say: 'Estirat de bocaterrosa, genolls just fora del banc.' },
        { pose: { hip: [110, 86], torso: 0, head: 8, armN: [70, 20], armF: [70, 20], legN: [180, -80], legF: [180, -80] }, move: 1.2, hold: 0.4, say: 'Doblega sense aixecar el maluc del banc.' },
        { pose: { hip: [110, 86], torso: 0, head: 8, armN: [70, 20], armF: [70, 20], legN: [180, 180], legF: [180, 180] }, move: 2.4, hold: 0.3, say: 'Baixa a poc a poc.' },
      ],
    },

    multihip: {
      view: [30, -14, 180, 164], floor: 144,
      props: `<line class="a-prop-line" x1="150" y1="40" x2="150" y2="144"/>
        <line class="a-prop-line" x1="150" y1="50" x2="134" y2="50"/>`,
      guide: `<line class="a-guide" x1="102" y1="66" x2="104" y2="8"/>
        <text class="a-label" x="96" y="38" text-anchor="end">Tronc recte</text>`,
      marks: [{ at: 'kneeN', r: 6, off: [-5, 3] }, { at: 'handN', r: 3.5 }],
      steps: [
        { pose: { hip: [110, 70], torso: -88, head: -88, armNt: [132, 50], armFt: [132, 50], legN: [92, 90], legF: [90, 90] }, move: 0.8, hold: 0.4, say: 'Dret, agafat a les nanses.' },
        { pose: { hip: [110, 70], torso: -88, head: -88, armNt: [132, 50], armFt: [132, 50], legN: [135, 115], legF: [90, 90] }, move: 1.2, hold: 0.6, say: "Porta la cama enrere sense arquejar l'esquena." },
        { pose: { hip: [110, 70], torso: -88, head: -88, armNt: [132, 50], armFt: [132, 50], legN: [92, 90], legF: [90, 90] }, move: 1.6, hold: 0.3, say: 'Torna a poc a poc. Després, l’altra cama.' },
      ],
    },
  };

  // ---------- Generadors per a exercicis semblants ----------

  function rowDef(start, pull, back) {
    const base = { ...SEATED, torso: -88, head: -88 };
    return {
      view: [20, 10, 200, 130], floor: 137,
      props: seat(null) + `<rect class="a-prop" x="110" y="58" width="8" height="38" rx="3"/>
        <rect class="a-prop" x="112" y="96" width="4" height="41"/>`,
      marks: [{ at: 'handN', r: 4 }],
      steps: [
        { pose: { ...base, armN: [6, 3], armF: [6, 3] }, move: 0.8, hold: 0.5, say: start },
        { pose: { ...base, armN: [170, 5], armF: [170, 5] }, move: 1.2, hold: 1.0, say: pull },
        { pose: { ...base, armN: [6, 3], armF: [6, 3] }, move: 1.6, hold: 0.3, say: back },
      ],
    };
  }

  // Contractora (tanca) i deltoide posterior (obre). Escala negativa = el braç va cap endavant.
  function flyDef(reverse, says) {
    const open = { ...FRONT_SEATED, armN: [0, reverse ? 0 : -12], armNs: [1, 1] };
    const closed = { ...FRONT_SEATED, armN: [0, 0], armNs: [-0.45, -0.3] };
    const [a, b] = reverse ? [closed, open] : [open, closed];
    return {
      view: [20, 0, 200, 150], floor: 146, front: true, sym: true, feet: false,
      props: frontSeat,
      marks: [{ at: 'handN', r: 4, both: true }],
      steps: [
        { pose: a, move: 0.8, hold: 0.5, say: says[0] },
        { pose: b, move: 1.2, hold: 0.8, say: says[1] },
        { pose: a, move: 1.8, hold: 0.3, say: says[2] },
      ],
    };
  }

  function armDef([from, to], says) {
    const base = { ...SEATED, torso: -80, head: -80 };
    return {
      view: [30, 10, 190, 130], floor: 137,
      props: seat(null) + '<line class="a-prop-line" x1="104" y1="57" x2="131" y2="76"/>',
      marks: [{ at: 'handN', r: 4 }],
      steps: [
        { pose: { ...base, armN: [35, from], armF: [35, from] }, move: 0.8, hold: 0.4, say: says[0] },
        { pose: { ...base, armN: [35, to], armF: [35, to] }, move: 1.2, hold: 0.4, say: says[1] },
        { pose: { ...base, armN: [35, from], armF: [35, from] }, move: 1.8, hold: 0.3, say: says[2] },
      ],
    };
  }

  function pressDef(says) {
    const base = PRESS_BASE;
    return {
      view: [10, 20, 210, 120], floor: 137,
      props: PRESS_PROPS,
      guide: `<line class="a-guide solid" x1="81" y1="96" x2="74" y2="80"/>
        ${twoLines(68, 96, 'Lumbar', 'enganxada')}`,
      marks: [{ at: 'ankleN', type: 'bar', angle: 75, len: 36, off: [5, -1] }],
      steps: [
        { pose: { ...base, legNt: [158, 78], legFt: [158, 78] }, move: 0.8, hold: 0.5, say: says[0] },
        { pose: { ...base, legNt: [130, 86], legFt: [130, 86] }, move: 1.8, hold: 0.3, say: says[1] },
        { pose: { ...base, legNt: [158, 78], legFt: [158, 78] }, move: 1.2, hold: 0.4, say: says[2] },
      ],
    };
  }

  function legExtDef(both, says) {
    const down = { ...SEATED, legN: [0, 95], legF: [0, 95] };
    const up = { ...SEATED, legN: [0, 0], legF: both ? [0, 0] : [0, 95] };
    return {
      view: [40, 14, 180, 126], floor: 137,
      props: seat([91, 90, 44]),
      marks: [{ at: 'ankleN', r: 5, off: [4, 0] }],
      steps: [
        { pose: down, move: 0.8, hold: 0.4, say: says[0] },
        { pose: up, move: 1.2, hold: 1.0, say: says[1] },
        { pose: down, move: 1.8, hold: 0.3, say: says[2] },
      ],
    };
  }

  // Abductors (obre) i adductors (tanca), vista de cara.
  function hipDef(open) {
    const closed = { ...FRONT_SEATED, legN: [70, 92], legNs: [0.35, 1] };
    const apart = { ...FRONT_SEATED, legN: [30, 96], legNs: [0.6, 1] };
    const [a, b] = open ? [closed, apart] : [apart, closed];
    return {
      view: [40, 0, 160, 150], floor: 146, front: true, sym: true, feet: false,
      props: frontSeat,
      marks: [{ at: 'kneeN', r: 5, off: [open ? 6 : -6, 0], both: true }],
      steps: [
        { pose: a, move: 0.8, hold: 0.5, say: 'Esquena recolzada al respatller.' },
        { pose: b, move: 1.2, hold: 0.6, say: open ? 'Obre les cames.' : 'Tanca les cames.' },
        { pose: a, move: 1.8, hold: 0.3, say: 'Torna controlant.' },
      ],
    };
  }

  // ---------- Cinemàtica ----------

  const rad = (d) => (d * Math.PI) / 180;
  const deg = (r) => (r * 180) / Math.PI;
  const at = (o, a, l) => [o[0] + l * Math.cos(rad(a)), o[1] + l * Math.sin(rad(a))];
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

  // Omple els valors que falten perquè totes les postures tinguin les mateixes claus.
  function normalize(p) {
    const o = { ...p };
    for (const limb of LIMBS) {
      if (!o[`${limb}s`]) o[`${limb}s`] = [1, 1];
    }
    if (o.footN === undefined) o.footN = null;
    if (o.footF === undefined) o.footF = null;
    return o;
  }

  function mix(p, q, t) {
    const o = {};
    for (const k of Object.keys(p)) {
      const a = p[k], b = q[k];
      if (a === null || b === null || b === undefined) o[k] = a;
      else if (Array.isArray(a)) o[k] = a.map((v, i) => lerp(v, b[i], t));
      else o[k] = lerp(a, b, t);
    }
    return o;
  }

  // Dues barres (braç o cama) que han d'arribar a un punt. `bend` tria cap on es doblega.
  function reach(root, target, l1, l2, bend) {
    const dx = target[0] - root[0], dy = target[1] - root[1];
    const d = Math.min(Math.max(Math.hypot(dx, dy), Math.abs(l1 - l2) + 0.01), l1 + l2 - 0.01);
    const base = deg(Math.atan2(dy, dx));
    const a = deg(Math.acos((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)));
    const upper = base + bend * a;
    const mid = at(root, upper, l1);
    return [upper, deg(Math.atan2(target[1] - mid[1], target[0] - mid[0]))];
  }

  function mirror(p, cx) {
    const o = { ...p };
    o.armF = p.armN && [180 - p.armN[0], 180 - p.armN[1]];
    o.legF = p.legN && [180 - p.legN[0], 180 - p.legN[1]];
    o.armFt = p.armNt && [2 * cx - p.armNt[0], p.armNt[1]];
    o.legFt = p.legNt && [2 * cx - p.legNt[0], p.legNt[1]];
    o.armFs = p.armNs;
    o.legFs = p.legNs;
    o.footF = p.footN;
    return o;
  }

  function skeleton(def, pose) {
    const p = def.sym ? mirror(pose, pose.hip[0]) : pose;
    const hip = p.hip;
    const sh = at(hip, p.torso, L.torso);
    const head = at(sh, p.head, L.head);

    const side = (point, sign, w) => (def.front ? [point[0] + sign * w, point[1]] : point);
    const shN = side(sh, 1, FRONT_SHOULDER), shF = side(sh, -1, FRONT_SHOULDER);
    const hipN = side(hip, 1, FRONT_HIP), hipF = side(hip, -1, FRONT_HIP);
    const farShift = (pts) => (def.front ? pts : pts.map(([x, y]) => [x + FAR_OFFSET[0], y + FAR_OFFSET[1]]));

    const limb = (name, root, l1, l2, bend) => {
      const sc = p[`${name}s`];
      const target = p[`${name}t`];
      const angles = target ? reach(root, target, l1 * sc[0], l2 * sc[1], bend) : p[name];
      const mid = at(root, angles[0], l1 * sc[0]);
      return { pts: [root, mid, at(mid, angles[1], l2 * sc[1])], lower: angles[1] };
    };

    const armN = limb('armN', shN, L.upperArm, L.foreArm, 1);
    const armF = limb('armF', shF, L.upperArm, L.foreArm, def.sym ? -1 : 1);
    const legN = limb('legN', hipN, L.thigh, L.shin, -1);
    const legF = limb('legF', hipF, L.thigh, L.shin, def.sym ? 1 : -1);

    const foot = (leg, angle) => {
      const ankle = leg.pts[2];
      return [ankle, at(ankle, angle ?? leg.lower - 90, L.foot)];
    };
    const feet = def.feet !== false;

    const sk = {
      torso: [hip, sh],
      yoke: def.front ? [shF, shN] : [],
      pelvis: def.front ? [hipF, hipN] : [],
      head,
      armN: armN.pts, armF: farShift(armF.pts),
      legN: feet ? [...legN.pts, foot(legN, p.footN)[1]] : legN.pts,
      legF: farShift(feet ? [...legF.pts, foot(legF, p.footF)[1]] : legF.pts),
    };
    sk.joints = {
      hip, sh, head,
      elbowN: sk.armN[1], handN: sk.armN[2], kneeN: sk.legN[1], ankleN: sk.legN[2], toeN: sk.legN[3] || sk.legN[2],
      elbowF: sk.armF[1], handF: sk.armF[2], kneeF: sk.legF[1], ankleF: sk.legF[2], toeF: sk.legF[3] || sk.legF[2],
    };
    return sk;
  }

  function prepare(def) {
    def.steps.forEach((s) => { s.pose = normalize(s.pose); });
    def.total = def.steps.reduce((sum, s) => sum + s.move + s.hold, 0);
    // En els exercicis simètrics, cada marca del costat N es repeteix al costat F.
    def.marks = (def.marks || []).flatMap((m) => (m.both
      ? [m, { ...m, at: m.at.replace(/N$/, 'F'), off: m.off && [-m.off[0], m.off[1]], angle: m.angle !== undefined ? 180 - m.angle : undefined }]
      : [m]));
  }

  Object.values(DEFS).forEach(prepare);

  // ---------- Segona vista ----------
  // Vista de davant per als exercicis on ajuda a entendre el moviment (amplada de
  // l'agafada, colzes oberts o tancats...). La vista principal continua sent la de costat.

  const FS = FRONT_SEATED; // espatlles a y = 44
  const FRONT_VIEW = { view: [20, -14, 200, 164], floor: 146, front: true, sym: true, feet: false, props: frontSeat };
  const HANDS = [{ at: 'handN', r: 4, both: true }];

  // Rem vist des de darrere: braços endavant (escurçats) i després els colzes a l'angle indicat.
  function rowFront(end, s1, s2, s3) {
    return {
      ...FRONT_VIEW, marks: HANDS,
      steps: [
        { pose: { ...FS, armNt: [130, 46], armNs: [0.4, 0.4] }, move: 0.8, hold: 0.5, say: s1 },
        { pose: { ...FS, armN: end, armNs: [1, 1] }, move: 1.2, hold: 0.8, say: s2 },
        { pose: { ...FS, armNt: [130, 46], armNs: [0.4, 0.4] }, move: 1.6, hold: 0.3, say: s3 },
      ],
    };
  }

  // Empènyer vist de davant: les mans van cap a qui mira (es veuen escurçades).
  function pushFront(start, end, endScale, says) {
    return {
      ...FRONT_VIEW, marks: HANDS,
      steps: [
        { pose: { ...FS, armN: start, armNs: [1, 1] }, move: 0.8, hold: 0.5, say: says[0] },
        { pose: { ...FS, armN: end, armNs: endScale }, move: 1.2, hold: 0.5, say: says[1] },
        { pose: { ...FS, armN: start, armNs: [1, 1] }, move: 1.6, hold: 0.3, say: says[2] },
      ],
    };
  }

  const FRONT_VIEWS = {
    latpull: {
      ...FRONT_VIEW, cable: { from: [120, -14], to: 'linkMid' }, link: ['handN', 'handF'], marks: HANDS,
      steps: [
        { pose: { ...FS, armNt: [156, 12], armNs: [1, 1] }, move: 0.8, hold: 0.5, say: 'Agafada ampla, braços estirats.' },
        { pose: { ...FS, armNt: [154, 46], armNs: [1, 1] }, move: 1.2, hold: 0.5, say: 'Baixa la barra fins a la clavícula, amb els colzes avall i enfora.' },
        { pose: { ...FS, armNt: [156, 12], armNs: [1, 1] }, move: 1.6, hold: 0.3, say: 'Torna controlant.' },
      ],
    },
    facepull: {
      ...FRONT_VIEW, cable: { from: [120, -14], to: 'linkMid' }, link: ['handN', 'handF'], marks: HANDS,
      steps: [
        { pose: { ...FS, armNt: [126, 30], armNs: [0.45, 0.45] }, move: 0.8, hold: 0.5, say: 'Corda a la politja alta, braços estirats endavant.' },
        { pose: { ...FS, armN: [0, 200], armNs: [1, 1] }, move: 1.2, hold: 0.6, say: 'Estira cap a la cara obrint els colzes; les mans, a l’alçada de les orelles.' },
        { pose: { ...FS, armNt: [126, 30], armNs: [0.45, 0.45] }, move: 1.6, hold: 0.3, say: 'Torna a poc a poc.' },
      ],
    },
    lowrow: rowFront([75, -100], 'Pit al coixí, braços estirats endavant.', 'Tira amb els colzes enganxats al cos.', 'Torna estirant els braços.'),
    lowrowwide: rowFront([5, 190], 'Nanses amples, braços estirats.', 'Tira amb els colzes oberts, a l’alçada de les espatlles.', 'Torna a poc a poc.'),
    psrow: rowFront([25, 200], 'Pit recolzat, braços estirats.', 'Colzes a 45–60° del cos; junta les escàpules al final.', 'Torna a poc a poc.'),
    chin: {
      view: [20, -12, 200, 190], front: true, sym: true, feet: false,
      props: '<line class="a-prop-line" x1="92" y1="2" x2="148" y2="2"/>',
      marks: HANDS,
      steps: [
        { pose: { hip: [120, 100], torso: -90, head: -90, legN: [88, 90], legNs: [1, 0.3], armNt: [136, 4], armNs: [1, 1] }, move: 0.8, hold: 0.6, say: 'Agafada neutra a l’amplada de les espatlles, genolls a la plataforma.' },
        { pose: { hip: [120, 78], torso: -90, head: -90, legN: [88, 90], legNs: [1, 0.3], armNt: [136, 4], armNs: [1, 1] }, move: 1.4, hold: 0.4, say: 'Puja fins que la barbeta passi les nanses, colzes cap avall.' },
        { pose: { hip: [120, 100], torso: -90, head: -90, legN: [88, 90], legNs: [1, 0.3], armNt: [136, 4], armNs: [1, 1] }, move: 1.8, hold: 0.3, say: 'Baixa a poc a poc.' },
      ],
    },
    shoulder: pushFront([0, -90], [-80, -88], [1, 1], ['Nanses a l’alçada de les espatlles, colzes sota les mans.', 'Empeny amunt fins a estirar els braços.', 'Baixa a poc a poc.']),
    chestpress: pushFront([5, 190], [15, 15], [0.5, 0.4], ['Colzes oberts, nanses a l’alçada del pit.', 'Empeny endavant fins a estirar els braços.', 'Torna a poc a poc.']),
    incline: pushFront([10, 195], [-55, -55], [0.6, 0.5], ['Nanses a l’alçada del pit alt.', 'Empeny amunt i endavant.', 'Torna a poc a poc.']),
    armcurl: pushFront([85, 85], [85, -95], [1, 1], ['Braços estirats, colzes al coixí.', 'Puja les mans sense moure els colzes.', 'Baixa a poc a poc.']),
    armext: pushFront([85, 20], [85, 85], [1, 1], ['Colzes al coixí, mans endavant.', 'Estira els braços del tot cap avall.', 'Torna a poc a poc.']),
  };
  FRONT_VIEWS.armext.steps[0].pose.armNs = [1, 0.4];
  FRONT_VIEWS.armext.steps[2].pose.armNs = [1, 0.4];

  Object.values(FRONT_VIEWS).forEach(prepare);

  const viewName = (def) => (def.front ? 'De davant' : 'De costat');
  const altOf = (id) => FRONT_VIEWS[id] || null;
  // Definició que toca segons la vista triada a la figura.
  const defFor = (fig) => (fig.dataset.view === 'alt' && altOf(fig.dataset.anim)) || DEFS[fig.dataset.anim];

  function poseAt(def, time) {
    const steps = def.steps;
    let t = time % def.total;
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      if (t < s.move + s.hold) {
        const prev = steps[(i - 1 + steps.length) % steps.length].pose;
        return { pose: t < s.move ? mix(prev, s.pose, ease(t / s.move)) : s.pose, step: i };
      }
      t -= s.move + s.hold;
    }
    return { pose: steps[0].pose, step: 0 };
  }

  // Moment en què acaba el moviment cap a la postura clau (el pas 1).
  const keyTime = (def) => def.steps[0].move + def.steps[0].hold + def.steps[1].move;

  // ---------- Dibuix ----------

  const fmt = (pts) => pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

  function markSvg(m, i) {
    return m.type === 'bar'
      ? `<line class="a-mark-bar" data-m="${i}"/>`
      : `<circle class="a-mark" data-m="${i}" r="${m.r || 4}"/>`;
  }

  function draw(fig, def, pose) {
    const sk = skeleton(def, pose);
    for (const part of ['armN', 'armF', 'legN', 'legF', 'torso', 'yoke', 'pelvis']) {
      fig.querySelector(`[data-p="${part}"]`).setAttribute('points', fmt(sk[part]));
    }
    const head = fig.querySelector('.a-head');
    head.setAttribute('cx', sk.head[0].toFixed(1));
    head.setAttribute('cy', sk.head[1].toFixed(1));

    def.marks.forEach((m, i) => {
      const j = sk.joints[m.at];
      const c = [j[0] + (m.off?.[0] || 0), j[1] + (m.off?.[1] || 0)];
      const el = fig.querySelector(`[data-m="${i}"]`);
      if (m.type === 'bar') {
        const a = at(c, m.angle, m.len / 2), b = at(c, m.angle + 180, m.len / 2);
        el.setAttribute('x1', a[0].toFixed(1)); el.setAttribute('y1', a[1].toFixed(1));
        el.setAttribute('x2', b[0].toFixed(1)); el.setAttribute('y2', b[1].toFixed(1));
      } else {
        el.setAttribute('cx', c[0].toFixed(1));
        el.setAttribute('cy', c[1].toFixed(1));
      }
    });

    if (def.link) {
      const a = sk.joints[def.link[0]], b = sk.joints[def.link[1]];
      const line = fig.querySelector('.a-link');
      line.setAttribute('x1', a[0].toFixed(1)); line.setAttribute('y1', a[1].toFixed(1));
      line.setAttribute('x2', b[0].toFixed(1)); line.setAttribute('y2', b[1].toFixed(1));
      sk.joints.linkMid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    }

    if (def.cable) {
      const to = sk.joints[def.cable.to];
      const line = fig.querySelector('.a-cable');
      line.setAttribute('x2', to[0].toFixed(1));
      line.setAttribute('y2', to[1].toFixed(1));
    }
  }

  const running = new Map();
  const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function mount(fig) {
    const def = defFor(fig);
    if (!def || fig.dataset.ready) return;
    fig.dataset.ready = '1';
    const [vx, , vw] = def.view;
    const alt = altOf(fig.dataset.anim);
    const other = alt ? viewName(fig.dataset.view === 'alt' ? DEFS[fig.dataset.anim] : alt) : '';
    fig.innerHTML = `
      <svg viewBox="${def.view.join(' ')}" class="${def.front ? 'front' : ''}" role="img" aria-label="Animació de l'exercici">
        ${def.floor !== undefined ? `<rect class="a-mat" x="${vx + 6}" y="${def.floor}" width="${vw - 12}" height="4" rx="2"/>` : ''}
        ${def.props || ''}
        ${def.guide || ''}
        ${def.cable ? `<line class="a-cable" x1="${def.cable.from[0]}" y1="${def.cable.from[1]}" x2="${def.cable.from[0]}" y2="${def.cable.from[1]}"/>` : ''}
        <polyline class="a-limb a-far" data-p="armF"/>
        <polyline class="a-limb a-far" data-p="legF"/>
        <polyline class="a-torso" data-p="torso"/>
        <polyline class="a-limb" data-p="pelvis"/>
        <polyline class="a-limb" data-p="yoke"/>
        <circle class="a-head" r="9"/>
        <polyline class="a-limb" data-p="legN"/>
        <polyline class="a-limb" data-p="armN"/>
        ${def.link ? '<line class="a-link"/>' : ''}
        ${def.marks.map(markSvg).join('')}
      </svg>
      <figcaption>
        <span class="a-say"></span>
        <span class="a-btns">
          ${alt ? `<button type="button" class="a-view" data-act="anim-view" aria-label="Canvia la vista">${other}</button>` : ''}
          <button type="button" class="a-toggle" data-act="anim-toggle"></button>
        </span>
      </figcaption>`;
    fig.dataset.time = '0';
    show(fig, 0);
  }

  function show(fig, time) {
    const def = defFor(fig);
    const { pose, step } = poseAt(def, time);
    draw(fig, def, pose);
    const say = fig.querySelector('.a-say');
    if (say.dataset.step !== String(step)) {
      say.dataset.step = String(step);
      say.textContent = def.steps[step].say;
    }
  }

  function setButton(fig, playing) {
    const btn = fig.querySelector('.a-toggle');
    btn.textContent = playing ? 'Pausa' : 'Reprodueix';
    btn.setAttribute('aria-pressed', String(playing));
  }

  function play(fig) {
    mount(fig);
    if (running.has(fig)) return;
    let last = performance.now();
    const tick = (now) => {
      if (!fig.isConnected || !running.has(fig)) { running.delete(fig); return; }
      const time = Number(fig.dataset.time) + (now - last) / 1000;
      last = now;
      fig.dataset.time = String(time);
      show(fig, time);
      running.set(fig, requestAnimationFrame(tick));
    };
    running.set(fig, requestAnimationFrame(tick));
    setButton(fig, true);
  }

  function stop(fig) {
    const id = running.get(fig);
    if (id) cancelAnimationFrame(id);
    running.delete(fig);
    if (fig.dataset.ready) setButton(fig, false);
  }

  window.ANIM = {
    ids: Object.keys(DEFS),
    has: (id) => !!DEFS[id],
    // En obrir «Com fer-ho». Amb moviment reduït, es queda aturada a la postura clau.
    open(fig) {
      mount(fig);
      if (reduceMotion()) {
        fig.dataset.time = String(keyTime(defFor(fig)));
        show(fig, Number(fig.dataset.time));
        setButton(fig, false);
      } else {
        play(fig);
      }
    },
    close: stop,
    toggle(fig) { if (running.has(fig)) stop(fig); else play(fig); },
    hasAlt: (id) => !!altOf(id),
    // Canvia entre la vista de costat i la de davant, mantenint l'estat de reproducció.
    flip(fig) {
      const wasRunning = running.has(fig);
      stop(fig);
      fig.dataset.view = fig.dataset.view === 'alt' ? '' : 'alt';
      delete fig.dataset.ready;
      mount(fig);
      if (wasRunning) play(fig); else this.still(fig);
    },
    // Mostra la postura clau sense animar (per a proves).
    still(fig, at) {
      stop(fig);
      mount(fig);
      const def = defFor(fig);
      fig.dataset.time = String(at === undefined ? keyTime(def) : at);
      show(fig, Number(fig.dataset.time));
      setButton(fig, false);
    },
  };
})();
