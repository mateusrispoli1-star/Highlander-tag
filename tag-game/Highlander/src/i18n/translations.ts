export type Language = 'en' | 'es';

export const translations = {
  en: {
    subtitle: 'Real-world location game',
    namePlaceholder: 'Your name',
    createGame: 'Create Game',
    orJoin: 'OR JOIN',
    codePlaceholder: 'Room code  (e.g. AB3XQ)',
    joinGame: 'Join Game',
    errorNameRequired: 'Enter your name first',
    errorCodeRequired: 'Enter the 5-character room code',
    errorConnectionFailed: 'Connection failed',
    errorConnectionMsg: 'Could not reach the server. Check your config.ts SERVER_URL.',
    error: 'Error',

    roomCode: 'ROOM CODE',
    shareCode: 'Share this with your friends',
    players: 'Players',
    host: 'HOST',
    you: 'YOU',
    matchSettings: 'Match Settings',

    gameMode: 'Game Mode',
    modeClassic: 'Classic',
    modeInfection: 'Infection',
    modeFreeze: 'Freeze',
    modeClassicDesc: 'Hunter tags a runner — they swap roles. Keep playing until the host ends the game.',
    modeInfectionDesc: 'Tagged runners become hunters. Last runner standing wins.',
    modeFreezeDesc: 'Tagged runners freeze. Other runners can unfreeze them. Hunters win when all are frozen.',

    huntersSetting: 'Hunters: {n}',
    tagRangeSetting: 'Tag Range: {n} m',
    timeLimitSetting: 'Time Limit: {val}',
    timeLimitNone: 'None',
    timeLimitMinutes: '{n} min',
    tagImmunitySetting: 'Tag Immunity: {n} s',
    headStartSetting: 'Hunter Head Start: {n} s',

    trackerAccuracy: 'Tracker Accuracy',
    accuracyPrecise: 'Precise',
    accuracyNormal: 'Normal',
    accuracyApproximate: 'Approx',
    accuracyVague: 'Vague',
    accuracyPreciseDetail: '~3 m — tight street games',
    accuracyNormalDetail: '~10 m — standard outdoor',
    accuracyApproximateDetail: '~100 m — park / campus scale',
    accuracyVagueDetail: '~1 km — large-scale hide & seek',

    playBoundary: 'Play Boundary',
    boundarySet: 'Set — {n} m radius',
    boundaryNone: 'No boundary',
    editBoundary: 'Edit Boundary',
    setBoundaryOnMap: 'Set Boundary on Map',
    tapToSetCentre: 'Tap map to set centre',
    radius: 'Radius: {n} m',

    startGame: 'Start Game',
    waitingForHost: 'Waiting for the host to start…',
    errorMinPlayers: 'Need at least 2 players',

    save: 'Save',
    clear: 'Clear',
    cancel: 'Cancel',

    roleHunter: 'HUNTER',
    roleRunner: 'RUNNER',
    roleFrozen: 'FROZEN',

    headStartBanner: 'RUNNERS GET A HEAD START — {n}s',
    outOfBounds: 'OUT OF BOUNDS',
    freezeHint: 'Tap a frozen runner on the map to unfreeze them',
    youAreFrozen: 'YOU ARE FROZEN',
    frozenSub: 'Another runner must tap your icon to free you',

    taggedBtn: 'TAGGED!',
    taggedBtnSub: 'press if a hunter got you',

    playerCount: '{run} run · {hunt} hunt',
    playerCountFrozen: '{run} run · {hunt} hunt · {frz} frozen',

    endGameBtn: 'End',
    endGameTitle: 'End Game',
    endGameConfirm: 'Are you sure you want to end the game for everyone?',

    toastYouWereTaggedBy: 'You were tagged by {name}!',
    toastYouTagged: 'You tagged {name}!',
    toastFeedTagged: '{tagger} tagged {tagged}',
    toastUnfrozen: 'Player unfrozen!',

    tagModalTitle: 'Who tagged you?',
    tagModalSub: 'Select the hunter who got you',
    tagModalEmpty: 'No hunters found — are you sure you were tagged?',

    gameOver: 'GAME OVER',
    youWin: 'YOU WIN 🏆',
    youLose: 'YOU LOSE',
    huntersWin: 'Hunters win!',
    runnersWin: 'Runners win!',
    backToHome: 'Back to Home',

    gettingLocation: 'Getting your location…',
    locationDenied: 'Location access is required to play. Please allow location in your browser settings.',
  },

  es: {
    subtitle: 'Juego de ubicación en tiempo real',
    namePlaceholder: 'Tu nombre',
    createGame: 'Crear Partida',
    orJoin: 'O UNIRSE',
    codePlaceholder: 'Código de sala (ej. AB3XQ)',
    joinGame: 'Unirse',
    errorNameRequired: 'Primero ingresa tu nombre',
    errorCodeRequired: 'Ingresa el código de 5 caracteres',
    errorConnectionFailed: 'Error de conexión',
    errorConnectionMsg: 'No se pudo conectar al servidor. Revisa SERVER_URL en config.ts.',
    error: 'Error',

    roomCode: 'CÓDIGO DE SALA',
    shareCode: 'Comparte esto con tus amigos',
    players: 'Jugadores',
    host: 'ANFITRIÓN',
    you: 'TÚ',
    matchSettings: 'Configuración',

    gameMode: 'Modo de Juego',
    modeClassic: 'Clásico',
    modeInfection: 'Infección',
    modeFreeze: 'Congelar',
    modeClassicDesc: 'El cazador etiqueta a un corredor — intercambian roles. Se juega hasta que el anfitrión termine.',
    modeInfectionDesc: 'Los corredores etiquetados se vuelven cazadores. ¡El último corredor gana!',
    modeFreezeDesc: 'Los corredores etiquetados se congelan. Otros pueden descongelarlos. Los cazadores ganan cuando todos estén congelados.',

    huntersSetting: 'Cazadores: {n}',
    tagRangeSetting: 'Rango de etiqueta: {n} m',
    timeLimitSetting: 'Límite de tiempo: {val}',
    timeLimitNone: 'Sin límite',
    timeLimitMinutes: '{n} min',
    tagImmunitySetting: 'Inmunidad: {n} s',
    headStartSetting: 'Ventaja del cazador: {n} s',

    trackerAccuracy: 'Precisión del Rastreador',
    accuracyPrecise: 'Precisa',
    accuracyNormal: 'Normal',
    accuracyApproximate: 'Aprox',
    accuracyVague: 'Vaga',
    accuracyPreciseDetail: '~3 m — juegos en calle',
    accuracyNormalDetail: '~10 m — exterior estándar',
    accuracyApproximateDetail: '~100 m — parque / campus',
    accuracyVagueDetail: '~1 km — escondite a gran escala',

    playBoundary: 'Límite de Juego',
    boundarySet: 'Definido — radio de {n} m',
    boundaryNone: 'Sin límite',
    editBoundary: 'Editar Límite',
    setBoundaryOnMap: 'Definir Límite en el Mapa',
    tapToSetCentre: 'Toca el mapa para fijar el centro',
    radius: 'Radio: {n} m',

    startGame: 'Iniciar Partida',
    waitingForHost: 'Esperando que el anfitrión inicie…',
    errorMinPlayers: 'Se necesitan al menos 2 jugadores',

    save: 'Guardar',
    clear: 'Limpiar',
    cancel: 'Cancelar',

    roleHunter: 'CAZADOR',
    roleRunner: 'CORREDOR',
    roleFrozen: 'CONGELADO',

    headStartBanner: 'VENTAJA PARA CORREDORES — {n}s',
    outOfBounds: 'FUERA DE LÍMITE',
    freezeHint: 'Toca a un corredor congelado en el mapa para liberarlo',
    youAreFrozen: 'ESTÁS CONGELADO',
    frozenSub: 'Otro corredor debe tocarte para liberarte',

    taggedBtn: '¡ATRAPADO!',
    taggedBtnSub: 'presiona si un cazador te atrapó',

    playerCount: '{run} corr · {hunt} caz',
    playerCountFrozen: '{run} corr · {hunt} caz · {frz} congelados',

    endGameBtn: 'Terminar',
    endGameTitle: 'Terminar Partida',
    endGameConfirm: '¿Seguro que quieres terminar la partida para todos?',

    toastYouWereTaggedBy: '¡{name} te atrapó!',
    toastYouTagged: '¡Atrapaste a {name}!',
    toastFeedTagged: '{tagger} atrapó a {tagged}',
    toastUnfrozen: '¡Jugador descongelado!',

    tagModalTitle: '¿Quién te atrapó?',
    tagModalSub: 'Selecciona el cazador que te agarró',
    tagModalEmpty: 'Sin cazadores — ¿estás seguro de que te atraparon?',

    gameOver: 'FIN DEL JUEGO',
    youWin: '¡GANASTE 🏆',
    youLose: 'PERDISTE',
    huntersWin: '¡Ganan los cazadores!',
    runnersWin: '¡Ganan los corredores!',
    backToHome: 'Volver al inicio',

    gettingLocation: 'Obteniendo tu ubicación…',
    locationDenied: 'Se necesita acceso a ubicación para jugar. Permite la ubicación en los ajustes del navegador.',
  },
} as const;

export type TranslationKey = keyof typeof translations['en'];
