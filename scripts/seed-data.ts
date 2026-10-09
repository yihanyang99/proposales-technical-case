// Test data for the Proposales test account (approved 2026-10-09, see IMPLEMENTATION_PLAN Step 2a).
// Prices are EUR in minor units (cents), excluding VAT. VAT rates are illustrative but consistent.
// Units and categories use the vocabulary of the Proposales UI (product unit and type), which the
// public API does not expose; see docs/API_FINDINGS.md.

export type SeedProduct = {
  key: string;
  title: string;
  description: string;
  category: "accommodation" | "meeting_room" | "food_and_beverage" | "package" | "other";
  unit: "night" | "day" | "person" | "unit";
  /** What one "unit" means when the Proposales unit list has no exact match. */
  unitLabel?: string;
  unitPriceExclVat: number;
  vatRate: number;
};

export type SeedProposal = {
  seedKey: string;
  title: string;
  description: string;
  data: Record<string, string | number>;
  lines: { productKey: string; quantity: number }[];
};

export const SEED_CURRENCY = "EUR";
export const SEED_LANGUAGE = "en";

export const seedProducts: SeedProduct[] = [
  { key: "standard-room", title: "Standard Double Room", description: "Comfortable double room with city view, breakfast included.", category: "accommodation", unit: "night", unitPriceExclVat: 14500, vatRate: 0.12 },
  { key: "superior-room", title: "Superior Double Room", description: "Larger double room on a high floor with harbour view and Nespresso machine, breakfast included.", category: "accommodation", unit: "night", unitPriceExclVat: 18500, vatRate: 0.12 },
  { key: "junior-suite", title: "Junior Suite", description: "Suite with separate seating area, bathtub and late checkout, breakfast included.", category: "accommodation", unit: "night", unitPriceExclVat: 26000, vatRate: 0.12 },
  { key: "meeting-half-day", title: "Meeting Room – Half Day", description: "Meeting room for up to 20 guests, 4 hours, with whiteboard, Wi-Fi and water.", category: "meeting_room", unit: "unit", unitLabel: "half-day session", unitPriceExclVat: 45000, vatRate: 0.25 },
  { key: "meeting-full-day", title: "Meeting Room – Full Day", description: "Meeting room for up to 100 guests, 8 hours, with whiteboard, Wi-Fi and water.", category: "meeting_room", unit: "day", unitPriceExclVat: 75000, vatRate: 0.25 },
  { key: "av-package", title: "AV Package", description: "Projector, screen, two wireless microphones and on-call technician support.", category: "meeting_room", unit: "day", unitPriceExclVat: 18000, vatRate: 0.25 },
  { key: "coffee-break", title: "Coffee Break", description: "Coffee, tea, fruit and freshly baked pastries.", category: "food_and_beverage", unit: "person", unitPriceExclVat: 900, vatRate: 0.12 },
  { key: "business-lunch", title: "Business Lunch", description: "Two-course seasonal lunch with water and coffee.", category: "food_and_beverage", unit: "person", unitPriceExclVat: 3200, vatRate: 0.12 },
  { key: "three-course-dinner", title: "Three-Course Dinner", description: "Seasonal three-course dinner in the hotel restaurant.", category: "food_and_beverage", unit: "person", unitPriceExclVat: 5800, vatRate: 0.12 },
  { key: "welcome-drink", title: "Welcome Drink Reception", description: "Sparkling wine or non-alcoholic alternative with canapés on arrival.", category: "food_and_beverage", unit: "person", unitPriceExclVat: 1400, vatRate: 0.25 },
  { key: "airport-transfer", title: "Airport Transfer", description: "Private minivan transfer for up to 7 passengers between the airport and the hotel.", category: "other", unit: "unit", unitLabel: "trip", unitPriceExclVat: 9500, vatRate: 0.06 },
  { key: "spa-access", title: "Spa Access", description: "Full-day access to pool, sauna and relaxation area, bathrobe included.", category: "other", unit: "person", unitPriceExclVat: 3500, vatRate: 0.25 },
];

// No recipients: proposals are created without any customer personal data.
export const seedProposals: SeedProposal[] = [
  {
    seedKey: "board-meeting",
    title: "Quarterly Board Meeting",
    description: "Half-day board meeting for 12 participants on 5 November 2026.",
    data: { seed_key: "board-meeting", event_type: "board_meeting", guests: 12, event_start: "2026-11-05", event_end: "2026-11-05" },
    lines: [
      { productKey: "meeting-half-day", quantity: 1 },
      { productKey: "coffee-break", quantity: 12 },
    ],
  },
  {
    seedKey: "tech-summit",
    title: "Nordic Tech Summit – 2-day conference",
    description: "Two-day technology conference for 80 attendees on 12–13 November 2026, with one overnight stay.",
    data: { seed_key: "tech-summit", event_type: "conference", guests: 80, event_start: "2026-11-12", event_end: "2026-11-13" },
    lines: [
      { productKey: "meeting-full-day", quantity: 2 },
      { productKey: "standard-room", quantity: 40 },
      { productKey: "business-lunch", quantity: 160 },
    ],
  },
  {
    seedKey: "summer-wedding",
    title: "Summer Wedding Celebration",
    description: "Wedding dinner and overnight stay for 60 guests on 19 June 2027.",
    data: { seed_key: "summer-wedding", event_type: "wedding", guests: 60, event_start: "2027-06-19", event_end: "2027-06-20" },
    lines: [
      { productKey: "three-course-dinner", quantity: 60 },
      { productKey: "welcome-drink", quantity: 60 },
      { productKey: "standard-room", quantity: 25 },
    ],
  },
  {
    seedKey: "sales-offsite",
    title: "Sales Team Offsite",
    description: "Two-night team offsite for 20 people on 2–4 December 2026, with two full workshop days.",
    data: { seed_key: "sales-offsite", event_type: "offsite", guests: 20, event_start: "2026-12-02", event_end: "2026-12-04" },
    lines: [
      { productKey: "standard-room", quantity: 40 },
      { productKey: "meeting-full-day", quantity: 2 },
      { productKey: "business-lunch", quantity: 40 },
    ],
  },
];
