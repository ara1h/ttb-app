import type { ApplicationData } from "./types";

/** Bundled demo scenarios. Images live in /public/samples. */
export interface SampleScenario {
  id: string;
  title: string;
  file: string;
  description: string;
  application: ApplicationData;
}

export const SAMPLE_SCENARIOS: SampleScenario[] = [
  {
    id: "correct",
    title: "Clean pass",
    file: "old-tom-correct.png",
    description: "Label matches the application exactly.",
    application: {
      brandName: "OLD TOM DISTILLERY",
      classType: "Kentucky Straight Bourbon Whiskey",
      alcoholContent: "45% Alc./Vol. (90 Proof)",
      netContents: "750 mL",
    },
  },
  {
    id: "abv-mismatch",
    title: "ABV mismatch",
    file: "old-tom-abv-mismatch.png",
    description: "Label says 43% but the application says 45%.",
    application: {
      brandName: "OLD TOM DISTILLERY",
      classType: "Kentucky Straight Bourbon Whiskey",
      alcoholContent: "45% Alc./Vol. (90 Proof)",
      netContents: "750 mL",
    },
  },
  {
    id: "warning-titlecase",
    title: "Warning not in caps",
    file: "old-tom-warning-titlecase.png",
    description: '"Government Warning" in title case — a real rejection case.',
    application: {
      brandName: "OLD TOM DISTILLERY",
      classType: "Kentucky Straight Bourbon Whiskey",
      alcoholContent: "45% Alc./Vol. (90 Proof)",
      netContents: "750 mL",
    },
  },
  {
    id: "brand-case",
    title: "Brand case differs",
    file: "stones-throw-case.png",
    description: "STONE'S THROW on the label vs Stone's Throw in the application — same name, accepted with a note.",
    application: {
      brandName: "Stone's Throw",
      classType: "Straight Rye Whiskey",
      alcoholContent: "50% Alc./Vol. (100 Proof)",
      netContents: "750 mL",
    },
  },
  {
    id: "missing-warning",
    title: "Missing warning",
    file: "high-desert-missing-warning.png",
    description: "No government warning statement on the label at all.",
    application: {
      brandName: "High Desert",
      classType: "Blended American Whiskey",
      alcoholContent: "40% Alc./Vol. (80 Proof)",
      netContents: "1 L",
    },
  },
  {
    id: "angled-photo",
    title: "Imperfect photo",
    file: "old-tom-photo-angled.png",
    description: "Rotated, slightly blurry photo — the AI still reads it.",
    application: {
      brandName: "OLD TOM DISTILLERY",
      classType: "Kentucky Straight Bourbon Whiskey",
      alcoholContent: "45% Alc./Vol. (90 Proof)",
      netContents: "750 mL",
    },
  },
];
