#!/usr/bin/env bun
/**
 * One-off: remove party-invitee-only characters from Gatsby chapter 4 index.
 * These are names that appear only in the long guest list with no speaking part,
 * and they flood the index/footer. Run once: bun run scripts/remove-gatsby-ch4-party-invitees.ts
 *
 * Keeps: main cast, Meyer Wolfshiem, Rosy Rosenthal, Katspaugh, Earl of Doncaster,
 * Daisy's mother/maid, and all places/events.
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const DATA_DIR = join(import.meta.dir, "..", "data");
const CHAPTER_INDEX_PATH = join(DATA_DIR, "gatsby", "chapter-index.json");

/** Entity IDs that are only listed as party invitees (no speaking part). */
const PARTY_INVITEE_ONLY_IDS = new Set([
  "becker",
  "bonnie_mcclenahan",
  "russel_betty",
  "clarence_endive",
  "chester_beckers",
  "leeches",
  "bunsen",
  "doctor_webster_civet",
  "hornbeams",
  "willie_voltaires",
  "blackbuck_family",
  "ismays",
  "hubert_auerbach",
  "mrs_chrystie",
  "edgar_beaver",
  "etty",
  "cheadles",
  "o_r_p_schraeders",
  "stonewall_jackson_abrams",
  "fishguards",
  "ripley_snell",
  "mrs_ulysses_swett",
  "dancies",
  "s_b_whitebait",
  "maurice_a_flink",
  "hammerheads",
  "beluga",
  "belugas_girls",
  "poles",
  "mulreadys",
  "cecil_roebuck",
  "cecil_schoen",
  "gulick",
  "newton_orchid",
  "eckhaust",
  "clyde_cohen",
  "don_s_schwartz",
  "arthur_mccarty",
  "catlips",
  "bembergs",
  "g_earl_muldoon",
  "muldoon",
  "da_fontano",
  "ed_legros",
  "james_b_ferret",
  "de_jongs",
  "ernest_lilly",
  "ewing_klipspringer",
  "henry_l_palmetto",
  "gus_waize",
  "horace_odonavan",
  "lester_myer",
  "george_duckweed",
  "francis_bull",
  "chromes",
  "backhyssons",
  "dennickers",
  "corrigans",
  "kellehers",
  "dewars",
  "scullys",
  "s_w_belcher",
  "smirkes",
  "young_quinns",
  "jaqueline",
  "consuela",
  "gloria",
  "judy",
  "june",
  "faustina_obrien",
  "baedeker_girls",
  "young_brewer",
  "albrucksburger",
  "miss_haag",
  "ardita_fitzpeters",
  "mr_p_jewett",
  "miss_claudia_hip",
  "claudia_hips_chauffeur",
  "prince_named_duke",
]);

interface ChapterIndexEntity {
  entityId: string;
  type: string;
  firstSeenInChapter: number;
  excerpt?: string;
}

interface ChapterIndexEntry {
  number: number;
  baselineIntro?: string;
  entities: ChapterIndexEntity[];
  [k: string]: unknown;
}

interface ChapterIndex {
  chapters: ChapterIndexEntry[];
}

function main() {
  const raw = readFileSync(CHAPTER_INDEX_PATH, "utf-8");
  const index = JSON.parse(raw) as ChapterIndex;

  const ch4 = index.chapters.find((c) => c.number === 4);
  if (!ch4) {
    console.error("Chapter 4 not found.");
    process.exit(1);
  }

  const before = ch4.entities.length;
  ch4.entities = ch4.entities.filter(
    (e) => !PARTY_INVITEE_ONLY_IDS.has(e.entityId)
  );
  const removed = before - ch4.entities.length;

  writeFileSync(CHAPTER_INDEX_PATH, JSON.stringify(index, null, 2) + "\n");
  console.log(
    `Removed ${removed} party-invitee-only entities from Gatsby chapter 4. Entities now: ${ch4.entities.length}.`
  );
}

main();
