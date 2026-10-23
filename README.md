# Gimnàs

App web instal·lable (PWA) per seguir el pla d'entrenament: calendari setmanal, sèries, repeticions, pesos i historial. Funciona sense connexió i desa les dades al mòbil.

## Què fa

La navegació és a la barra de baix: Entrenar, Calendari, Progrés i Historial.

- **Entrenar:** la capçalera mostra el dia, l'objectiu i l'anell de progrés de la sessió.  cada exercici té un botó per sèrie, les repeticions (o segons) de cada sèrie, el pes, + i − per canviar el nombre de sèries i «Completa» per marcar l'exercici sencer. A sota hi ha l'última vegada (pes, repeticions i data), un suggeriment de progressió (puja 2,5 kg quan arribes al màxim de repeticions a totes les sèries) i els ajustos de la màquina (seient, coixí...), que es recorden per a la pròxima vegada. En marcar una sèrie comença el descans: 2 min al primer exercici, 75 s a la resta i 45 s als de terra; vibra en acabar. Es pot canviar posant `rest: 90` (segons) a un exercici de `plan.js`. «Com fer-ho» mostra una animació de la tècnica i la nota; a les màquines de tirar i empènyer hi ha també la vista de davant («De davant» / «De costat»). Cada exercici es pot **saltar** (no compta per completar el dia) i al final hi ha **Acaba la sessió**, que la dona per feta encara que no estigui tot fet. Cada exercici mostra en un cos esquemàtic els músculs que treballa (vermell els principals, clar els secundaris) i, al final de la sessió, un resum dels músculs treballats avui amb les sèries de cada un.
- **Calendari:** la setmana tipus (dl. D1, dt. D2, dj. D3, dv. D4, ds. D5 opcional). Toca un dia per entrenar-lo, aplaçar-lo un dia (els següents es mouen fins al pròxim descans), moure'l a una altra data, saltar-lo o afegir un entrenament en un dia de descans.
- **Calendari, resum:** en tocar un dia fet, veus què vas fer a cada exercici.
- **Progrés:** entrenaments de la setmana, setmanes completes seguides, volum (kg × repeticions), les últimes 8 setmanes i la gràfica de pes de cada exercici.
- **Historial:** totes les sessions, i exportar, compartir o importar una còpia. Si fa més de 14 dies que no en fas cap, surt un avís (i un punt vermell a la pestanya).

## Fitxers

- `index.html`, `styles.css`, `app.js`: l'app.
- `anim.js`: animacions de la tècnica (dins de «Com fer-ho»).
- `muscles.js`: dibuix del cos amb els grups musculars. Els músculs de cada exercici són a `PLAN.muscles`, al final de `plan.js`.
- `plan.js`: el pla d'entrenament. **Per canviar exercicis, sèries o notes, edita aquest fitxer.** La setmana tipus és a `WEEK`, al principi d'`app.js`.
- `sw.js`: service worker (memòria cau sense connexió).
- `manifest.webmanifest`, `icons/`: instal·lació com a app.
- `img/`: fotos de les màquines (Technogym).

## Publicar a GitHub Pages

1. Crea un repositori nou a GitHub (per exemple `gimnas`).
2. Puja-hi tots aquests fitxers.
3. Al repositori: **Settings > Pages > Build and deployment**, tria **Deploy from a branch**, branca `main`, carpeta `/ (root)` i desa.
4. Al cap d'un minut, l'app és a `https://<usuari>.github.io/gimnas/`.

## Instal·lar al mòbil

1. Obre l'adreça amb **Chrome** a Android.
2. Menú ⋮ > **Instal·la l'aplicació** (o «Afegeix a la pantalla d'inici»).
3. Obre-la una vegada amb connexió perquè es desin les fotos. A partir d'aquí funciona en mode avió.

## Fer canvis

Després de modificar qualsevol fitxer, puja el número de `VERSION` a `sw.js` (per exemple `v3` → `v4`). Si no, el mòbil continuarà fent servir la versió desada. El canvi s'aplica la segona vegada que obris l'app.

## Còpies de seguretat

Les dades només es desen al mòbil. Des de **Historial > Exporta** descarregues un JSON amb les sessions, els canvis del calendari i els ajustos de les màquines, i amb **Importa** el pots recuperar en un altre mòbil o després d'esborrar dades. La importació fusiona les sessions: si una ja existeix, es queda la versió modificada més tard.
