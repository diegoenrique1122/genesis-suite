/**
 * GENESIS OS
 * PLAN DEFINITIONS
 *
 * Fuente central de capacidades comerciales.
 */

export const COACH_PLANS = {
  IGNICION: {
    id: 'IGNICION',
    name: 'Coach Ignición',

    athleteLimit: 5,

    apps: {
      trainerPro: true,
      architect: true,
      discipline: false,
      hormonal: false,
    },

    features: {
      chatPrivate: true,
      community: false,
      trainingOverride: false,
      nutritionOverride: false,
      clinicalAI: false,
      whiteLabel: false,
      wearables: false,
      immersiveAthleteMode: false,
      customInviteCodes: false,
    },
  },

  EVOLUCION: {
    id: 'EVOLUCION',
    name: 'Coach Evolución',

    athleteLimit: 50,

    apps: {
      trainerPro: true,
      architect: true,
      discipline: false,
      hormonal: false,
    },

    features: {
      chatPrivate: true,
      community: false,
      trainingOverride: true,
      nutritionOverride: true,
      clinicalAI: false,
      whiteLabel: false,
      wearables: false,
      immersiveAthleteMode: false,
      customInviteCodes: false,
    },
  },

  ELITE: {
    id: 'ELITE',
    name: 'Coach Élite',

    athleteLimit: Infinity,

    apps: {
      trainerPro: true,
      architect: true,
      discipline: true,
      hormonal: true,
    },

    features: {
      chatPrivate: true,
      community: true,
      trainingOverride: true,
      nutritionOverride: true,
      clinicalAI: true,
      whiteLabel: true,
      wearables: true,
      immersiveAthleteMode: true,
      customInviteCodes: true,
    },
  },
};


export const ATHLETE_PLANS = {
  IGNICION: {
    id: 'IGNICION',
    name: 'Atleta Ignición',

    apps: {
      trainerPro: true,
      architect: false,
      discipline: false,
      hormonal: false,
    },

    features: {
      community: false,
      wearables: false,
      badges: false,
    },
  },

  EVOLUCION: {
    id: 'EVOLUCION',
    name: 'Atleta Evolución',

    apps: {
      trainerPro: true,
      architect: true,
      discipline: false,
      hormonal: false,
    },

    features: {
      community: false,
      wearables: false,
      badges: false,
    },
  },

  ELITE: {
    id: 'ELITE',
    name: 'Atleta Élite',

    apps: {
      trainerPro: true,
      architect: true,
      discipline: true,
      hormonal: true,
    },

    features: {
      community: true,
      wearables: true,
      badges: true,
    },
  },
};