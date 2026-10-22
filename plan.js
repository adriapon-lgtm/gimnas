// Pla d'entrenament. Per canviar el pla, edita aquest fitxer.
// Les dades de l'usuari es guarden per clau d'exercici (`key`), així que
// canviar sèries, notes o l'ordre no trenca l'historial.
//
// weight: true = camp de pes, false = sense pes, 'assist' = pes d'assistència.

window.PLAN = {
  warmup: {
    time: '10 min',
    // anim: animació que es pot desplegar des de la llista (clau d'anim.js).
    items: [
      { text: '5 min de bicicleta suau' },
      { text: 'Curl-up 1 × 5 (aguanta 8 s)', anim: 'curlup' },
      { text: 'Planxa lateral 1 × 15 s per costat', anim: 'sideplank' },
      { text: 'Bird dog 1 × 5 per costat', anim: 'birddog' },
      { text: '1–2 sèries lleugeres del primer exercici' },
    ],
  },
  days: [
    {
      id: 'd1',
      short: 'Tronc A',
      title: 'Tronc superior A',
      focus: 'Dorsals i pit',
      cardio: '20 min de bicicleta o el·líptica en zona 2',
      exercises: [
        { key: 'latpull', name: 'Jaló al pit, agafada ampla', machine: 'Jaló al pit (politja alta)', photo: 'lat', sets: 4, reps: '8–10', weight: true, note: 'Pit amunt, baixa la barra fins a la clavícula sense tirar el tronc enrere.' },
        { key: 'lowrow', name: 'Rem sentat amb pit recolzat', machine: 'Rem sentat en màquina', photo: 'lowrow', sets: 3, reps: '8–10', weight: true, note: 'Pit enganxat al coixí tota la sèrie; aguanta 1 s a dalt.' },
        { key: 'chestpress', name: 'Press de pit', machine: 'Press de pit', photo: 'chestpress', sets: 3, reps: '8–10', weight: true, note: 'Esquena recolzada al respatller, sense arquejar la lumbar.' },
        { key: 'pecfly', name: 'Contractora', machine: 'Contractora (pec deck)', photo: 'pectoral', sets: 3, reps: '10–12', weight: true, note: 'Colzes lleugerament flexionats; aguanta 1 s amb les mans juntes.' },
        { key: 'shoulder', name: "Press d'espatlles", machine: "Press d'espatlles", photo: 'shoulder', sets: 3, reps: '8–10', weight: true, note: "Assegut amb tota l'esquena al respatller." },
        { key: 'facepull', name: 'Face pull assegut', machine: 'Jaló al pit, amb corda', photo: 'lat', sets: 3, reps: '12–15', weight: true, note: 'Estira la corda cap a la cara obrint els colzes; pes lleuger.' },
        { key: 'armcurl', name: 'Curl de bíceps', machine: 'Curl de bíceps', photo: 'armcurl', sets: 2, reps: '12', weight: true, note: "Alternat amb l'extensió de tríceps." },
        { key: 'armext', name: 'Extensió de tríceps', machine: 'Extensió de tríceps', photo: 'armext', sets: 2, reps: '12', weight: true, note: '' },
        { key: 'plank', name: 'Planxa frontal', machine: 'Terra, amb estoreta', photo: null, sets: 3, reps: '30–45 s', weight: false, note: 'Gluti i abdomen activats, sense deixar caure els malucs.' },
      ],
    },
    {
      id: 'd2',
      short: 'Cames A',
      title: 'Tren inferior A',
      focus: 'Quàdriceps i glutis + core',
      cardio: "20 min d'escaladora o cinta caminant en pujada, en zona 2",
      exercises: [
        { key: 'legpress', name: 'Premsa de cames', machine: 'Premsa de cames', photo: 'legpress', sets: 4, reps: '8–10', weight: true, note: 'Baixa fins on la lumbar segueix enganxada al respatller.' },
        { key: 'hipthrust', name: 'Hip thrust', machine: 'Hip thrust', photo: 'hipthrust', sets: 3, reps: '8–10', weight: true, note: 'Puja fins que el tronc quedi recte; no arquegis la lumbar.' },
        { key: 'legcurl', name: 'Curl femoral assegut', machine: 'Curl femoral assegut', photo: 'legcurl', sets: 3, reps: '10–12', weight: true, note: 'Baixada lenta, 3 s.' },
        { key: 'legext', name: 'Extensió de quàdriceps', machine: 'Extensió de quàdriceps', photo: 'legext', sets: 3, reps: '12–15', weight: true, note: 'Aguanta 1 s a dalt.' },
        { key: 'abductor', name: 'Abductors', machine: 'Abductors / adductors', photo: 'abdadd', sets: 2, reps: '15', weight: true, note: 'Esquena recolzada.' },
        { key: 'calf', name: 'Bessons asseguts', machine: 'Bessons (assegut) o premsa', photo: 'seatedcalf', sets: 3, reps: '12–15', weight: true, note: 'Evita la versió dreta amb coixins a les espatlles.' },
        { key: 'birddog', name: 'Bird dog', machine: 'Terra, amb estoreta', photo: null, sets: 3, reps: '6 per costat', weight: false, note: "Aguanta 5–8 s cada repetició amb l'esquena plana." },
        { key: 'deadbug', name: 'Dead bug', machine: 'Terra, amb estoreta', photo: null, sets: 3, reps: '8 per costat', weight: false, note: "Lumbar enganxada a terra tota l'estona." },
      ],
    },
    {
      id: 'd3',
      short: 'Tronc B',
      title: 'Tronc superior B',
      focus: 'Esquena alta i espatlles',
      cardio: '20 min de bicicleta o el·líptica en zona 2',
      exercises: [
        { key: 'psrow', name: 'Rem amb discos, colzes oberts', machine: 'Rem amb discos', photo: 'psrow', sets: 4, reps: '8–10', weight: true, note: 'Pit recolzat; colzes a 45–60° del cos i junta les escàpules al final.' },
        { key: 'incline', name: 'Press inclinat', machine: 'Press inclinat amb discos', photo: 'incline', sets: 3, reps: '8–10', weight: true, note: 'Esquena recolzada.' },
        { key: 'chin', name: 'Dominades assistides, agafada neutra', machine: 'Dominades i fons assistits', photo: 'chin', sets: 3, reps: '6–10', weight: 'assist', note: 'Si et molesta la lumbar, fes jaló amb discos.' },
        { key: 'chestpress', name: 'Press de pit', machine: 'Press de pit', photo: 'chestpress', sets: 3, reps: '10–12', weight: true, note: 'Una mica més lleuger que el dia 1.' },
        { key: 'reardelt', name: 'Deltoide posterior', machine: 'Contractora, de cara al respatller', photo: 'pectoral', sets: 3, reps: '12–15', weight: true, note: 'Braços gairebé estirats.' },
        { key: 'lateral', name: 'Elevacions laterals', machine: 'Elevacions laterals en màquina', photo: 'delts', sets: 3, reps: '12–15', weight: true, note: "Puja fins a l'alçada de les espatlles." },
        { key: 'curlup', name: 'Curl-up', machine: 'Terra, amb estoreta', photo: null, sets: 3, reps: '6 (aguanta 8 s)', weight: false, note: 'Mans sota la lumbar; aixeca només cap i espatlles 2–3 cm.' },
        { key: 'sideplank', name: 'Planxa lateral', machine: 'Terra', photo: null, sets: 3, reps: '20–30 s per costat', weight: false, note: 'Genolls flexionats si cal.' },
      ],
    },
    {
      id: 'd4',
      short: 'Cames B',
      title: 'Tren inferior B',
      focus: 'Glutis i isquios + lumbar',
      cardio: "20 min d'escaladora o cinta caminant en pujada, en zona 2",
      exercises: [
        { key: 'hipthrust', name: 'Hip thrust', machine: 'Hip thrust', photo: 'hipthrust', sets: 4, reps: '8–10', weight: true, note: 'Exercici principal del dia; més pes que el dia 2.' },
        { key: 'legpresshigh', name: 'Premsa de cames, peus alts', machine: 'Premsa de cames', photo: 'legpress', sets: 3, reps: '10–12', weight: true, note: 'Peus a la part alta de la plataforma.' },
        { key: 'prone', name: 'Curl femoral estirat', machine: 'Curl femoral estirat', photo: 'prone', sets: 3, reps: '10–12', weight: true, note: 'Si et molesta la lumbar, fes el curl assegut.' },
        { key: 'multihip', name: 'Glutis, patada enrere de peu', machine: 'Multi-hip', photo: 'multihip', sets: 3, reps: '12 per cama', weight: true, note: "Tronc recte, agafat a les nanses, sense arquejar l'esquena." },
        { key: 'legext1', name: 'Extensió de quàdriceps a una cama', machine: 'Extensió de quàdriceps', photo: 'legext', sets: 2, reps: '12 per cama', weight: true, note: '' },
        { key: 'adductor', name: 'Adductors', machine: 'Abductors / adductors', photo: 'abdadd', sets: 2, reps: '15', weight: true, note: '' },
        { key: 'hyper', name: 'Hiperextensió curta', machine: "Banc d'hiperextensions 45°", photo: 'lowerback', sets: 3, reps: '10–12', weight: false, note: 'Només amb el vistiplau del fisio. Pes corporal, fins a línia recta i no més amunt.' },
        { key: 'birddog', name: 'Bird dog', machine: 'Terra, amb estoreta', photo: null, sets: 3, reps: '6 per costat', weight: false, note: "Aguanta 5–8 s amb l'esquena plana." },
      ],
    },
    {
      id: 'd5',
      short: 'Opcional',
      title: 'Opcional',
      focus: 'Esquena alta, braços i cardio llarg',
      cardio: '35–40 min en zona 2 (bicicleta, el·líptica o escaladora)',
      exercises: [
        { key: 'facepull', name: 'Face pull assegut', machine: 'Jaló al pit, amb corda', photo: 'lat', sets: 3, reps: '15', weight: true, note: '' },
        { key: 'lowrowwide', name: 'Rem amb pit recolzat, colzes oberts', machine: 'Rem sentat en màquina', photo: 'lowrow', sets: 2, reps: '12', weight: true, note: 'Nanses amples si la màquina en té.' },
        { key: 'incline', name: 'Press inclinat', machine: 'Press inclinat amb discos', photo: 'incline', sets: 3, reps: '10–12', weight: true, note: '' },
        { key: 'straightarm', name: 'Jaló amb braços estirats', machine: 'Jaló al pit, de peu', photo: 'lat', sets: 3, reps: '12–15', weight: true, note: 'Abdomen activat, braços gairebé rectes fins a les cuixes.' },
        { key: 'reardelt', name: 'Deltoide posterior', machine: 'Contractora, de cara al respatller', photo: 'pectoral', sets: 2, reps: '15', weight: true, note: '' },
        { key: 'armcurl', name: 'Curl de bíceps', machine: 'Curl de bíceps', photo: 'armcurl', sets: 3, reps: '12', weight: true, note: 'Alternat amb el tríceps.' },
        { key: 'armext', name: 'Extensió de tríceps', machine: 'Extensió de tríceps', photo: 'armext', sets: 3, reps: '12', weight: true, note: '' },
      ],
    },
  ],
};
