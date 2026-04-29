import argparse
import json
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

from pypdf import PdfReader


PAGE_NUMBER_RE = re.compile(r"^\s*\d+\s*$")
TEMPLATE_REF_RE = re.compile(r"\b([A-Z][A-Za-z' -]{2,})\s*\(\s*template\s*\)", re.IGNORECASE)
TEMPLATE_IS_A_RE = re.compile(r"[\"“]?([A-Za-z][A-Za-z' -]{2,})[\"”]?\s+is a template", re.IGNORECASE)
TEMPLATE_HEADING_RE = re.compile(r"^\s*([A-Za-z][A-Za-z' -]{2,})\s+Template\s*$", re.IGNORECASE)
ROLE_LINE_RE = re.compile(
    r"^([A-Za-z][A-Za-z' -]{2,})\s+Elite\s+(Soldier|Brute|Controller|Skirmisher|Artillery|Lurker)$",
    re.IGNORECASE,
)
# Stat block starts here (name may include spaces e.g. "Ascetic of Vecna Elite Artillery").
ROLE_LINE_ELITE_ANCHOR_RE = re.compile(
    r"^(.+?)\s+Elite\s+(Soldier|Brute|Controller|Skirmisher|Artillery|Lurker)\b",
    re.IGNORECASE,
)
MONSTER_STATBLOCK_HEADER_RE = re.compile(
    r"^[A-Za-z][A-Za-z' -]{2,}\s+Level\s+\d+\s+(Minion|Standard|Elite|Solo)\s+(Soldier|Brute|Controller|Skirmisher|Artillery|Lurker)\b",
    re.IGNORECASE,
)
HEADER_TITLE_RE = re.compile(r"^[A-Z][A-Za-z' -]{2,}$")
STAT_LINE_RE = re.compile(
    r"^(Prerequisite:|Defenses\s*\+|Saving Throws|Action Points?|Hit Points\b(?=\s*[+\d-])|Resist|Immune|Vulnerable|Senses)\b",
    re.IGNORECASE,
)
SECTION_MARKER_RE = re.compile(
    r"^(POWERS|TRAITS|STANDARD\s*A\s*CTIONS|MOVE\s*A\s*CTIONS|MINOR\s*A\s*CTIONS|MAJOR\s*A\s*CTIONS)\b",
    re.IGNORECASE,
)


def _normalize_line(line: str) -> str:
    return re.sub(r"\s+", " ", line.replace("’", "'")).strip()


def _expand_block_lines_for_template_parsing(lines: List[str]) -> List[str]:
    """Split OCR-fused lines (role + Humanoid XP + aura pre-hit-points, etc.) for cleaner stat/power parsing."""

    def split_one(chunk: str) -> List[str]:
        chunk = chunk.strip()
        if not chunk:
            return []
        # Long fused blocks: narrative/aura paragraph then "Hit Points +…" — not "(when … 0 hit points or fewer)".
        if len(chunk) > 90 and re.search(r"\bHit Points\b(?=\s*[+\d-])", chunk, re.I):
            parts = re.split(r"\s+(?=Hit Points\b(?=\s*[+\d-]))", chunk, maxsplit=1, flags=re.I)
            if len(parts) == 2:
                return split_one(parts[0]) + split_one(parts[1])
        # "Chaos Warrior Elite Brute Humanoid XP Elite Destructive Wake aura 5; ..."
        m = re.match(
            r"^(.+?\bElite\s+(?:Soldier|Brute|Controller|Skirmisher|Artillery|Lurker))\s+"
            r"(Humanoid\s+XP\s+(?:Elite|Standard|Solo|Minion))\s+(.+)$",
            chunk,
            re.I,
        )
        if m:
            return [m.group(1).strip(), m.group(2).strip()] + split_one(m.group(3).strip())
        m2 = re.match(
            r"^(.+?\bElite\s+(?:Soldier|Brute|Controller|Skirmisher|Artillery|Lurker))\s+"
            r"(Humanoid(?:\s+or\s+magical\s+beast)?\s+XP\s+(?:Elite|Standard|Solo|Minion))\s+(.+)$",
            chunk,
            re.I,
        )
        if m2:
            return [m2.group(1).strip(), m2.group(2).strip()] + split_one(m2.group(3).strip())
        # "... Action Points 1 Devastating Assault Whenever a chaos warrior hits..."
        if len(chunk) > 100 and re.search(r"\bWhenever\b", chunk, re.I):
            wm = re.search(
                r"\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,5})\s+(Whenever\b.*)$",
                chunk,
                re.I | re.DOTALL,
            )
            if wm and len(wm.group(1).split()) <= 6:
                prefix = chunk[: wm.start()].strip()
                title = wm.group(1).strip()
                body = wm.group(2).strip()
                # Body may still contain "~ Second Power ..." or encounter headers — recurse on body only.
                return split_one(prefix) + [title] + split_one(body)
        # "... (save ends). ~ Destabilizing Breath (standard; encounter) ..." (OCR joins powers with ~)
        if "~" in chunk and len(chunk) > 80:
            idx = chunk.find("~")
            if idx > 30:
                left = chunk[:idx].rstrip()
                right = chunk[idx:].strip()
                if right.startswith("~") and len(right) > 5:
                    return [left] + split_one(right)
        # Mid-line encounter powers: "... text. Necrotic Bite (standard; encounter) ..."
        # Skip when the chunk is already a leading '~' power line — splitting would produce a junk "~" token.
        if (
            len(chunk) > 80
            and re.search(r"\(standard;\s*encounter\)", chunk, re.I)
            and not chunk.lstrip().startswith("~")
        ):
            enc = re.split(
                r"\s+(?=[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,6}\s*\(standard;\s*encounter\))",
                chunk,
                maxsplit=1,
                flags=re.I,
            )
            if len(enc) == 2 and enc[1].strip():
                return split_one(enc[0].strip()) + split_one(enc[1].strip())
        # "Destructive Wake aura 5; each enemy ..."
        am = re.match(r"^(.+?)\s+(aura\s+\d+\s*;\s*.+)$", chunk, re.I)
        if am:
            head = am.group(1).strip()
            tail = am.group(2).strip()
            if (
                len(head.split()) <= 6
                and len(head) <= 72
                and not head.lower().startswith("resist")
                and not head.lower().startswith("immune")
                and not head.lower().startswith("vulnerable")
            ):
                return [head, tail]
        return [chunk]

    out: List[str] = []
    for line in lines:
        out.extend(split_one(line))
    return out


def _normalize_name(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", name.lower())


def _title_case(name: str) -> str:
    return " ".join(part[:1].upper() + part[1:].lower() for part in name.split())


def _is_plausible_template_name(name: str) -> bool:
    clean = str(name or "").strip()
    if not clean:
        return False
    words = clean.split()
    if len(words) > 5:
        return False
    # OCR-runon noise commonly creates long single tokens (e.g., "Deathhunger").
    allow_single_word = {
        "Lich",
        "Shade",
        "Shades",
        "Wererat",
        "Werewolf",
        "Demagogue",
        "Devastator",
        "Feyborn",
        "Bodyguard",
    }
    if len(words) == 1 and len(clean) >= 11 and clean.title() not in allow_single_word:
        return False
    return True


def _is_template_tail_marker(line: str) -> bool:
    upper = line.upper()
    return (
        "MONSTER ABILITIES" in upper
        or upper.startswith("DUPLICA")
        or upper.startswith("CUSTOMIZING MONSTERS")
        or upper.startswith("CHAPTER ")
        or " FACTIONS AND FOES" in upper
        or upper.startswith("SONS OF ALAGONDAR")
        or line.startswith("4E_DMG_")
        or line.startswith("4E_")
        or "_Ch" in line
    )


def _looks_like_new_article_heading(line: str, template_name: str, next_line: str = "", powers_mode: bool = False) -> bool:
    clean = line.strip()
    if not clean:
        return False
    upper = clean.upper()
    if clean == upper and re.search(r"[A-Z]", clean):
        if any(token in upper for token in ("TRAITS", "POWERS", "ACTIONS", "REQUIREMENT", "ATTACK", "HIT", "EFFECT")):
            return False
        if _line_mentions_template_name(clean, template_name):
            return False
        return len(clean.split()) >= 2
    if re.fullmatch(r"[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,4}", clean):
        if _line_mentions_template_name(clean, template_name):
            return False
        if any(token in clean.lower() for token in ("shape", "bite", "claw", "stride", "regeneration", "aura")):
            return False
        next_lower = (next_line or "").strip().lower()
        # Avoid cutting valid trait/power names (often followed by "If ...", "Effect:", etc).
        if next_lower.startswith(("if ", "effect:", "attack:", "hit:", "miss:", "requirement:", "the were", "the shade")):
            return False
        # DMG template powers often use a title line plus body beginning "The monster ...".
        # Do not confuse that pattern with a sidebar/article heading once POWERS is open.
        if powers_mode and _looks_like_power_name(line):
            return False
        # Article/encounter headings are commonly followed by narrative prose starting with "The ...".
        if next_lower.startswith("the "):
            return True
        return False
    return False


def _is_noise(line: str) -> bool:
    if not line:
        return True
    if PAGE_NUMBER_RE.fullmatch(line):
        return True
    return False


def _to_lines(text: str) -> List[str]:
    lines = [_normalize_line(x) for x in text.replace("\x00", " ").splitlines()]
    return [x for x in lines if not _is_noise(x)]


def _is_index_page(lines: List[str]) -> bool:
    joined = " ".join(lines[:20]).lower()
    return "index" in joined and "(template)" in joined


def _scan_elite_role_anchors(lines: List[str]) -> List[tuple[int, str]]:
    """Find lines where an elite template stat block begins (Name Elite Role ...)."""

    out: List[tuple[int, str]] = []
    for idx, line in enumerate(lines):
        m = ROLE_LINE_ELITE_ANCHOR_RE.match(line.strip())
        if not m:
            continue
        raw = m.group(1).strip()
        name = _title_case(raw) if raw else ""
        if len(name) >= 3:
            out.append((idx, name))
    return out


def _find_next_template_content_start(lines: List[str], next_name: str, lo: int, hi: int) -> Optional[int]:
    """First line index in [lo, hi) where the next template's name begins (title or opening sentence)."""

    if lo >= hi or hi > len(lines):
        return None
    nl = next_name.strip().lower()
    if not nl:
        return None
    for j in range(lo, hi):
        raw = lines[j].strip()
        if not raw:
            continue
        low = raw.lower()
        if low == nl or low.startswith(nl + " ") or low.startswith(nl + "\u201c") or low.startswith(nl + '"'):
            return j
    return None


def _exclusive_end_before_next_elite_template(
    lines: List[str],
    this_role_idx: int,
    next_anchor: Optional[tuple[int, str]],
) -> int:
    """End index (exclusive) for lines belonging to the current template on this page."""

    if not next_anchor:
        return len(lines)
    r_next, name_next = next_anchor
    start_scan = this_role_idx + 1
    cs = _find_next_template_content_start(lines, name_next, start_scan, r_next)
    if cs is not None:
        return cs
    return r_next


def _extract_candidate_names(lines: List[str]) -> Set[str]:
    out: Set[str] = set()
    for line in lines:
        for m in TEMPLATE_REF_RE.finditer(line):
            candidate = m.group(1).strip()
            if not _is_plausible_template_name(candidate):
                continue
            out.add(candidate)
        for m in TEMPLATE_IS_A_RE.finditer(line):
            candidate = m.group(1).strip()
            if not _is_plausible_template_name(candidate):
                continue
            out.add(candidate)
        heading_match = TEMPLATE_HEADING_RE.match(line)
        if heading_match:
            candidate = heading_match.group(1).strip()
            if _is_plausible_template_name(candidate):
                out.add(candidate)
        role_match = ROLE_LINE_RE.match(line.strip())
        if role_match:
            candidate = role_match.group(1).strip()
            if _is_plausible_template_name(candidate):
                out.add(candidate)
    for _, anchor_name in _scan_elite_role_anchors(lines):
        out.add(anchor_name)
    # Neverwinter "shades" style builder block.
    for idx, line in enumerate(lines):
        if line.lower() == "shades":
            near = " ".join(lines[idx : min(len(lines), idx + 8)]).lower()
            if "to create a shade" in near:
                out.add("Shades")
    return out


def _is_headerish(line: str) -> bool:
    if len(line.split()) > 5:
        return False
    return bool(HEADER_TITLE_RE.match(line))


def _find_header_index(lines: List[str], template_name: str) -> Optional[int]:
    target = _normalize_name(template_name)
    template_heading_norm = _normalize_name(f"{template_name} Template")
    for idx, line in enumerate(lines):
        if _normalize_name(line) == target:
            return idx
    for idx, line in enumerate(lines):
        if _normalize_name(line) == template_heading_norm:
            return idx
    for idx, line in enumerate(lines):
        # Some layouts omit the standalone template heading and jump directly to role line.
        line_norm = _normalize_name(line)
        if target and line_norm.startswith(target) and "elite" in line_norm:
            return idx
    for idx, line in enumerate(lines):
        n = _normalize_name(line)
        if target and target in n and _is_headerish(line) and "template" in line.lower():
            return idx
    return None


def _line_mentions_template_name(line: str, template_name: str) -> bool:
    target = _normalize_name(template_name)
    if not target:
        return False
    return target in _normalize_name(line)


def _looks_like_power_name(line: str) -> bool:
    clean = re.sub(r"^[~\u2726\u2727\u2605✦.\s]+", "", line.strip()).strip()
    if STAT_LINE_RE.search(clean):
        return False
    # Elite template role lines ("Name Elite Brute") are never ability titles.
    if ROLE_LINE_ELITE_ANCHOR_RE.match(clean) or ROLE_LINE_RE.match(clean):
        return False
    # Tier scaling lines for Resist/Vulnerable/HP (DMG2 variable resist, etc.) — not power names.
    if re.match(r"^Level\s+\d+\s*:", clean, re.IGNORECASE):
        return False
    # Stat block boilerplate between role line and mechanics (DMG / DMG2 templates).
    if re.match(
        r"^Humanoid(?:\s+or\s+magical\s+beast)?\s+XP\s+(?:Elite|Standard|Solo|Minion)\b",
        clean,
        re.IGNORECASE,
    ):
        return False
    if re.match(r"^Keywords?\s", clean, re.IGNORECASE):
        return False
    # Action-prefixed powers use C/M/R/A only — avoid "A Creeping Rot" matching as A + C.
    if re.match(r"^[CMRA]\s+[A-Za-z]", clean):
        return True
    # OCR fuses long encounter headers; accept if a title-case name precedes '(' (e.g. DMG2 Chaos Warrior).
    head_before_paren = re.match(
        r"^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,6})\s*\(",
        clean,
    )
    if len(clean) > 80 and not head_before_paren and not re.search(r"(?:✦|[\u2726\u2727\u2605])", clean):
        return False
    if not clean:
        return False
    # Fused OCR lines often end with '.' even when the title before '(' is a valid header.
    if not head_before_paren and clean.endswith((".", ";", ",")):
        return False
    if clean.startswith(("✦", "Aura", "Effect:", "Attack:", "Hit:", "Miss:")):
        return False
    # Stat block / power-body continuations (not new power headers).
    if clean.startswith("(") and re.search(
        r"whichever|higher\)\s*(necrotic|acid|cold|fire|force|lightning|poison|psychic|radiant|thunder)\s+damage",
        clean,
        re.IGNORECASE,
    ):
        return False
    if re.match(r"^\(whichever", clean, re.IGNORECASE):
        return False
    if re.match(r"^vs\.\s*", clean, re.IGNORECASE):
        return False
    if re.match(
        r"^(Failed\s+Saving\s+Throw|Aftereffect|Aftereffect:|Additional\s+Effect):",
        clean,
        re.IGNORECASE,
    ):
        return False
    # Continuation sentences (previous power body); power names in 4e blocks are almost always title case.
    if clean[0].isalpha() and clean[0].islower():
        return False
    name_probe = (
        head_before_paren.group(1).strip()
        if head_before_paren
        else (clean.split("(", 1)[0].strip() if "(" in clean else clean)
    )
    words = name_probe.split()
    if len(words) > 7:
        return False
    alpha = sum(1 for ch in name_probe if ch.isalpha())
    if alpha < 3:
        return False
    if clean.lower() in {
        "acid",
        "cold",
        "fire",
        "force",
        "lightning",
        "necrotic",
        "poison",
        "psychic",
        "radiant",
        "thunder",
        "weapon",
    }:
        return False
    return True


def _extract_damage_expressions(text: str) -> List[str]:
    return re.findall(r"\b\d+d\d+(?:\s*\+\s*[^;,.]+)?", text, flags=re.IGNORECASE)


def _parse_recharge_details(text: str) -> str:
    """Lowest die face among Unicode dice (⚀…⚅) next to *recharge* — 4e recharge threshold."""
    # U+2680–U+2685 dice; strip VS-16 (U+FE0F) for emoji-presentation forms.
    normalized = unicodedata.normalize("NFC", text or "").replace("\ufe0f", "")
    values: List[int] = []
    for ch in normalized:
        o = ord(ch)
        if 0x2680 <= o <= 0x2685:
            values.append(o - 0x2680 + 1)
    if values:
        return str(min(values))
    match = re.search(r"recharge\s+(\d+)", normalized, flags=re.IGNORECASE)
    if match:
        return match.group(1)
    return ""


def _title_case_keyword_token(s: str) -> str:
    s = str(s or "").strip()
    if not s:
        return ""
    parts: List[str] = []
    for w in s.split():
        if not w:
            continue
        parts.append(w[:1].upper() + w[1:].lower() if len(w) > 1 else w.upper())
    return " ".join(parts)


def _parse_keyword_directive_line(line: str) -> List[str]:
    t = line.strip()
    if not re.match(r"^Keywords?\s", t, flags=re.IGNORECASE):
        return []
    m = re.match(r"^Keywords?\s*:?\s*(.+)$", t, flags=re.IGNORECASE)
    if not m:
        return []
    tail = m.group(1).strip()
    if not tail:
        return []
    out: List[str] = []
    for p in re.split(r",\s*|\s+and\s+", tail, flags=re.IGNORECASE):
        tok = _title_case_keyword_token(p.strip())
        if tok:
            out.append(tok)
    return out


_PAREN_TRAIT_KEYWORD_SKIP_RE = re.compile(
    r"\brecharge\b|\bstandard\b|\bminor\b|\bmove\b|\bfree\b|\bencounter\b|\bdaily\b|\bimmediate\b|\breaction\b",
    re.IGNORECASE,
)


def _extract_parenthetical_trait_keywords(header_line: str) -> List[str]:
    out: List[str] = []
    for m in re.finditer(r"\(([^)]+)\)", header_line):
        inner = m.group(1).strip()
        if not inner or len(inner) > 55:
            continue
        if ";" in inner:
            continue
        if _PAREN_TRAIT_KEYWORD_SKIP_RE.search(inner):
            continue
        for part in re.split(r"\s*,\s*", inner):
            tok = _title_case_keyword_token(part.strip())
            if tok:
                out.append(tok)
    return sorted(set(out))


def _merge_trait_keyword_lists(*groups: Optional[List[str]]) -> List[str]:
    s: Set[str] = set()
    for g in groups:
        if not g:
            continue
        for x in g:
            tok = _title_case_keyword_token(str(x))
            if tok:
                s.add(tok)
    return sorted(s)


def _normalize_power_to_monster_shape(
    name: str, text: str, lead_keywords: Optional[List[str]] = None
) -> Dict[str, Any]:
    raw_title_line = name.strip()
    header = raw_title_line
    body = text.strip()
    lead_m = re.match(r"^\s*(\([^)]*\))", body)
    if lead_m and not re.search(
        r"\brecharge\b|\bencounter\b|\bdaily\b", header, flags=re.IGNORECASE
    ):
        paren = lead_m.group(1)
        if re.search(r"\brecharge\b|\bencounter\b|\bdaily\b", paren, flags=re.IGNORECASE):
            header = f"{header} {paren.strip()}"
            body = body[lead_m.end() :].strip()
    action_type = ""

    action_prefix_match = re.match(r"^([CMRA])\s+(.+)$", header, flags=re.IGNORECASE)
    if action_prefix_match:
        code = action_prefix_match.group(1).upper()
        header = action_prefix_match.group(2).strip()
        action_type = {
            "C": "Close",
            "M": "Melee",
            "R": "Ranged",
            "A": "Area",
        }.get(code, "")

    usage = "At-Will"
    usage_details = ""
    if re.search(r"\brecharge\b", header, flags=re.IGNORECASE):
        usage = "Recharge"
        usage_details = _parse_recharge_details(header + "\n" + body)
        if not usage_details:
            usage_details = _parse_recharge_details(header)
        if not usage_details:
            usage_details = _parse_recharge_details(name.strip() + "\n" + text.strip())
    elif re.search(r"\bencounter\b", header, flags=re.IGNORECASE):
        usage = "Encounter"
    elif re.search(r"\bdaily\b", header, flags=re.IGNORECASE):
        usage = "Daily"

    action = ""
    action_match = re.search(
        r"\((standard|minor|move|free|immediate interrupt|immediate reaction|immediate)\b",
        header,
        flags=re.IGNORECASE,
    )
    if action_match:
        action = action_match.group(1).title()

    keywords_blob = ""
    flare_trait_tokens: List[str] = []
    kw_match = re.search(r"(?:✦|[\u2726\u2727\u2605])\s*(.+)$", header)
    if kw_match:
        flare_raw = kw_match.group(1).strip().rstrip(",")
        flare_trait_tokens = [
            _title_case_keyword_token(k.strip()) for k in flare_raw.split(",") if k.strip()
        ]
        keywords_blob = flare_raw
    body_for_parse = body
    if keywords_blob and body_for_parse:
        first_chunk = body_for_parse.split(";", 1)[0]
        if re.fullmatch(r"[A-Za-z ,/]+", first_chunk.strip()) and len(first_chunk.strip().split()) <= 3:
            keywords_blob = f"{keywords_blob}, {first_chunk.strip()}"
            body_for_parse = body_for_parse.split(";", 1)[1].strip() if ";" in body_for_parse else body_for_parse
    keyword_tokens = [k.strip() for k in keywords_blob.split(",") if k.strip()]

    attack_type = ""
    attack_range = ""
    leading_type_with_kw = re.match(
        r"^([A-Za-z]+)\s+(Close burst|Close blast|Melee|Ranged|Area burst|Area wall)\s+(\d+)",
        body_for_parse,
        re.IGNORECASE,
    )
    if leading_type_with_kw:
        leading_kw = leading_type_with_kw.group(1).strip()
        if leading_kw and leading_kw.lower() not in {k.lower() for k in keyword_tokens}:
            keyword_tokens.append(leading_kw)
            keywords_blob = ", ".join(keyword_tokens)
        attack_type = leading_type_with_kw.group(2).title()
        attack_range = f"{leading_type_with_kw.group(2).title()} {leading_type_with_kw.group(3)}"
    type_match = re.match(r"^(Close burst|Close blast|Melee|Ranged|Area burst|Area wall)\s+(\d+)", body_for_parse, re.IGNORECASE)
    if type_match:
        attack_type = type_match.group(1).title()
        attack_range = f"{type_match.group(1).title()} {type_match.group(2)}"
    if not action_type and attack_type:
        action_type = attack_type.split()[0]
    aura_match_header = re.search(r"\baura\s+(\d+)\b", header, flags=re.IGNORECASE)
    aura_match_body = re.search(r"^aura\s+(\d+)\b", body_for_parse, flags=re.IGNORECASE)
    aura_num = aura_match_header.group(1) if aura_match_header else (aura_match_body.group(1) if aura_match_body else "")
    if aura_num:
        attack_type = "Aura"
        attack_range = f"Aura {aura_num}"
        if not action_type:
            action_type = "Close"

    attacks: List[Dict[str, Any]] = []
    vs_match = re.search(r"level\s*\+\s*(\d+)\s+vs\.\s*(AC|Fortitude|Reflex|Will)", body_for_parse, re.IGNORECASE)
    if vs_match:
        attacks.append(
            {
                "kind": "MonsterAttack",
                "name": "Hit",
                "attackBonuses": [{"defense": vs_match.group(2).title(), "bonus": int(vs_match.group(1))}],
                "hit": {"description": body_for_parse},
            }
        )

    damage_expressions = _extract_damage_expressions(body_for_parse)
    clean_name = re.sub(r"\s*\(.*$", "", header).strip()
    clean_name = re.sub(r"\s*(?:✦|[\u2726\u2727\u2605]).*$", "", clean_name).strip()
    clean_name = re.sub(r"^[~.\s\u2726\u2727\u2605✦]+", "", clean_name).strip()
    clean_name = re.sub(r"\s{2,}", " ", clean_name).strip(" -;:,")

    trait_kw = _merge_trait_keyword_lists(
        lead_keywords,
        _extract_parenthetical_trait_keywords(raw_title_line),
        flare_trait_tokens if flare_trait_tokens else None,
    )

    payload: Dict[str, Any] = {
        "name": clean_name or header,
        "actionType": action_type,
        "usage": usage,
        "usageDetails": usage_details,
        "action": action,
        "trigger": "",
        "requirements": "",
        "type": attack_type,
        "isBasic": False,
        "tier": "",
        "flavorText": "",
        "keywords": keywords_blob,
        "keywordNames": keyword_tokens,
        "keywordTokens": keyword_tokens,
        "range": attack_range,
        "description": body_for_parse,
        "damageExpressions": damage_expressions,
        "attacks": attacks,
    }
    if trait_kw:
        payload["traitTemplateKeywords"] = trait_kw
    return payload


def _parse_powers(power_lines: List[str]) -> List[Dict[str, Any]]:
    def split_action_prefixed_power_lines(lines: List[str]) -> List[str]:
        out: List[str] = []
        for line in lines:
            text = line.strip()
            if not text:
                continue
            m = re.match(r"^([A-Z])\s+([A-Z][A-Za-z][^:]{2,})$", text)
            if m:
                # Keep as a standalone header; next line carries details.
                out.append(f"{m.group(1)} {m.group(2).strip()}")
                continue
            # OCR often fuses: "... target. C Unholy Flames (standard; ...)"
            fused = re.search(r"\s([A-Z]\s+[A-Z][A-Za-z][^:]{2,})$", text)
            if fused and "." in text:
                prefix = text[: fused.start()].strip()
                header = fused.group(1).strip()
                if prefix:
                    out.append(prefix)
                out.append(header)
                continue
            out.append(text)
        return out

    power_lines = split_action_prefixed_power_lines(power_lines)
    powers: List[Dict[str, Any]] = []
    pending_directive_keywords: List[str] = []
    current_name = ""
    current_text: List[str] = []
    current_lead_keywords: List[str] = []
    for line in power_lines:
        dir_kw = _parse_keyword_directive_line(line)
        if dir_kw:
            pending_directive_keywords.extend(dir_kw)
            continue
        if _looks_like_power_name(line):
            if current_name:
                powers.append(
                    _normalize_power_to_monster_shape(
                        current_name,
                        " ".join(current_text).strip(),
                        current_lead_keywords or None,
                    )
                )
            current_name = line.strip()
            current_text = []
            current_lead_keywords = list(pending_directive_keywords)
            pending_directive_keywords = []
            continue
        if current_name:
            current_text.append(line.strip())
    if current_name:
        powers.append(
            _normalize_power_to_monster_shape(
                current_name,
                " ".join(current_text).strip(),
                current_lead_keywords or None,
            )
        )
    return [p for p in powers if p.get("name")]


def _parse_role_line(role_line: str) -> Dict[str, Any]:
    text = str(role_line or "").strip()
    if not text:
        return {}
    payload: Dict[str, Any] = {"raw": text}
    m = re.match(
        r"^(?P<name>.+?)\s+(?P<tier>Minion|Standard|Elite|Solo)\s+(?P<role>Soldier|Brute|Controller|Skirmisher|Artillery|Lurker)\s*(?:\((?P<tags>[^)]+)\))?$",
        text,
        flags=re.IGNORECASE,
    )
    if not m:
        return payload
    payload["templateLabel"] = m.group("name").strip()
    payload["tier"] = m.group("tier").title()
    payload["combatRole"] = m.group("role").title()
    tags_raw = m.group("tags") or ""
    tags = [x.strip() for x in tags_raw.split(",") if x.strip()]
    if tags:
        payload["tags"] = tags
    return payload


def _infer_template_is_elite(role_line: str, raw_text: str) -> bool:
    line = str(role_line or "")
    text = str(raw_text or "")
    if re.search(r"\bElite\b", line, flags=re.IGNORECASE):
        return True
    if re.search(r"\bXP\s+Elite\b", text, flags=re.IGNORECASE):
        return True
    return False


def _coerce_int_from_text(text: str) -> Optional[int]:
    m = re.search(r"[-+]?\d+", text)
    return int(m.group(0)) if m else None


def _parse_hit_points_formula(formula: str) -> Dict[str, Any]:
    parsed: Dict[str, Any] = {}
    text = str(formula or "").strip()
    if not text:
        return parsed
    compact = re.sub(r"\s+", "", text.lower())
    per_level_match = re.search(r"([+-]?\d+)\s*per\s*level", text, flags=re.IGNORECASE)
    if per_level_match:
        parsed["per_level"] = int(per_level_match.group(1))
    elif "perlevel" in compact:
        compact_match = re.search(r"([+-]?\d+)perlevel", compact)
        if compact_match:
            parsed["per_level"] = int(compact_match.group(1))
    if "constitutionscore" in compact:
        parsed["add_constitution"] = True
    return parsed


_DAMAGE_TYPES = (
    "acid",
    "cold",
    "fire",
    "force",
    "lightning",
    "necrotic",
    "poison",
    "psychic",
    "radiant",
    "thunder",
)


def _parse_damage_type_tiers(tail: str) -> tuple[List[Dict[str, List[int]]], bool]:
    """Parse tiered damage-type scaling for Resist/Vulnerable stat lines.

    Example: ``5 necrotic at 1st level, 10 necrotic at 11th level, 15`` → ``[{"necrotic": [5, 10, 15]}]``.

    Returns (list of {damage_type: [tier_values...]}, parsed_ok). If no typed match, ([], False).
    """
    text = str(tail or "").strip()
    if not text:
        return [], False
    dmg_alt = "|".join(_DAMAGE_TYPES)
    typed_re = re.compile(rf"(\d+)\s*({dmg_alt})\b", re.IGNORECASE)
    pairs: List[tuple[int, str]] = [(int(m.group(1)), m.group(2).lower()) for m in typed_re.finditer(text)]
    if not pairs:
        return [], False

    by_type: Dict[str, List[int]] = {}
    for val, dmg in pairs:
        by_type.setdefault(dmg, []).append(val)

    # Trailing ", 15" with no damage keyword (OCR truncation of "15 necrotic at 21st level").
    last_comma = text.rfind(",")
    if last_comma >= 0 and pairs:
        after_comma = text[last_comma + 1 :].strip().rstrip("., ")
        if after_comma.isdigit():
            orphan = int(after_comma)
            last_type = pairs[-1][1].lower()
            tail_segment = text[last_comma + 1 :]
            if not typed_re.search(tail_segment) and orphan not in by_type.get(last_type, []):
                by_type.setdefault(last_type, []).append(orphan)

    out: List[Dict[str, List[int]]] = [{k: vals} for k, vals in by_type.items() if vals]
    return (out, True)


def _merge_damage_tier_entries(entries: List[Dict[str, List[int]]]) -> List[Dict[str, List[int]]]:
    merged: Dict[str, List[int]] = {}
    for item in entries:
        for key, vals in item.items():
            merged.setdefault(key, []).extend(vals)
    return [{key: vals} for key, vals in merged.items()]


def _strip_prerequisite_from_description(description: str, prerequisite: str) -> str:
    d = str(description or "").strip()
    if not d:
        return d
    d = re.sub(r"\bPrerequisite:\s*[^\n]+", "", d, flags=re.IGNORECASE).strip()
    p = str(prerequisite or "").strip()
    if p:
        d = re.sub(re.escape(f"Prerequisite: {p}"), "", d, flags=re.IGNORECASE).strip()
    return re.sub(r"\s{2,}", " ", d).strip()


def _merge_stat_line_continuations(stat_lines: List[str]) -> List[str]:
    merged: List[str] = []
    for raw in stat_lines or []:
        line = str(raw or "").strip()
        if not line:
            continue
        if (
            merged
            and re.match(r"^Defenses\b", merged[-1], flags=re.IGNORECASE)
            and not STAT_LINE_RE.match(line)
            and not _looks_like_power_name(line)
        ):
            merged[-1] = f"{merged[-1]} {line}"
            continue
        merged.append(line)
    return merged


def _extract_template_description(raw_text: str, role_line: str, is_elite: bool) -> str:
    """Prose before the mechanical stat block: Elite templates start after roleLine; non-elite (e.g. Neverwinter) often at TRAITS."""

    raw = str(raw_text or "").strip()
    if not raw:
        return ""
    rl = str(role_line or "").strip()

    if is_elite and rl:
        idx = raw.find(rl)
        if idx >= 0:
            return raw[:idx].strip()

    mtraits = re.search(r"\bTRAITS\b", raw, flags=re.IGNORECASE)
    if mtraits:
        return raw[: mtraits.start()].strip()

    mpowers = re.search(r"\bPOWERS\b", raw, flags=re.IGNORECASE)
    if mpowers:
        return raw[: mpowers.start()].strip()

    msections = re.search(
        r"\b(MOVE\s*ACTIONS|STANDARD\s*ACTIONS|MINOR\s*ACTIONS)\b",
        raw,
        flags=re.IGNORECASE,
    )
    if msections:
        return raw[: msections.start()].strip()

    return raw.strip()


def _parse_stat_lines(stat_lines: List[str]) -> Dict[str, Any]:
    result: Dict[str, Any] = {}
    defenses: Dict[str, int] = {}
    defense_notes: List[str] = []
    immunities: List[str] = []
    resistances_parts: List[Dict[str, List[int]]] = []
    resistance_notes: List[str] = []
    vulnerabilities_parts: List[Dict[str, List[int]]] = []
    vulnerability_notes: List[str] = []
    senses: List[str] = []
    unparsed_stat_lines: List[str] = []

    for raw in stat_lines:
        raw_line = str(raw or "").strip()
        if not raw_line:
            continue
        line = re.sub(r"([A-Za-z])\s+([A-Za-z])", r"\1\2", raw_line)
        lower = line.lower()
        compact = re.sub(r"\s+", "", lower)
        raw_lower = raw_line.lower()
        raw_compact = re.sub(r"\s+", "", raw_lower)
        parsed = False

        if lower.startswith("prerequisite:") or compact.startswith("prerequisite:"):
            parsed = True
            continue

        if lower.startswith("defenses") or compact.startswith("defenses"):
            # "to all defenses against …" must be read before single-letter space collapse (which would destroy the phrase).
            defense_for_all = re.sub(r"^defenses\s*", "", raw_line, flags=re.IGNORECASE)
            m_all = re.search(
                r"\+(\d+)\s+to\s+all\s+defenses\s+against\s+(.+?)(?=;|$)",
                defense_for_all,
                flags=re.IGNORECASE | re.DOTALL,
            )
            defense_tail = re.sub(r"^defenses\s*", "", line, flags=re.IGNORECASE)
            # OCR sometimes collapses spaces/punctuation in defense lines.
            defense_tail = defense_tail.replace(";", ",")
            defense_tail = re.sub(r"([A-Za-z])\+([0-9])", r"\1 +\2", defense_tail)
            defense_tail = re.sub(r"([0-9])([A-Za-z])", r"\1 \2", defense_tail)
            local_found = False
            # "AC +2" form
            for m in re.finditer(r"\b(AC|Fortitude|Reflex|Will)\b\s*\+?\s*(-?\d+)", defense_tail, flags=re.IGNORECASE):
                key = m.group(1).strip().upper()
                value = int(m.group(2))
                defenses[key] = value
                local_found = True
            # "+2 AC" form
            for m in re.finditer(r"\+?\s*(-?\d+)\s*(AC|Fortitude|Reflex|Will)\b", defense_tail, flags=re.IGNORECASE):
                key = m.group(2).strip().upper()
                value = int(m.group(1))
                defenses[key] = value
                local_found = True
            if m_all:
                phrase = m_all.group(2).strip().rstrip(".").strip()
                defenses[f"to all defenses against {phrase}"] = int(m_all.group(1))
                local_found = True
            if "all defenses" in defense_for_all.lower() and not m_all:
                defense_notes.append(defense_for_all.strip())
            parsed = local_found or bool(defense_notes)
            if parsed:
                continue

        if lower.startswith("saving throws") or compact.startswith("savingthrows"):
            v = _coerce_int_from_text(line)
            if v is not None:
                result["savingThrows"] = v
                parsed = True
                # keep trailing notes such as "+4 against poison effects"
                if ";" in line:
                    tail = line.split(";", 1)[1].strip()
                    if tail:
                        result.setdefault("savingThrowNotes", []).append(tail)
                continue

        if (
            lower.startswith("action point")
            or lower.startswith("action points")
            or compact.startswith("actionpoint")
            or compact.startswith("actionpoints")
        ):
            v = _coerce_int_from_text(line)
            if v is not None:
                result["actionPoints"] = v
                parsed = True
                continue

        if lower.startswith("hit points") or compact.startswith("hitpoints"):
            hp_formula_match = re.match(r"^hit\s*points?\s*(.*)$", line, flags=re.IGNORECASE)
            hp_formula = hp_formula_match.group(1).strip() if hp_formula_match else line
            hit_points = _parse_hit_points_formula(hp_formula)
            if hit_points:
                result["hitPoints"] = hit_points
            parsed = True
            continue

        if lower.startswith("senses") or compact.startswith("senses"):
            sense_match = re.match(r"^senses\s*(.*)$", line, flags=re.IGNORECASE)
            value = sense_match.group(1).strip() if sense_match else ""
            if value:
                senses.extend([x.strip() for x in re.split(r"[;,]", value) if x.strip()])
                parsed = True
                continue

        if lower.startswith("immune") or compact.startswith("immune"):
            immune_match = re.match(r"^immune\s*(.*)$", line, flags=re.IGNORECASE)
            value = immune_match.group(1).strip() if immune_match else ""
            if value:
                immunities.extend([x.strip() for x in re.split(r"[;,]", value) if x.strip()])
                parsed = True
                continue

        # Parse from raw_line: OCR cleanup merges small gaps ("necrotic at" -> "necroticat") and breaks \\b boundaries.
        if raw_lower.startswith("resist") or raw_compact.startswith("resist"):
            resist_match = re.match(r"^resist\s*(.*)$", raw_line, flags=re.IGNORECASE)
            value = resist_match.group(1).strip() if resist_match else ""
            if value:
                structured, ok = _parse_damage_type_tiers(value)
                if ok:
                    resistances_parts.extend(structured)
                else:
                    resistance_notes.append(value)
                parsed = True
                continue

        # Parse from raw_line (same as Resist — fusion breaks "radiant at" etc.).
        if raw_lower.startswith("vulnerable") or raw_compact.startswith("vulnerable"):
            vuln_match = re.match(r"^vulnerable\s*(.*)$", raw_line, flags=re.IGNORECASE)
            value = vuln_match.group(1).strip() if vuln_match else ""
            if value:
                structured, ok = _parse_damage_type_tiers(value)
                if ok:
                    vulnerabilities_parts.extend(structured)
                else:
                    vulnerability_notes.append(value)
                parsed = True
                continue

        if not parsed:
            unparsed_stat_lines.append(line)

    if defenses:
        result["defenses"] = defenses
    if defense_notes:
        result["defenseNotes"] = defense_notes
    if senses:
        result["senses"] = senses
    if immunities:
        result["immunities"] = immunities
    if resistances_parts:
        result["resistances"] = _merge_damage_tier_entries(resistances_parts)
    if resistance_notes:
        result["resistanceNotes"] = resistance_notes
    if vulnerabilities_parts:
        result["vulnerabilities"] = _merge_damage_tier_entries(vulnerabilities_parts)
    if vulnerability_notes:
        result["vulnerabilityNotes"] = vulnerability_notes
    if unparsed_stat_lines:
        result["unparsedStatLines"] = unparsed_stat_lines
    return result


def _extract_document_sidebar_notes(
    pages: List[List[str]], known_template_names: Set[str]
) -> Dict[str, List[str]]:
    notes: Dict[str, List[str]] = {}
    known_by_norm = {_normalize_name(x): _title_case(x) for x in known_template_names if _normalize_name(x)}

    for page in pages:
        for idx, line in enumerate(page):
            upper = line.upper()
            if "SOUL WEAPON" not in upper:
                continue
            block_lines = [line]
            for follow in page[idx + 1 : idx + 26]:
                if ROLE_LINE_RE.match(follow.strip()):
                    break
                if TEMPLATE_IS_A_RE.search(follow):
                    break
                if _is_template_tail_marker(follow) and "SOUL WEAPON" not in follow.upper():
                    break
                block_lines.append(follow)
            text = " ".join(block_lines).strip()
            if not text:
                continue
            lowered_norm = _normalize_name(text)
            for norm_name, display_name in known_by_norm.items():
                if norm_name and norm_name in lowered_norm:
                    notes.setdefault(display_name, []).append(text)
            if "deathknight" in lowered_norm:
                notes.setdefault("Death Knight", []).append(text)
    return notes


def _build_template_row(
    name: str,
    pdf_name: str,
    page_start: int,
    parsed: Dict[str, Any],
    extraction_method: str,
) -> Dict[str, Any]:
    role_line_str = str(parsed.get("roleLine", "") or "")
    raw_text_str = str(parsed.get("rawText", "") or "")
    is_elite = _infer_template_is_elite(role_line_str, raw_text_str)
    prereq = str(parsed.get("prerequisite", "") or "").strip()
    stat_lines_merged = _merge_stat_line_continuations(list(parsed.get("statLines") or []))
    desc_base = _extract_template_description(raw_text_str, role_line_str, is_elite)
    if prereq:
        description = _strip_prerequisite_from_description(desc_base, prereq)
    else:
        description = re.sub(r"\bPrerequisite:\s*[^\n]+", "", desc_base, flags=re.IGNORECASE).strip()
    return {
        "templateName": _title_case(name),
        "sourceBook": pdf_name,
        "pageStart": page_start,
        "pageEnd": page_start,
        "description": description,
        "prerequisite": parsed.get("prerequisite", ""),
        "roleLine": parsed.get("roleLine", ""),
        "role": _parse_role_line(role_line_str),
        "isEliteTemplate": is_elite,
        "statLines": stat_lines_merged,
        "stats": _parse_stat_lines(stat_lines_merged),
        "auras": parsed.get("auras", []),
        "traits": parsed.get("traits", []),
        "powers": parsed.get("powers", []),
        "uncategorizedAbilities": parsed.get("uncategorizedAbilities", []),
        "powersText": parsed.get("powersText", []),
        "rawText": parsed.get("rawText", ""),
        "relatedFlavorText": [],
        "extractionMethod": extraction_method,
    }


def _looks_like_class_build_entry(row: Dict[str, Any]) -> bool:
    name = str(row.get("templateName") or "").strip().lower()
    raw = str(row.get("rawText") or "").lower()
    role = str(row.get("roleLine") or "").lower()
    class_template_names = {
        "avenger",
        "barbarian",
        "bard",
        "cleric",
        "fighter",
        "paladin",
        "ranger",
        "rogue",
        "warlock",
        "warlord",
        "wizard",
    }
    if name in class_template_names:
        return True
    # Class-build pages typically include power-source/proficiency/class feature lists.
    class_build_markers = [
        "power source:",
        "weapon proficiency",
        "armor proficiency",
        "trained skills",
        "class features",
        "implements ",
    ]
    if any(marker in raw for marker in class_build_markers):
        return True
    # Very short single-word names with empty prerequisite often come from class blocks.
    if len(name.split()) == 1 and not row.get("prerequisite") and "elite" in role and len(raw) > 1200:
        return True
    return False


def _normalize_template_key(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", str(name or "").lower())


def _quality_score(row: Dict[str, Any]) -> int:
    score = 0
    raw_len = len(str(row.get("rawText") or ""))
    traits = len(row.get("traits") or [])
    auras = len(row.get("auras") or [])
    powers = len(row.get("powers") or [])
    if row.get("roleLine"):
        score += 3
    if row.get("prerequisite"):
        score += 2
    score += min(traits + auras + powers, 6)
    score += 2 if raw_len <= 2200 else 0
    # Penalty for obvious bleed into chapter/article text.
    bleed_tokens = ("chapter ", "customiz", "sons of alagondar", "index ")
    if any(tok in str(row.get("rawText") or "").lower() for tok in bleed_tokens):
        score -= 4
    return score


def _add_extraction_warnings(row: Dict[str, Any]) -> None:
    warnings: List[str] = []
    raw = str(row.get("rawText") or "")
    raw_lower = raw.lower()
    traits = len(row.get("traits") or [])
    auras = len(row.get("auras") or [])
    powers = len(row.get("powers") or [])
    if len(raw) > 2600:
        warnings.append("longRawText")
    if traits + auras + powers > 15:
        warnings.append("highAbilityCount")
    if traits + auras + powers == 0:
        warnings.append("noParsedAbilities")
    if row.get("isEliteTemplate") and not row.get("roleLine"):
        warnings.append("eliteWithoutRoleLine")
    if any(
        tok in raw_lower
        for tok in (
            "chapter ",
            "customiz",
            "sons of alagondar",
            "index ",
            "player's handbook",
            "here are general guidelines",
            "follow the normal method for applying a template",
        )
    ):
        warnings.append("possibleBoundaryBleed")
    if warnings:
        row["extractionWarnings"] = warnings
    else:
        row["extractionWarnings"] = []


def _build_etl_report(
    *,
    pdfs: List[Path],
    kept_templates: List[Dict[str, Any]],
    sanity_rejected: List[Dict[str, Any]],
    skipped_pdfs: List[dict],
    uncategorized_abilities: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Per-sourcebook summary and entries that may need manual ETL review."""

    by_template_uc: Dict[Tuple[str, str, int], List[Dict[str, Any]]] = {}
    for u in uncategorized_abilities or []:
        key = (str(u.get("templateName") or ""), str(u.get("sourceBook") or ""), int(u.get("pageStart") or 0))
        by_template_uc.setdefault(key, []).append(u)

    books_order = sorted({p.name for p in pdfs})
    books_from_data = {str(t.get("sourceBook") or "") for t in kept_templates}
    books_from_data |= {str(r.get("sourceBook") or "") for r in sanity_rejected}
    books_from_data |= {str(s.get("sourceBook") or "") for s in skipped_pdfs}
    for name in sorted(books_from_data):
        if name and name not in books_order:
            books_order.append(name)

    def flagged_issues(row: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        name = str(row.get("templateName") or "")
        book = str(row.get("sourceBook") or "")
        page = int(row.get("pageStart") or 0)
        warnings_list = list(row.get("extractionWarnings") or [])
        uc_list = by_template_uc.get((name, book, page), [])
        flavor = row.get("relatedFlavorText") or []
        reasons: List[str] = []
        for w in warnings_list:
            reasons.append(f"warning:{w}")
        if uc_list:
            reasons.append("uncategorizedAbilities")
        if flavor:
            reasons.append("relatedFlavorText")
        if not reasons:
            return None
        out: Dict[str, Any] = {
            "templateName": name,
            "pageStart": page,
            "issueReasons": reasons,
        }
        if warnings_list:
            out["extractionWarnings"] = warnings_list
        if uc_list:
            out["uncategorizedAbilities"] = [
                {
                    "abilityName": x.get("abilityName"),
                    "usage": x.get("usage"),
                    "action": x.get("action"),
                }
                for x in uc_list
            ]
        if flavor:
            out["relatedFlavorTextCount"] = len(flavor)
        raw_len = len(str(row.get("rawText") or ""))
        traits = len(row.get("traits") or [])
        auras = len(row.get("auras") or [])
        powers = len(row.get("powers") or [])
        out["metrics"] = {
            "rawTextLength": raw_len,
            "traitsCount": traits,
            "aurasCount": auras,
            "powersCount": powers,
        }
        return out

    by_book: List[Dict[str, Any]] = []
    all_flagged: List[Dict[str, Any]] = []

    for book in books_order:
        if not book:
            continue
        book_skipped = next((s for s in skipped_pdfs if s.get("sourceBook") == book), None)
        book_kept = [t for t in kept_templates if str(t.get("sourceBook") or "") == book]
        book_rejected = [r for r in sanity_rejected if str(r.get("sourceBook") or "") == book]
        flagged: List[Dict[str, Any]] = []
        for row in book_kept:
            issue = flagged_issues(row)
            if issue:
                issue["sourceBook"] = book
                flagged.append(issue)
                all_flagged.append(issue)
        rejected_enriched: List[Dict[str, Any]] = []
        for r in book_rejected:
            rr = dict(r)
            rr.setdefault(
                "issueReasons",
                ["sanityRejected"]
                + [f"warning:{w}" for w in (r.get("extractionWarnings") or [])],
            )
            rejected_enriched.append(rr)
        by_book.append(
            {
                "sourceBook": book,
                "pdfReadError": book_skipped.get("error") if book_skipped else None,
                "templatesKeptCount": len(book_kept),
                "sanityRejectedCount": len(book_rejected),
                "entriesFlaggedForReview": flagged,
                "sanityRejectedTemplates": rejected_enriched,
            }
        )

    summary = {
        "pdfCount": len(pdfs),
        "skippedPdfCount": len(skipped_pdfs),
        "templatesKept": len(kept_templates),
        "sanityRejectedCount": len(sanity_rejected),
        "entriesFlaggedForReviewCount": len(all_flagged),
        "booksWithReviewFlags": len([b for b in by_book if b.get("entriesFlaggedForReview")]),
    }

    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "summary": summary,
        "byBook": by_book,
        "entriesFlaggedForReview": sorted(all_flagged, key=lambda x: (x.get("sourceBook", ""), x.get("templateName", ""))),
    }


def _fails_sanity_pass(row: Dict[str, Any]) -> bool:
    warnings = set(row.get("extractionWarnings") or [])
    raw_len = len(str(row.get("rawText") or ""))
    powers = len(row.get("powers") or [])
    traits = len(row.get("traits") or [])
    auras = len(row.get("auras") or [])
    role_line = str(row.get("roleLine") or "").strip()
    total_abilities = powers + traits + auras
    if "possibleBoundaryBleed" in warnings:
        return True
    if "noParsedAbilities" in warnings and raw_len > 900:
        return True
    if row.get("isEliteTemplate") and not role_line:
        return True
    if raw_len > 2800 and total_abilities <= 3:
        return True
    return False


def _is_aura_ability(entry: Dict[str, Any]) -> bool:
    name = str(entry.get("name") or "").lower()
    desc = str(entry.get("description") or "").lower()
    ability_range = str(entry.get("range") or "").lower()
    return "aura" in name or desc.startswith("aura ") or ability_range.startswith("aura ")


def _is_trait_ability(entry: Dict[str, Any]) -> bool:
    """Passive template features: no explicit action type, default at-will only, no attack power shape.

    A real *power* carries (standard/minor/move/immediate), encounter/daily/recharge usage, or an
    attack line (blast/melee vs. defense). Everything else stays a trait even when the book prints
    it under POWERS (e.g., marks, passives)."""

    action = str(entry.get("action") or "").strip()
    usage = str(entry.get("usage") or "").strip().lower()
    action_type = str(entry.get("actionType") or "").strip().lower()
    attack_kind = str(entry.get("type") or "").strip().lower()
    attack_range = str(entry.get("range") or "").strip()
    attacks = entry.get("attacks") or []
    header_blob = f"{entry.get('name') or ''} {entry.get('keywords') or ''}"

    if action:
        return False
    if usage in {"encounter", "daily", "recharge"}:
        return False
    if attacks:
        return False
    # C/M/R/A-style action types from attack headers or blast/melee lines.
    if action_type in {"melee", "ranged", "close", "area"}:
        return False
    if attack_kind and "aura" not in attack_kind:
        return False
    if attack_range:
        rl = attack_range.lower()
        if not rl.startswith("aura"):
            return False
    if re.search(r"\((standard|minor|move|free|immediate)", header_blob, re.I):
        return False
    if re.search(r"\b(encounter|daily)\s*[;,)]|\brecharge\b", header_blob, re.I):
        return False
    return True


def _parse_trait_range(entry: Dict[str, Any]) -> int:
    name = str(entry.get("name") or "")
    rng = str(entry.get("range") or "")
    desc = str(entry.get("description") or "")
    for text in (rng, name, desc):
        m = re.search(r"\baura\s+(\d+)\b", text, flags=re.IGNORECASE)
        if m:
            return int(m.group(1))
    return 0


def _to_monster_trait_shape(entry: Dict[str, Any]) -> Dict[str, Any]:
    from_lead = [str(x).strip() for x in (entry.get("traitTemplateKeywords") or []) if str(x).strip()]
    from_name = _extract_parenthetical_trait_keywords(str(entry.get("name") or ""))
    merged_kw = _merge_trait_keyword_lists(
        from_lead if from_lead else None,
        from_name if from_name else None,
    )
    row: Dict[str, Any] = {
        "name": str(entry.get("name") or "").strip(),
        "details": str(entry.get("description") or "").strip(),
        "range": _parse_trait_range(entry),
        "type": "Trait",
    }
    if merged_kw:
        row["keywords"] = merged_kw
    return row


def _bucket_template_abilities(entries: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    auras: List[Dict[str, Any]] = []
    traits: List[Dict[str, Any]] = []
    powers: List[Dict[str, Any]] = []
    uncategorized: List[Dict[str, Any]] = []
    for entry in entries:
        if _is_aura_ability(entry):
            auras.append(_to_monster_trait_shape(entry))
            continue
        if _is_trait_ability(entry):
            traits.append(_to_monster_trait_shape(entry))
            continue
        # Fallback: anything with action/usage/attack profile is treated as a power.
        if entry.get("action") or str(entry.get("usage") or "").lower() != "at-will" or entry.get("type") or entry.get("range") or entry.get("attacks"):
            powers.append(entry)
            continue
        # Final fallback still keeps data visible as power, but records it for review.
        powers.append(entry)
        uncategorized.append(entry)
    return {"auras": auras, "traits": traits, "powers": powers, "uncategorized": uncategorized}


def _extract_block_from_page(
    lines: List[str],
    header_idx: int,
    next_lines: List[str],
    template_name: str,
    known_template_names: Set[str],
) -> Dict[str, object]:
    tail = lines[header_idx:]
    target_norm = _normalize_name(template_name)
    early = tail[:35]
    mention_count = sum(1 for line in early if target_norm and target_norm in _normalize_name(line))
    if mention_count < 2 and template_name.lower() != "shades":
        return {}
    for line in early:
        if _normalize_name(line) == "lich" and target_norm != "lich":
            return {}
    has_template_markers = any(
        (STAT_LINE_RE.search(line) or SECTION_MARKER_RE.search(line)) for line in tail[:40]
    )
    if not has_template_markers:
        return {}

    known_norm = {_normalize_name(x) for x in known_template_names}
    block_lines: List[str] = []
    skipping_sidebar = False
    sidebar_buffer: List[str] = []
    sidebar_by_template: Dict[str, List[str]] = {}

    def flush_sidebar_buffer() -> None:
        nonlocal sidebar_buffer
        if not sidebar_buffer:
            return
        text = " ".join(sidebar_buffer).strip()
        sidebar_buffer = []
        if not text:
            return
        lowered = text.lower()
        mentioned: List[str] = []
        for template in known_template_names:
            normalized = _normalize_name(template)
            if not normalized:
                continue
            if normalized in _normalize_name(text):
                mentioned.append(_title_case(template))
        if "death knight" in lowered and "Death Knight" not in mentioned:
            mentioned.append("Death Knight")
        # We only keep sidebar text that clearly points at a different template.
        for template_name in mentioned:
            if _normalize_name(template_name) == target_norm:
                continue
            sidebar_by_template.setdefault(template_name, []).append(text)

    def _line_is_strong_template_starter(text: str) -> bool:
        if not text:
            return False
        if text.lower().startswith("prerequisite:"):
            return True
        if ROLE_LINE_RE.match(text.strip()) or ROLE_LINE_ELITE_ANCHOR_RE.match(text.strip()):
            return True
        # Require explicit stat-prefix context, not generic section markers.
        if re.match(r"^(Senses|Defenses|Saving Throws|Action Points?|Hit Points|Resist|Immune|Vulnerable)\b", text, flags=re.IGNORECASE):
            return True
        return False

    def _looks_like_new_template_intro(source_lines: List[str], idx: int, line: str) -> bool:
        if idx < 16:
            return False
        clean = line.strip()
        if not clean:
            return False
        if len(clean.split()) > 5:
            return False
        # Title-case heading line, often next template/article start.
        if not re.fullmatch(r"[A-Z][A-Za-z' -]{2,}", clean):
            return False
        if _line_mentions_template_name(clean, template_name):
            return False
        lookahead = source_lines[idx + 1 : idx + 8]
        return any(_line_is_strong_template_starter(candidate) for candidate in lookahead)

    def _should_continue_to_next_page(next_page_lines: List[str]) -> bool:
        if not next_page_lines:
            return False
        window = next_page_lines[:36]
        target_mentions = sum(1 for line in window if _line_mentions_template_name(line, template_name))
        has_section_or_stat = any(
            SECTION_MARKER_RE.search(line)
            or STAT_LINE_RE.search(line)
            or _line_is_strong_template_starter(line)
            for line in window
        )
        has_role_or_prereq = any(
            line.lower().startswith("prerequisite:") or ROLE_LINE_RE.match(line.strip()) for line in window
        )
        # Continue only when early next-page content still looks like same template.
        # This avoids dragging in unrelated narrative/articles after page breaks.
        return target_mentions >= 1 or has_role_or_prereq or has_section_or_stat

    def consume_lines(source_lines: List[str], is_continuation: bool) -> bool:
        nonlocal skipping_sidebar
        seen_template_sections = False
        seen_prereq_or_role = False
        powers_mode = False
        for idx, line in enumerate(source_lines):
            line_norm = _normalize_name(line)
            if (
                idx > (2 if is_continuation else 8)
                and line_norm in known_norm
                and line_norm != target_norm
                and _is_headerish(line)
            ):
                return True
            if idx > (4 if is_continuation else 10):
                # Stop when we run into a full monster stat block header unrelated to this template.
                if MONSTER_STATBLOCK_HEADER_RE.match(line.strip()) and not _line_mentions_template_name(
                    line, template_name
                ):
                    return True

            # DMG layout can inject non-template sidebars between a template heading and its rule body.
            # Skip through that noise and resume when this template name appears again.
            if _is_template_tail_marker(line):
                skipping_sidebar = True
                sidebar_buffer.append(line)
                continue
            if SECTION_MARKER_RE.search(line):
                seen_template_sections = True
                powers_mode = True
            if line.lower().startswith("prerequisite:") or ROLE_LINE_RE.match(line.strip()):
                seen_prereq_or_role = True
            if seen_template_sections and idx > (6 if is_continuation else 14):
                next_line = source_lines[idx + 1] if idx + 1 < len(source_lines) else ""
                if _looks_like_new_article_heading(line, template_name, next_line, powers_mode):
                    return True
            # If we've entered template body, stop on strong narrative/article signals.
            if (seen_template_sections or seen_prereq_or_role) and idx > (8 if is_continuation else 16):
                lower = line.lower()
                compact = re.sub(r"[^a-z0-9]+", "", lower)
                if any(
                    marker in lower
                    for marker in (
                        "other neverwinter factions",
                        "theme tie-in",
                        "encounters",
                        "class templates allow you to add features",
                        "if you are modifying a nonplayer character",
                        "class templates",
                        "monsters, powers, and attack bonuses",
                        "follow the normal method for applying a template",
                        "here are general guidelines",
                        "at-will attack powers",
                    )
                ):
                    return True
                if any(
                    marker in compact
                    for marker in (
                        "classtemplates",
                        "monsterspowersandattackbonuses",
                        "followthenormalmethodforapplyingatemplate",
                        "herearegeneralguidelines",
                        "atwillattackpowers",
                    )
                ):
                    return True
                if re.match(r"^[A-Z][A-Za-z' -]{2,}\s+This template\b", line):
                    return True
                if re.match(r"^[A-Z][A-Za-z' -]{2,}\s+is an expert\b", line):
                    return True
                if re.match(r"^[A-Z][A-Za-z' -]{2,}\s+creatures?\b", line):
                    return True
                # Section-anchored cutoff: new heading + immediate stat/template markers.
                if powers_mode and idx > (14 if is_continuation else 24) and _looks_like_new_template_intro(source_lines, idx, line):
                    return True
            if skipping_sidebar:
                # Sidebar boxes (e.g. "DUPLICATE ... MONSTER ABILITIES") sit between templates.
                # Do not buffer until the current template name reappears — that never happens,
                # so the buffer would swallow the next template and flush_sidebar_buffer would
                # mis-attribute the sidebar to any template name substring-matched in that blob.
                stripped_side = line.strip()
                anchor_match = ROLE_LINE_ELITE_ANCHOR_RE.match(stripped_side)
                if anchor_match:
                    anchor_key = _normalize_name(_title_case(anchor_match.group(1).strip()))
                    if anchor_key and anchor_key != target_norm:
                        sidebar_buffer.clear()
                        skipping_sidebar = False
                        return True
                    if anchor_key and anchor_key == target_norm:
                        flush_sidebar_buffer()
                        skipping_sidebar = False
                elif _line_mentions_template_name(line, template_name):
                    flush_sidebar_buffer()
                    skipping_sidebar = False
                else:
                    sidebar_buffer.append(line)
                    continue

            block_lines.append(line)
            if len(block_lines) >= 180:
                return True
        return False

    done = consume_lines(tail, is_continuation=False)
    if not done and next_lines and _should_continue_to_next_page(next_lines):
        consume_lines(next_lines[:120], is_continuation=True)
    flush_sidebar_buffer()

    # Final cleanup trim: stop before known non-template sections that can be
    # pulled in by OCR flow (chapter headers, class-build tables, etc.).
    known_norm = {_normalize_name(x) for x in known_template_names}
    trimmed_block_lines: List[str] = []
    for idx, line in enumerate(block_lines):
        lower = line.lower()
        compact = re.sub(r"[^a-z0-9]+", "", lower)
        if idx > 12:
            if (
                "power source:" in lower
                or "weapon proficiency" in lower
                or "trained skills" in lower
                or "class features" in lower
                or "powersource" in compact
                or "weaponproficiency" in compact
                or "trainedskills" in compact
                or "classfeatures" in compact
                or "implements" in compact
            ):
                break
            if "chapter" in lower and "customiz" in lower:
                break
            if "sons of alagondar" in lower or "factions and foes" in lower:
                break
            if "other neverwinter factions" in lower or "theme tie-in" in lower:
                break
            if "encounters" == lower.strip():
                break
            if (
                "class templates" in lower
                or "monsters, powers, and attack bonuses" in lower
                or "follow the normal method for applying a template" in lower
                or "here are general guidelines" in lower
                or "at-will attack powers" in lower
                or "classtemplates" in compact
                or "monsterspowersandattackbonuses" in compact
                or "followthenormalmethodforapplyingatemplate" in compact
                or "herearegeneralguidelines" in compact
                or "atwillattackpowers" in compact
            ):
                break
            # Trim when a likely new template starts in the captured flow.
            if idx > 22 and _looks_like_new_template_intro(block_lines, idx, line):
                break
            # If we hit another template's normalized name deep in the block, stop.
            line_norm = _normalize_name(line)
            if idx > 18:
                for other_norm in known_norm:
                    if not other_norm or other_norm == target_norm:
                        continue
                    if other_norm in line_norm:
                        break
                else:
                    other_norm = ""
                if other_norm:
                    break
            # If a new prerequisite starts well after current one, it's likely next template.
            if lower.startswith("prerequisite:") and any(l.lower().startswith("prerequisite:") for l in trimmed_block_lines):
                break
        trimmed_block_lines.append(line)
    block_lines = _expand_block_lines_for_template_parsing(trimmed_block_lines)

    mechanical = _mechanical_parse_template_block_lines(block_lines, template_name)
    mechanical["adjacentSidebarTextByTemplate"] = sidebar_by_template
    return mechanical


def _mechanical_parse_template_block_lines(block_lines: List[str], template_name: str) -> Dict[str, Any]:
    """Extract prerequisite, role line, stat lines, and powers from expanded template block lines (shared by PDF ETL and paste import)."""

    prerequisite = ""
    role_line = ""
    stat_lines: List[str] = []
    power_lines: List[str] = []

    in_powers = False
    seen_stat_core = False
    for line in block_lines:
        # OCR can fuse "Action Points 1" with the next ability heading on same line.
        fused_match = re.match(r"^(Action\s*Points?\s*\d+)\s+(.+)$", line, flags=re.IGNORECASE)
        candidate_lines: List[str] = []
        if fused_match:
            candidate_lines.append(fused_match.group(1).strip())
            candidate_lines.append(fused_match.group(2).strip())
        else:
            candidate_lines.append(line)

        for candidate_line in candidate_lines:
            line = candidate_line
            if not line:
                continue
            if line.lower().startswith("prerequisite:"):
                prerequisite = line.split(":", 1)[1].strip()
            if (
                ROLE_LINE_RE.match(line.strip())
                or ROLE_LINE_ELITE_ANCHOR_RE.match(line.strip())
                or (
                    "Elite" in line
                    and ("Soldier" in line or "Brute" in line or "Controller" in line or "Skirmisher" in line)
                    and _line_mentions_template_name(line, template_name)
                )
            ):
                if not role_line:
                    role_line = line
                    seen_stat_core = True
            if (
                stat_lines
                and re.match(r"^Defenses\b", stat_lines[-1], flags=re.IGNORECASE)
                and not STAT_LINE_RE.match(line)
                and not _looks_like_power_name(line)
            ):
                stat_lines[-1] = f"{stat_lines[-1]} {line}"
                seen_stat_core = True
                continue
            if STAT_LINE_RE.search(line):
                stat_lines.append(line)
                seen_stat_core = True
            if line.lower().startswith("skills "):
                break
            if SECTION_MARKER_RE.search(line):
                in_powers = True
                continue
            # Some template stat blocks omit explicit POWERS header; start ability capture
            # once we are in stat block context and a plausible ability heading appears.
            if not in_powers and seen_stat_core and _looks_like_power_name(line):
                in_powers = True
            if in_powers and _is_template_tail_marker(line):
                break
            if in_powers and STAT_LINE_RE.search(line):
                continue
            # DMG2 variable resist tiers ("Level 11: 10 variable (1/encounter)") — not power scaling lines like "Level 11: Ongoing 10 damage".
            ls_pow = line.strip()
            if in_powers and re.match(r"^Level\s+\d+\s*:", ls_pow, re.I) and re.search(
                r"\bvariable\b", ls_pow, re.I
            ):
                stat_lines.append(line)
                continue
            if in_powers and line:
                power_lines.append(line)

    parsed_powers = _parse_powers(power_lines[:120])

    buckets = _bucket_template_abilities(parsed_powers)

    return {
        "prerequisite": prerequisite,
        "roleLine": role_line,
        "statLines": stat_lines,
        "powersText": power_lines[:120],
        "powers": buckets["powers"],
        "auras": buckets["auras"],
        "traits": buckets["traits"],
        "uncategorizedAbilities": buckets["uncategorized"],
        "rawText": " ".join(block_lines)[:8000],
    }


def parse_pasted_monster_template(raw_text: str, template_name_hint: Optional[str] = None) -> Dict[str, Any]:
    """
    Best-effort parse of a single pasted template block using the same mechanical rules as PDF extraction.
    Returns {"ok": True, "template": row_dict} or {"ok": False, "error": str, ...}.
    """
    lines = _to_lines(raw_text)
    if not lines:
        return {"ok": False, "error": "emptyInput"}

    names = _extract_candidate_names(lines)
    name: Optional[str] = None
    if template_name_hint and str(template_name_hint).strip():
        name = _title_case(str(template_name_hint).strip())
    elif names:
        name = max(names, key=len)
    else:
        anchors = _scan_elite_role_anchors(lines)
        if anchors:
            name = anchors[0][1]
        else:
            hm = TEMPLATE_HEADING_RE.match(lines[0].strip())
            if hm:
                name = _title_case(hm.group(1).strip())

    if not name:
        return {"ok": False, "error": "couldNotInferTemplateName"}

    known = set(names) | {name}
    header_idx = _find_header_index(lines, name)
    if header_idx is None:
        header_idx = 0

    tail = lines[header_idx : header_idx + 220]
    block_lines = _expand_block_lines_for_template_parsing(tail)
    parsed = _mechanical_parse_template_block_lines(block_lines, name)
    row = _build_template_row(
        name=name,
        pdf_name="manual import",
        page_start=0,
        parsed=parsed,
        extraction_method="paste",
    )
    row["sourceBook"] = "manual import"
    _add_extraction_warnings(row)
    return {"ok": True, "template": row}


def extract_templates_from_pdf(pdf_path: Path) -> List[Dict[str, object]]:
    reader = PdfReader(str(pdf_path), strict=False)
    pages: List[List[str]] = []
    for page in reader.pages:
        pages.append(_to_lines(page.extract_text() or ""))

    # Pass 1: discover names from references, ignoring index pages.
    names: Set[str] = set()
    for lines in pages:
        if _is_index_page(lines):
            continue
        names.update(_extract_candidate_names(lines))
    # Pass 2: locate real body blocks for each candidate.
    rows: List[Dict[str, object]] = []
    seen = set()
    sidebar_notes_by_template: Dict[str, List[str]] = _extract_document_sidebar_notes(pages, names)
    for name in sorted(names):
        legacy_row: Optional[Dict[str, Any]] = None
        for page_idx, lines in enumerate(pages):
            header_idx = _find_header_index(lines, name)
            if header_idx is None:
                continue
            anchors_here = sorted(_scan_elite_role_anchors(lines), key=lambda x: x[0])
            target_norm = _normalize_name(name)
            this_role_idx: Optional[int] = None
            next_anchor: Optional[tuple[int, str]] = None
            for i, (aidx, aname) in enumerate(anchors_here):
                if _normalize_name(aname) != target_norm:
                    continue
                if aidx >= header_idx:
                    this_role_idx = aidx
                    if i + 1 < len(anchors_here):
                        next_anchor = anchors_here[i + 1]
                    break

            end_exc: Optional[int] = None
            if this_role_idx is not None:
                end_exc = _exclusive_end_before_next_elite_template(lines, this_role_idx, next_anchor)

            if this_role_idx is not None and end_exc is not None and end_exc > header_idx:
                effective_lines = lines[header_idx:end_exc]
                eff_header = 0
            else:
                effective_lines = lines[header_idx:]
                eff_header = 0

            next_lines: List[str] = []
            if page_idx + 1 < len(pages):
                truncated_same_page = (
                    this_role_idx is not None and end_exc is not None and end_exc < len(lines)
                )
                if not truncated_same_page:
                    next_lines = pages[page_idx + 1]

            parsed = _extract_block_from_page(effective_lines, eff_header, next_lines, name, names)
            if not parsed:
                continue
            key = (name.lower(), pdf_path.name.lower(), page_idx + 1)
            if key in seen:
                continue
            for template_key, notes in (parsed.get("adjacentSidebarTextByTemplate", {}) or {}).items():
                sidebar_notes_by_template.setdefault(str(template_key), []).extend([str(x) for x in notes if str(x).strip()])
            legacy_row = _build_template_row(
                name=name,
                pdf_name=pdf_path.name,
                page_start=page_idx + 1,
                parsed=parsed,
                extraction_method="body-block",
            )
            break
        winner: Optional[Dict[str, Any]] = legacy_row
        if winner:
            key = (
                str(winner.get("templateName") or "").lower(),
                str(winner.get("sourceBook") or "").lower(),
                int(winner.get("pageStart") or 0),
            )
            if key not in seen:
                seen.add(key)
                rows.append(winner)

    if sidebar_notes_by_template:
        for row in rows:
            template_name = str(row.get("templateName") or "")
            notes = sidebar_notes_by_template.get(template_name, [])
            if not notes:
                continue
            deduped: List[str] = []
            seen_notes = set()
            for note in notes:
                key = " ".join(note.split()).lower()
                if not key or key in seen_notes:
                    continue
                seen_notes.add(key)
                deduped.append(note)
            row["relatedFlavorText"] = deduped

    for row in rows:
        _add_extraction_warnings(row)
    return rows


def collect_pdf_paths(root: Path, recursive: bool) -> List[Path]:
    pattern = "**/*.pdf" if recursive else "*.pdf"
    return sorted(path for path in root.glob(pattern) if path.is_file())


def build_templates_index(
    root: Path,
    recursive: bool,
    output_path: Path,
    *,
    report_path: Optional[Path] = None,
) -> None:
    pdfs = collect_pdf_paths(root, recursive=recursive)
    templates: List[Dict[str, object]] = []
    skipped: List[dict] = []
    for pdf in pdfs:
        try:
            templates.extend(extract_templates_from_pdf(pdf))
        except Exception as error:
            skipped.append({"sourceBook": pdf.name, "error": str(error)})

    pre_filter_count = len(templates)
    templates = [t for t in templates if not _looks_like_class_build_entry(t)]
    filtered_class_build_count = pre_filter_count - len(templates)

    # Deduplicate by normalized template name, preferring highest-quality capture.
    best_by_name: Dict[str, Dict[str, Any]] = {}
    for row in templates:
        key = _normalize_template_key(str(row.get("templateName") or ""))
        if not key:
            continue
        current = best_by_name.get(key)
        if current is None or _quality_score(row) > _quality_score(current):
            best_by_name[key] = row
    templates = sorted(best_by_name.values(), key=lambda x: str(x.get("templateName") or ""))
    for row in templates:
        _add_extraction_warnings(row)

    pre_sanity_count = len(templates)
    sanity_rejected: List[Dict[str, Any]] = []
    kept_templates: List[Dict[str, Any]] = []
    for row in templates:
        if _fails_sanity_pass(row):
            sanity_rejected.append(
                {
                    "templateName": row.get("templateName"),
                    "sourceBook": row.get("sourceBook"),
                    "pageStart": row.get("pageStart"),
                    "extractionWarnings": row.get("extractionWarnings"),
                    "rawLength": len(str(row.get("rawText") or "")),
                }
            )
            continue
        kept_templates.append(row)
    templates = kept_templates

    uncategorized_rows: List[Dict[str, Any]] = []
    for tpl in templates:
        for ability in tpl.get("uncategorizedAbilities") or []:
            uncategorized_rows.append(
                {
                    "templateName": tpl.get("templateName"),
                    "sourceBook": tpl.get("sourceBook"),
                    "pageStart": tpl.get("pageStart"),
                    "abilityName": ability.get("name"),
                    "usage": ability.get("usage"),
                    "action": ability.get("action"),
                }
            )

    payload = {
        "meta": {
            "pdfCount": len(pdfs),
            "templateCount": len(templates),
            "preSanityTemplateCount": pre_sanity_count,
            "sanityRejectedCount": len(sanity_rejected),
            "sourceRoot": str(root.resolve()).replace("\\", "/"),
            "skippedPdfCount": len(skipped),
            "uncategorizedAbilityCount": len(uncategorized_rows),
            "filteredClassBuildCount": filtered_class_build_count,
            "dedupeKey": "normalizedTemplateName",
        },
        "templates": templates,
        "sanityRejectedTemplates": sanity_rejected,
        "skippedPdfs": skipped,
        "uncategorizedAbilities": uncategorized_rows,
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote template index: {output_path}")
    print(f"Scanned PDFs: {len(pdfs)}")
    print(f"Template blocks: {len(templates)}")
    print(f"Uncategorized abilities: {len(uncategorized_rows)}")
    if skipped:
        print(f"Skipped PDFs: {len(skipped)}")

    if report_path is not None:
        report_doc = _build_etl_report(
            pdfs=pdfs,
            kept_templates=templates,
            sanity_rejected=sanity_rejected,
            skipped_pdfs=skipped,
            uncategorized_abilities=uncategorized_rows,
        )
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(json.dumps(report_doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"Wrote ETL report: {report_path}")
        rc = report_doc.get("summary") or {}
        print(
            f"ETL review flags: {rc.get('entriesFlaggedForReviewCount', 0)} entries "
            f"across {rc.get('booksWithReviewFlags', 0)} sourcebooks "
            f"({rc.get('sanityRejectedCount', 0)} sanity-rejected)"
        )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Extract monster template body blocks from D&D 4E sourcebook PDFs into JSON."
    )
    parser.add_argument("source_root", nargs="?", default=".")
    parser.add_argument("output_json", nargs="?", default="generated/monster_templates.json")
    parser.add_argument("--recursive", action="store_true")
    parser.add_argument(
        "--report",
        nargs="?",
        const="__default__",
        default="__default__",
        metavar="PATH",
        help="Write per-book ETL report JSON. Default: <output_json_stem>_etl_report.json beside the template index. Omit flag value to use default.",
    )
    parser.add_argument("--no-report", action="store_true", help="Do not write the ETL report file.")
    args = parser.parse_args()
    out = Path(args.output_json)
    if args.no_report:
        report_path: Optional[Path] = None
    elif args.report == "__default__":
        report_path = out.parent / f"{out.stem}_etl_report.json"
    else:
        report_path = Path(args.report)
    build_templates_index(Path(args.source_root), args.recursive, out, report_path=report_path)


if __name__ == "__main__":
    main()
