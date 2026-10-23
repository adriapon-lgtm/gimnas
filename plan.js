// Pla d'entrenament. Per canviar el pla, edita aquest fitxer.
// Les dades de l'usuari es guarden per clau d'exercici (`key`), així que
// canviar sèries, notes o l'ordre no trenca l'historial.
//
// weight: true = camp de pes, false = sense pes, 'assist' = pes d'assistència.
// rest: descans en segons després de cada sèrie (si no n'hi ha, l'app posa 2 min
//       al primer exercici, 75 s a la resta i 45 s als de terra).
// pair: dos exercicis seguits amb la mateixa lletra són una supersèrie: fas una
//       sèrie del primer, descanses poc (el rest del primer), fas una sèrie del
//       segon, descanses (el rest del segon) i tornes al primer. Cada múscul
//       descansa igual que abans, però la sessió dura menys.
//
// kind: 'upper' o 'lower'; tria el pas extra de l'escalfament (warmup.extra).
// slow: aïllament petit; només suggereix pujar pes si arribes al màxim dues sessions seguides.
// compound: exercici compost; a la sessió de compensació van primer.
//
// Cada dia està pensat per durar com a màxim 80 min (escalfament + força + cardio).

window.PLAN = {
  warmup: {
    time: '8 min',
    // anim: animació que es pot desplegar des de la llista (clau d'anim.js).
    items: [
      { text: '4 min de bicicleta suau' },
      { text: 'Curl-up 1 × 5 (aguanta 8 s)', anim: 'curlup' },
      { text: 'Planxa lateral 1 × 15 s per costat', anim: 'sideplank' },
      { text: 'Bird dog 1 × 5 per costat', anim: 'birddog' },
      { text: '1 sèrie lleugera del primer exercici' },
    ],
    // Pas extra segons el dia, abans de la sèrie lleugera.
    extra: {
      upper: { text: 'Rotacions d’espatlla amb goma 1 × 10' },
      lower: { text: 'Pont de glutis 1 × 10', anim: 'glutebridge' },
    },
  },
  days: [
    {
      id: 'd1',
      kind: 'upper',
      short: 'Tronc A',
      title: 'Tronc superior A',
      focus: 'Dorsals i pit',
      cardio: '20 min de bicicleta o el·líptica en zona 2',
      exercises: [
        { key: 'latpull', compound: true, name: 'Jaló al pit, agafada ampla', machine: 'Jaló al pit (politja alta)', photo: 'lat', sets: 4, reps: '8–10', weight: true, rest: 90, note: 'Pit amunt, baixa la barra fins a la clavícula sense tirar el tronc enrere.' },
        { key: 'chestpress', compound: true, name: 'Press de pit', machine: 'Press de pit', photo: 'chestpress', sets: 3, reps: '8–10', weight: true, rest: 30, pair: 'A', note: 'Esquena recolzada al respatller, sense arquejar la lumbar.' },
        { key: 'lowrow', compound: true, name: 'Rem sentat amb pit recolzat', machine: 'Rem sentat en màquina', photo: 'lowrow', sets: 3, reps: '8–10', weight: true, rest: 75, pair: 'A', note: 'Pit enganxat al coixí tota la sèrie; aguanta 1 s a dalt.' },
        { key: 'shoulder', compound: true, name: "Press d'espatlles", machine: "Press d'espatlles", photo: 'shoulder', sets: 3, reps: '8–10', weight: true, rest: 75, note: "Assegut amb tota l'esquena al respatller." },
        { key: 'pecfly', name: 'Contractora', machine: 'Contractora (pec deck)', photo: 'pectoral', sets: 2, reps: '12', weight: true, rest: 30, pair: 'B', note: 'Colzes lleugerament flexionats; aguanta 1 s amb les mans juntes.' },
        { key: 'facepull', slow: true, name: 'Face pull assegut', machine: 'Jaló al pit, amb corda', photo: 'lat', sets: 3, reps: '15', weight: true, rest: 60, pair: 'B', note: 'Estira la corda cap a la cara obrint els colzes; pes lleuger. La tercera sèrie, sola.' },
        { key: 'armcurl', slow: true, name: 'Curl de bíceps', machine: 'Curl de bíceps', photo: 'armcurl', sets: 2, reps: '12', weight: true, rest: 20, pair: 'C', note: '' },
        { key: 'armext', slow: true, name: 'Extensió de tríceps', machine: 'Extensió de tríceps', photo: 'armext', sets: 2, reps: '12', weight: true, rest: 60, pair: 'C', note: '' },
        { key: 'plank', name: 'Planxa frontal', machine: 'Terra, amb estoreta', photo: null, sets: 2, reps: '45 s', weight: false, rest: 45, note: 'Gluti i abdomen activats, sense deixar caure els malucs.' },
      ],
    },
    {
      id: 'd2',
      kind: 'lower',
      short: 'Cames A',
      title: 'Tren inferior A',
      focus: 'Quàdriceps i glutis + core',
      cardio: "20 min d'escaladora o cinta caminant en pujada, en zona 2",
      exercises: [
        { key: 'legpress', name: 'Premsa de cames', machine: 'Premsa de cames', photo: 'legpress', sets: 4, reps: '8–10', weight: true, rest: 90, compound: true, note: 'Baixa fins on la lumbar segueix enganxada al respatller. Si la lumbar es desenganxa del respatller, aquella repetició ja és massa avall.' },
        { key: 'hipthrust', name: 'Hip thrust', machine: 'Hip thrust', photo: 'hipthrust', sets: 3, reps: '8–10', weight: true, rest: 75, compound: true, note: 'Costelles avall i barbeta cap al pit. A dalt, bascula la pelvis com si apretessis el gluti i para quan els malucs estiguin alineats. Si notes la lumbar en lloc del gluti, baixa el pes.' },
        { key: 'legcurl', name: 'Curl femoral assegut', machine: 'Curl femoral assegut', photo: 'legcurl', sets: 3, reps: '10–12', weight: true, rest: 30, pair: 'A', note: 'Baixada lenta, 3 s.' },
        { key: 'legext', name: 'Extensió de quàdriceps', machine: 'Extensió de quàdriceps', photo: 'legext', sets: 3, reps: '12–15', weight: true, rest: 60, pair: 'A', note: 'Aguanta 1 s a dalt.' },
        { key: 'abductor', name: 'Abductors', machine: 'Abductors / adductors', photo: 'abdadd', sets: 2, reps: '15', weight: true, rest: 20, pair: 'B', note: 'Esquena recolzada.' },
        { key: 'calf', name: 'Bessons asseguts', machine: 'Bessons (assegut) o premsa', photo: 'seatedcalf', sets: 3, reps: '12–15', weight: true, rest: 60, pair: 'B', note: 'Evita la versió dreta amb coixins a les espatlles. La tercera sèrie, sola.' },
        { key: 'birddog', name: 'Bird dog', machine: 'Terra, amb estoreta', photo: null, sets: 3, reps: '6 per costat', weight: false, rest: 15, pair: 'C', note: "Aguanta 5–8 s cada repetició amb l'esquena plana." },
        { key: 'deadbug', name: 'Dead bug', machine: 'Terra, amb estoreta', photo: null, sets: 3, reps: '8 per costat', weight: false, rest: 45, pair: 'C', note: "Lumbar enganxada a terra tota l'estona." },
      ],
    },
    {
      id: 'd3',
      kind: 'upper',
      short: 'Tronc B',
      title: 'Tronc superior B',
      focus: 'Esquena alta i espatlles',
      cardio: '20 min de bicicleta o el·líptica en zona 2',
      exercises: [
        { key: 'psrow', compound: true, name: 'Rem amb discos, colzes oberts', machine: 'Rem amb discos', photo: 'psrow', sets: 4, reps: '8–10', weight: true, rest: 90, note: 'Pit recolzat; colzes a 45–60° del cos i junta les escàpules al final.' },
        { key: 'incline', compound: true, name: 'Press inclinat', machine: 'Press inclinat amb discos', photo: 'incline', sets: 3, reps: '8–10', weight: true, rest: 30, pair: 'A', note: 'Esquena recolzada.' },
        { key: 'chin', compound: true, name: 'Dominades assistides, agafada neutra', machine: 'Dominades i fons assistits', photo: 'chin', sets: 3, reps: '6–10', weight: 'assist', rest: 75, pair: 'A', note: 'Si et molesta la lumbar, fes jaló amb discos.' },
        { key: 'chestpress', compound: true, name: 'Press de pit', machine: 'Press de pit', photo: 'chestpress', sets: 2, reps: '10–12', weight: true, rest: 30, pair: 'B', note: 'Una mica més lleuger que el dia 1.' },
        { key: 'reardelt', slow: true, name: 'Deltoide posterior', machine: 'Contractora, de cara al respatller', photo: 'pectoral', sets: 3, reps: '12–15', weight: true, rest: 60, pair: 'B', note: 'Braços gairebé estirats. La tercera sèrie, sola.' },
        { key: 'lateral', slow: true, name: 'Elevacions laterals', machine: 'Elevacions laterals en màquina', photo: 'delts', sets: 3, reps: '12–15', weight: true, rest: 60, note: "Puja fins a l'alçada de les espatlles." },
        { key: 'armcurl', slow: true, name: 'Curl de bíceps', machine: 'Curl de bíceps', photo: 'armcurl', sets: 2, reps: '12', weight: true, rest: 20, pair: 'C', note: '' },
        { key: 'armext', slow: true, name: 'Extensió de tríceps', machine: 'Extensió de tríceps', photo: 'armext', sets: 2, reps: '12', weight: true, rest: 60, pair: 'C', note: '' },
        { key: 'curlup', name: 'Curl-up', machine: 'Terra, amb estoreta', photo: null, sets: 2, reps: '6 (aguanta 8 s)', weight: false, rest: 15, pair: 'D', note: 'Mans sota la lumbar; aixeca només cap i espatlles 2–3 cm.' },
        { key: 'sideplank', name: 'Planxa lateral', machine: 'Terra', photo: null, sets: 2, reps: '30 s per costat', weight: false, rest: 45, pair: 'D', note: 'Genolls flexionats si cal.' },
      ],
    },
    {
      id: 'd4',
      kind: 'lower',
      short: 'Cames B',
      title: 'Tren inferior B',
      focus: 'Glutis i isquios + lumbar',
      cardio: "20 min d'escaladora o cinta caminant en pujada, en zona 2",
      exercises: [
        { key: 'hipthrust', name: 'Hip thrust', machine: 'Hip thrust', photo: 'hipthrust', sets: 4, reps: '8–10', weight: true, rest: 90, compound: true, note: 'Exercici principal del dia; més pes que el dia 2. Costelles avall i barbeta cap al pit. A dalt, bascula la pelvis com si apretessis el gluti i para quan els malucs estiguin alineats. Si notes la lumbar en lloc del gluti, baixa el pes.' },
        { key: 'legpresshigh', name: 'Premsa de cames, peus alts', machine: 'Premsa de cames', photo: 'legpress', sets: 3, reps: '10–12', weight: true, rest: 75, compound: true, note: 'Peus a la part alta de la plataforma. Si la lumbar es desenganxa del respatller, aquella repetició ja és massa avall.' },
        { key: 'prone', name: 'Curl femoral estirat', machine: 'Curl femoral estirat', photo: 'prone', sets: 3, reps: '10–12', weight: true, rest: 30, pair: 'A', note: 'Si et molesta la lumbar, fes el curl assegut.' },
        { key: 'multihip', name: 'Glutis, patada enrere de peu', machine: 'Multi-hip', photo: 'multihip', sets: 3, reps: '12 per cama', weight: true, rest: 60, pair: 'A', note: "Tronc recte, agafat a les nanses. Costelles avall i abdomen activat; no arquegis la lumbar al final." },
        { key: 'legext', name: 'Extensió de quàdriceps', machine: 'Extensió de quàdriceps', photo: 'legext', sets: 2, reps: '12–15', weight: true, rest: 20, pair: 'B', note: 'Aguanta 1 s a dalt.' },
        { key: 'calfpress', name: 'Bessons a la premsa', machine: 'Premsa de cames', photo: 'legpress', sets: 3, reps: '12–15', weight: true, rest: 60, pair: 'B', note: 'Cames estirades sense bloquejar els genolls; només les puntes dels peus a la plataforma. La tercera sèrie, sola.' },
        { key: 'hyperiso', anim: 'hyper', name: 'Hiperextensió isomètrica', machine: "Banc d'hiperextensions 45°", photo: 'lowerback', sets: 3, reps: '20–30 s', weight: false, rest: 20, pair: 'C', note: "Només amb el vistiplau del fisio. Aguanta el cos en línia recta; el moviment surt del maluc i l'esquena no s'arrodoneix mai." },
        { key: 'pallof', name: 'Pallof press', machine: "Politja a l'alçada del pit", photo: null, place: 'Politja', sets: 3, reps: '10 per costat', weight: true, rest: 45, pair: 'C', note: 'De costat a la politja, estira els braços endavant i aguanta 2 s sense que el tronc giri. Pes lleuger.' },
      ],
    },
    {
      id: 'd5',
      kind: 'upper',
      short: 'Opcional',
      title: 'Opcional',
      focus: 'Esquena alta, braços i cardio llarg',
      cardio: '30 min en zona 2 (bicicleta, el·líptica o escaladora)',
      exercises: [
        { key: 'facepull', slow: true, name: 'Face pull assegut', machine: 'Jaló al pit, amb corda', photo: 'lat', sets: 3, reps: '15', weight: true, rest: 20, pair: 'A', note: '' },
        { key: 'lowrowwide', compound: true, name: 'Rem amb pit recolzat, colzes oberts', machine: 'Rem sentat en màquina', photo: 'lowrow', sets: 3, reps: '12', weight: true, rest: 60, pair: 'A', note: 'Nanses amples si la màquina en té.' },
        { key: 'incline', compound: true, name: 'Press inclinat', machine: 'Press inclinat amb discos', photo: 'incline', sets: 3, reps: '10–12', weight: true, rest: 75, note: '' },
        { key: 'straightarm', name: 'Jaló amb braços estirats', machine: 'Jaló al pit, de peu', photo: 'lat', sets: 3, reps: '12–15', weight: true, rest: 20, pair: 'B', note: 'Costelles avall i abdomen activat, braços gairebé rectes fins a les cuixes; no arquegis la lumbar al final. Si la màquina molesta de peu, fes-lo agenollat.' },
        { key: 'reardelt', slow: true, name: 'Deltoide posterior', machine: 'Contractora, de cara al respatller', photo: 'pectoral', sets: 2, reps: '15', weight: true, rest: 60, pair: 'B', note: '' },
        { key: 'armcurl', slow: true, name: 'Curl de bíceps', machine: 'Curl de bíceps', photo: 'armcurl', sets: 3, reps: '12', weight: true, rest: 20, pair: 'C', note: '' },
        { key: 'armext', slow: true, name: 'Extensió de tríceps', machine: 'Extensió de tríceps', photo: 'armext', sets: 3, reps: '12', weight: true, rest: 60, pair: 'C', note: '' },
        { key: 'calf', name: 'Bessons asseguts', machine: 'Bessons (assegut)', photo: 'seatedcalf', sets: 3, reps: '15', weight: true, rest: 60, note: 'Baixada lenta fins a estirar del tot.' },
      ],
    },
  ],
};

// Músculs de cada exercici, per clau: principals i secundaris.
// Noms possibles: pit, espatlles, deltposterior, esquenaalta, dorsals, lumbar, abdominals,
// oblics, biceps, triceps, avantbracos, glutis, abductors, adductors, quadriceps, isquios, bessons.
window.PLAN.muscles = {
  latpull: { main: ['dorsals'], aux: ['biceps', 'esquenaalta'] },
  lowrow: { main: ['esquenaalta', 'dorsals'], aux: ['biceps', 'deltposterior'] },
  lowrowwide: { main: ['esquenaalta', 'deltposterior'], aux: ['dorsals', 'biceps'] },
  psrow: { main: ['esquenaalta', 'dorsals'], aux: ['biceps', 'deltposterior'] },
  chin: { main: ['dorsals', 'biceps'], aux: ['esquenaalta', 'avantbracos'] },
  straightarm: { main: ['dorsals'], aux: ['triceps', 'abdominals'] },
  facepull: { main: ['deltposterior', 'esquenaalta'], aux: [] },
  reardelt: { main: ['deltposterior', 'esquenaalta'], aux: [] },
  chestpress: { main: ['pit'], aux: ['triceps', 'espatlles'] },
  incline: { main: ['pit', 'espatlles'], aux: ['triceps'] },
  pecfly: { main: ['pit'], aux: [] },
  shoulder: { main: ['espatlles'], aux: ['triceps'] },
  lateral: { main: ['espatlles'], aux: [] },
  armcurl: { main: ['biceps'], aux: ['avantbracos'] },
  armext: { main: ['triceps'], aux: [] },
  plank: { main: ['abdominals'], aux: ['oblics', 'glutis'] },
  sideplank: { main: ['oblics'], aux: ['abductors'] },
  curlup: { main: ['abdominals'], aux: [] },
  deadbug: { main: ['abdominals'], aux: ['oblics'] },
  birddog: { main: ['lumbar', 'glutis'], aux: ['abdominals'] },
  pallof: { main: ['oblics', 'abdominals'], aux: [] },
  hyper: { main: ['lumbar', 'glutis'], aux: ['isquios'] },
  hyperiso: { main: ['lumbar', 'glutis'], aux: ['isquios'] },
  legpress: { main: ['quadriceps', 'glutis'], aux: ['isquios'] },
  legpresshigh: { main: ['glutis', 'isquios'], aux: ['quadriceps'] },
  hipthrust: { main: ['glutis'], aux: ['isquios'] },
  multihip: { main: ['glutis'], aux: ['isquios'] },
  legcurl: { main: ['isquios'], aux: ['bessons'] },
  prone: { main: ['isquios'], aux: ['bessons'] },
  legext: { main: ['quadriceps'], aux: [] },
  legext1: { main: ['quadriceps'], aux: [] },
  abductor: { main: ['abductors'], aux: [] },
  adductor: { main: ['adductors'], aux: [] },
  calf: { main: ['bessons'], aux: [] },
  calfpress: { main: ['bessons'], aux: [] },
};
