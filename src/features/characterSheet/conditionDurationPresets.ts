import type { ConditionDuration, ConditionDurationKind, ConditionDurationSubject } from "./model";

export type ConditionDurationPresetKey =
  | ""
  | "save_ends"
  | "end_encounter"
  | "end_your_next"
  | "start_your_next"
  | "end_source_next"
  | "rounds";

export interface ConditionDurationPresetOption {
  key: ConditionDurationPresetKey;
  label: string;
}

export const CONDITION_DURATION_PRESET_OPTIONS: ConditionDurationPresetOption[] = [
  { key: "", label: "No duration" },
  { key: "save_ends", label: "Save ends" },
  { key: "end_encounter", label: "Until end of encounter" },
  { key: "end_your_next", label: "Until end of your next turn" },
  { key: "start_your_next", label: "Until start of your next turn" },
  { key: "end_source_next", label: "Until end of source's next turn" },
  { key: "rounds", label: "N rounds" }
];

const NONE_DURATION: ConditionDuration = { kind: "none", phrase: "" };

const PRESET_DURATIONS: Record<Exclude<ConditionDurationPresetKey, "" | "rounds">, ConditionDuration> = {
  save_ends: { kind: "save_ends", phrase: "save ends" },
  end_encounter: { kind: "end_encounter", phrase: "until the end of the encounter" },
  end_your_next: { kind: "end_turn", phrase: "until the end of your next turn", subject: "self" },
  start_your_next: { kind: "start_turn", phrase: "until the start of your next turn", subject: "self" },
  end_source_next: { kind: "end_turn", phrase: "until the end of source's next turn", subject: "source" }
};

export function buildDurationFromPreset(
  presetKey: ConditionDurationPresetKey,
  rounds = 1
): ConditionDuration {
  if (!presetKey) return { ...NONE_DURATION };
  if (presetKey === "rounds") {
    const n = Math.max(1, Math.min(99, Math.trunc(rounds)));
    return { kind: "rounds", phrase: `${n} round${n === 1 ? "" : "s"}`, rounds: n };
  }
  return { ...PRESET_DURATIONS[presetKey] };
}

export function conditionDurationDisplayPhrase(duration: ConditionDuration): string {
  return duration.phrase.trim();
}

export function durationSignature(duration: ConditionDuration): string {
  const base = duration.kind;
  const subject = duration.subject ?? "";
  const rounds = duration.kind === "rounds" ? String(duration.rounds ?? 0) : "";
  return `${base}|${subject}|${rounds}`;
}

export function areConditionDurationsEqual(a: ConditionDuration, b: ConditionDuration): boolean {
  return durationSignature(a) === durationSignature(b);
}

function isConditionDurationKind(value: unknown): value is ConditionDurationKind {
  return (
    value === "none" ||
    value === "save_ends" ||
    value === "save_ends_both" ||
    value === "save_ends_all" ||
    value === "end_encounter" ||
    value === "end_turn" ||
    value === "start_turn" ||
    value === "rounds"
  );
}

function isConditionDurationSubject(value: unknown): value is ConditionDurationSubject {
  return value === "self" || value === "target" || value === "source";
}

export function normalizeConditionDuration(raw: unknown): ConditionDuration {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...NONE_DURATION };
  }
  const o = raw as Record<string, unknown>;
  const kind = isConditionDurationKind(o.kind) ? o.kind : "none";
  const phrase = typeof o.phrase === "string" ? o.phrase.trim() : "";
  const subject = isConditionDurationSubject(o.subject) ? o.subject : undefined;
  if (kind === "rounds") {
    const rounds = typeof o.rounds === "number" && Number.isFinite(o.rounds) ? Math.max(1, Math.min(99, Math.trunc(o.rounds))) : 1;
    return buildDurationFromPreset("rounds", rounds);
  }
  if (kind === "none") {
    return { kind: "none", phrase: "" };
  }
  const preset = CONDITION_DURATION_PRESET_OPTIONS.find((opt) => {
    if (!opt.key || opt.key === "rounds") return false;
    const built = buildDurationFromPreset(opt.key);
    return built.kind === kind && (built.subject ?? "") === (subject ?? "");
  });
  if (preset?.key && preset.key !== "rounds") {
    return buildDurationFromPreset(preset.key);
  }
  return { kind, phrase: phrase || kind, ...(subject ? { subject } : {}) };
}
