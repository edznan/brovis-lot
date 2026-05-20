// Seed document types. Loaded into the `types` object store on first run.
// Users can add, edit, and delete types from the Types management screen.

const SEED_TYPES = [
  {
    id: "pileci-file-ii",
    title: "PILEĆI FILE-II- ZAMRZNUT  ZA PRERADU",
    defaultTemperature: "-12 ° C",
    shelfLifeDays: 365,
    requiresChemicalAnalysis: false,
    weightLabel: "palete"
  },
  {
    id: "pileca-jetra-rinfuz",
    title: "PILEĆA JETRA RINFUZ\nZAMRZNUTA ZA PRERADU",
    defaultTemperature: "-12 ° C",
    shelfLifeDays: 365,
    requiresChemicalAnalysis: false,
    weightLabel: "palete-kaveza"
  },
  {
    id: "pileca-kozica-ii",
    title: "PILEĆA KOŽICA-II- ZAMRZNUTA ZA PRERADU",
    defaultTemperature: "-12 ° C",
    shelfLifeDays: 365,
    requiresChemicalAnalysis: false,
    weightLabel: "palete"
  },
  {
    id: "pileci-batak-karabatak",
    title: "PILEĆI BATAK SA KARABATAKOM BEZ KOSTI I KOŽE-ZAMRZNUT ZA PRERADU",
    defaultTemperature: "-12 ° C",
    shelfLifeDays: 365,
    requiresChemicalAnalysis: false,
    weightLabel: "palete-kaveza"
  },
  {
    id: "msm-pilece-meso",
    title: "MEHANIČKI  SEPARISANO PILEĆE MESO – MSM   ZAMRZNUTO - ZA PRERADU",
    defaultTemperature: "-18 ° C",
    shelfLifeDays: 90,
    requiresChemicalAnalysis: true,
    weightLabel: "palete-kaveza"
  }
];

window.SEED_TYPES = SEED_TYPES;
