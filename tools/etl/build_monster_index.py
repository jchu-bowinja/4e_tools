import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any, Dict, List, Optional


def _safe_id(path_value: str) -> str:
    slug = path_value.lower().replace("\\", "/").replace(".monster", "")
    slug = re.sub(r"[^a-z0-9/_-]+", "-", slug)
    slug = slug.strip("-")
    return slug.replace("/", "__") or "monster"


def _local_name(tag: str) -> str:
    if "}" in tag:
        return tag.rsplit("}", 1)[1]
    return tag


def _coerce_value(value: str) -> Any:
    text = value.strip()
    if text.lower() == "true":
        return True
    if text.lower() == "false":
        return False
    if re.fullmatch(r"-?\d+", text):
        return int(text)
    if re.fullmatch(r"-?\d+\.\d+", text):
        return float(text)
    return text


def _normalize_text(value: Optional[str]) -> str:
    raw = "" if value is None else str(value)
    normalized = re.sub(r"\s+", " ", raw).strip()
    if not normalized:
        return ""
    return re.sub(r"\s*;\s*", "; ", normalized)


def _normalized_optional_text(value: Optional[str]) -> str:
    normalized = _normalize_text(value)
    if normalized.lower() in {"none", "n/a", "null", "nil"}:
        return ""
    return normalized


def _direct_child_text(node: ET.Element, tag_name: str) -> Optional[str]:
    for child in list(node):
        if _local_name(child.tag) == tag_name and child.text:
            text = child.text.strip()
            if text:
                return text
    return None


def _first_descendant_text(node: ET.Element, tag_name: str) -> Optional[str]:
    for child in node.iter():
        if _local_name(child.tag) == tag_name and child.text and child.text.strip():
            return child.text.strip()
    return None


def _all_descendant_texts(node: ET.Element, tag_name: str) -> List[str]:
    values: List[str] = []
    seen = set()
    for child in node.iter():
        if _local_name(child.tag) != tag_name:
            continue
        text = _normalized_optional_text(child.text)
        if not text:
            continue
        lowered = text.lower()
        if lowered in seen:
            continue
        seen.add(lowered)
        values.append(text)
    return values


def _first_available_text(node: ET.Element, tag_names: List[str]) -> str:
    for tag_name in tag_names:
        direct = _direct_child_text(node, tag_name)
        if direct and _normalized_optional_text(direct):
            return _normalized_optional_text(direct)
        descendant = _first_descendant_text(node, tag_name)
        if descendant and _normalized_optional_text(descendant):
            return _normalized_optional_text(descendant)
    return ""


def _first_descendant_attr(node: ET.Element, tag_name: str, attr_name: str) -> Optional[str]:
    for child in node.iter():
        if _local_name(child.tag) == tag_name and attr_name in child.attrib:
            value = child.attrib[attr_name]
            if value is not None and str(value).strip():
                return str(value).strip()
    return None


def _attr_value_case_insensitive(node: ET.Element, attr_name: str) -> Optional[str]:
    target = attr_name.lower()
    for key, value in node.attrib.items():
        if key.lower() != target:
            continue
        if value is None:
            return None
        text = str(value).strip()
        if text:
            return text
    return None


def _first_descendant_attr_ci(node: ET.Element, tag_name: str, attr_name: str) -> Optional[str]:
    for child in node.iter():
        if _local_name(child.tag) != tag_name:
            continue
        value = _attr_value_case_insensitive(child, attr_name)
        if value is not None:
            return value
    return None


def _find_first_section(node: ET.Element, tag_name: str) -> Optional[ET.Element]:
    for child in node.iter():
        if _local_name(child.tag) == tag_name:
            return child
    return None


def _extract_named_final_values(root: ET.Element, section_name: str) -> Dict[str, Any]:
    section = _find_first_section(root, section_name)
    if section is None:
        return {}
    result: Dict[str, Any] = {}
    for node in section.iter():
        final_value = _attr_value_case_insensitive(node, "FinalValue")
        if final_value is None:
            continue
        name = _direct_child_text(node, "Name")
        if not name:
            continue
        result[name] = _coerce_value(final_value)
    return result


def _extract_named_value_texts(root: ET.Element, section_name: str) -> Dict[str, str]:
    section = _find_first_section(root, section_name)
    if section is None:
        return {}
    result: Dict[str, str] = {}
    for node in section.iter():
        name = _direct_child_text(node, "Name")
        if not name:
            continue
        text_parts = []
        for child in list(node):
            if _local_name(child.tag) == "Name":
                continue
            if child.text and child.text.strip():
                text_parts.append(child.text.strip())
        if text_parts:
            result[name] = " | ".join(text_parts)
    return result


def _extract_core_final_values(root: ET.Element) -> Dict[str, Any]:
    values: Dict[str, Any] = {}

    for tag in ("Initiative", "HitPoints", "ActionPoints"):
        node = _find_first_section(root, tag)
        if node is None:
            continue
        final_value = _attr_value_case_insensitive(node, "FinalValue")
        if final_value is None:
            continue
        values[tag[0].lower() + tag[1:]] = _coerce_value(final_value)

    saving_throws_value = _first_descendant_attr_ci(root, "MonsterSavingThrow", "FinalValue")
    if saving_throws_value is not None:
        values["savingThrows"] = _coerce_value(saving_throws_value)

    land_speed_section = _find_first_section(root, "LandSpeed")
    if land_speed_section is not None:
        land_speed = _first_descendant_attr_ci(land_speed_section, "Speed", "FinalValue")
        if land_speed is None:
            land_speed = _attr_value_case_insensitive(land_speed_section, "FinalValue")
        if land_speed is not None:
            values["landSpeed"] = _coerce_value(land_speed)

    movement_modes: Dict[str, Any] = {}
    speeds_section = _find_first_section(root, "Speeds")
    if speeds_section is not None:
        for speed_node in list(speeds_section):
            if _local_name(speed_node.tag) != "CreatureSpeed":
                continue
            mode_name = _first_descendant_text(speed_node, "Name") or ""
            speed_value = _first_descendant_attr_ci(speed_node, "Speed", "FinalValue")
            if not mode_name or speed_value is None:
                continue
            movement_modes[mode_name] = _coerce_value(speed_value)
    if movement_modes:
        values["movementModes"] = movement_modes

    return values


def _element_to_structured(node: ET.Element) -> Dict[str, Any]:
    payload: Dict[str, Any] = {}
    if node.attrib:
        payload["attrs"] = {k: _coerce_value(v) for k, v in node.attrib.items()}
    text = (node.text or "").strip()
    if text:
        payload["text"] = _coerce_value(text)

    children_by_tag: Dict[str, List[Any]] = {}
    for child in list(node):
        child_payload = _element_to_structured(child)
        tag = _local_name(child.tag)
        children_by_tag.setdefault(tag, []).append(child_payload)

    if children_by_tag:
        payload["children"] = {
            tag: values[0] if len(values) == 1 else values for tag, values in children_by_tag.items()
        }
    return payload


def _extract_powers(root: ET.Element) -> List[Dict[str, Any]]:
    def _extract_reference_names(node: ET.Element) -> List[str]:
        names: List[str] = []
        for candidate in node.iter():
            if _local_name(candidate.tag) != "Name":
                continue
            text = (candidate.text or "").strip()
            if text:
                names.append(text)
        deduped: List[str] = []
        seen = set()
        for name in names:
            if name in seen:
                continue
            deduped.append(name)
            seen.add(name)
        return deduped

    def _extract_damage_data(node: ET.Element) -> Dict[str, Any]:
        data: Dict[str, Any] = {}
        expressions = []
        for expr in node.iter():
            if _local_name(expr.tag) != "Expression":
                continue
            text = (expr.text or "").strip()
            if text:
                expressions.append(text)
        if expressions:
            data["expressions"] = expressions

        average_damage = _first_descendant_attr(node, "AverageDamage", "FinalValue")
        if average_damage is not None:
            data["averageDamage"] = _coerce_value(average_damage)

        damage_constant = _first_descendant_attr(node, "DamageConstant", "FinalValue")
        if damage_constant is not None:
            data["damageConstant"] = _coerce_value(damage_constant)

        dice_quantity = _first_descendant_text(node, "DiceQuantity")
        if dice_quantity is not None:
            data["diceQuantity"] = _coerce_value(dice_quantity)

        dice_sides = _first_descendant_text(node, "DiceSides")
        if dice_sides is not None:
            data["diceSides"] = _coerce_value(dice_sides)

        damage_type = _first_descendant_text(node, "Type")
        if damage_type:
            data["damageType"] = damage_type
        damage_modifier = _first_descendant_text(node, "Modifier")
        if damage_modifier:
            data["modifier"] = damage_modifier
        # Suppress boilerplate "no-op" damage blocks emitted in many outcomes.
        if _is_noop_damage(data):
            return {}
        return data

    def _is_noop_damage(damage: Dict[str, Any]) -> bool:
        if not damage:
            return True
        expressions = [str(expr).strip() for expr in (damage.get("expressions") or []) if str(expr).strip()]
        if expressions:
            return False
        damage_type = str(damage.get("damageType") or "").strip().lower()
        average = damage.get("averageDamage")
        quantity = damage.get("diceQuantity")
        sides = damage.get("diceSides")
        constant = damage.get("damageConstant")
        modifier = str(damage.get("modifier") or "").strip().lower()
        if (
            quantity in {None, 0}
            and sides in {None, 0, 8}
            and (constant is None or float(constant) <= 12.5)
            and (not damage_type or damage_type in {"none", "normal"})
            and modifier in {"", "medium"}
        ):
            return True
        return False

    def _is_placeholder_attack_entry(entry: Dict[str, Any]) -> bool:
        if not entry:
            return True
        kind = str(entry.get("kind") or "")
        name = str(entry.get("name") or "").strip().lower()
        description = str(entry.get("description") or "").strip()
        if "damage" in entry and not isinstance(entry["damage"], dict):
            return False
        has_damage = isinstance(entry.get("damage"), dict) and bool(entry.get("damage"))
        has_outcomes = bool(entry.get("hit") or entry.get("miss") or entry.get("effect"))
        has_nested = bool(entry.get("aftereffects") or entry.get("sustains") or entry.get("failedSavingThrows") or entry.get("attacks"))
        if has_damage or has_outcomes or has_nested or description:
            return False
        return kind in {"MonsterAttackEntry", "Attack", "MonsterAttack"} and name in {"aftereffect", "effect", "hit", "miss", ""}

    def _extract_nested_entries(node: ET.Element, section_name: str) -> List[Dict[str, Any]]:
        section = _find_first_section(node, section_name)
        if section is None:
            return []
        return _dedupe_entries(_extract_entry_list(section))

    def _entry_dedupe_key(entry: Dict[str, Any]) -> str:
        normalized = json.dumps(entry, sort_keys=True, ensure_ascii=False)
        return normalized.lower()

    def _dedupe_entries(entries: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        out: List[Dict[str, Any]] = []
        seen = set()
        for entry in entries:
            if _is_placeholder_attack_entry(entry):
                continue
            key = _entry_dedupe_key(entry)
            if key in seen:
                continue
            seen.add(key)
            out.append(entry)
        return out

    def _extract_entry_list(section: ET.Element) -> List[Dict[str, Any]]:
        def _extract_attack_entry(node: ET.Element) -> Dict[str, Any]:
            entry: Dict[str, Any] = {"kind": _local_name(node.tag)}
            name = _first_available_text(node, ["Name", "Display"])
            if name:
                entry["name"] = name
            description = _first_available_text(node, ["Description"])
            if description:
                entry["description"] = description
            damage = _find_first_section(node, "Damage")
            if damage is not None:
                damage_data = _extract_damage_data(damage)
                if damage_data:
                    entry["damage"] = damage_data

            for nested_name in ("Aftereffects", "Sustains", "FailedSavingThrows"):
                nested_values = _extract_nested_entries(node, nested_name)
                if nested_values:
                    key = {
                        "Aftereffects": "aftereffects",
                        "Sustains": "sustains",
                        "FailedSavingThrows": "failedSavingThrows",
                    }[nested_name]
                    entry[key] = nested_values

            attacks_section = _find_first_section(node, "Attacks")
            if attacks_section is not None:
                nested_attacks = _extract_attacks(node)
                if nested_attacks:
                    entry["attacks"] = nested_attacks

            return entry

        items: List[Dict[str, Any]] = []
        for child in list(section):
            tag = _local_name(child.tag)
            if tag in {"MonsterAttackEntry", "MonsterAttack", "Attack"}:
                parsed = _extract_attack_entry(child)
                if parsed:
                    items.append(parsed)
                continue
            structured = _element_to_structured(child)
            if structured:
                items.append({"kind": tag, **structured})
        return _dedupe_entries(items)

    def _extract_outcome_data(node: ET.Element) -> Dict[str, Any]:
        outcome: Dict[str, Any] = {}
        description = _first_available_text(node, ["Description"])
        if description:
            outcome["description"] = description
        damage = _find_first_section(node, "Damage")
        if damage is not None:
            damage_data = _extract_damage_data(damage)
            if damage_data:
                outcome["damage"] = damage_data
        nested_attacks = []
        for attack_node in node.iter():
            if _local_name(attack_node.tag) not in {"Attack", "MonsterAttack"}:
                continue
            attack_text = _first_available_text(attack_node, ["Description"])
            if attack_text:
                nested_attacks.append(attack_text)
        if nested_attacks:
            deduped: List[str] = []
            seen = set()
            for entry in nested_attacks:
                lowered = entry.lower()
                if lowered in seen:
                    continue
                seen.add(lowered)
                deduped.append(entry)
            outcome["nestedAttackDescriptions"] = deduped

        aftereffects = _extract_nested_entries(node, "Aftereffects")
        if aftereffects:
            outcome["aftereffects"] = aftereffects
        sustains = _extract_nested_entries(node, "Sustains")
        if sustains:
            outcome["sustains"] = sustains
        failed_saving_throws = _extract_nested_entries(node, "FailedSavingThrows")
        if failed_saving_throws:
            outcome["failedSavingThrows"] = failed_saving_throws
        return outcome

    def _extract_attack_bonuses(node: ET.Element) -> List[Dict[str, Any]]:
        bonuses: List[Dict[str, Any]] = []
        attack_bonuses = _find_first_section(node, "AttackBonuses")
        if attack_bonuses is None:
            return bonuses
        for bonus_node in attack_bonuses.iter():
            if _local_name(bonus_node.tag) != "MonsterPowerAttackNumber":
                continue
            defense = _first_descendant_text(bonus_node, "DefenseName") or _first_descendant_text(bonus_node, "Name") or ""
            final_value = bonus_node.attrib.get("FinalValue")
            entry: Dict[str, Any] = {}
            if defense:
                entry["defense"] = defense
            if final_value is not None:
                entry["bonus"] = _coerce_value(final_value)
            if entry:
                bonuses.append(entry)
        return bonuses

    def _extract_attacks(node: ET.Element) -> List[Dict[str, Any]]:
        attacks: List[Dict[str, Any]] = []
        attacks_section = _find_first_section(node, "Attacks")
        if attacks_section is None:
            return attacks
        for attack_node in attacks_section.iter():
            attack_kind = _local_name(attack_node.tag)
            if attack_kind not in {"MonsterAttack", "MonsterAttackEntry"}:
                continue
            attack: Dict[str, Any] = {}
            attack["kind"] = attack_kind
            name = _first_available_text(attack_node, ["Name", "Display"])
            if name:
                attack["name"] = name
            range_text = _first_available_text(attack_node, ["Range"])
            if range_text:
                attack["range"] = range_text
            targets = _first_available_text(attack_node, ["Targets", "Target"])
            if targets:
                attack["targets"] = targets
            attack_bonuses = _extract_attack_bonuses(attack_node)
            if attack_bonuses:
                attack["attackBonuses"] = attack_bonuses
            for outcome_name in ("Hit", "Miss", "Effect"):
                outcome_section = _find_first_section(attack_node, outcome_name)
                if outcome_section is None:
                    continue
                outcome = _extract_outcome_data(outcome_section)
                if outcome:
                    attack[outcome_name.lower()] = outcome
            for outcome_name in ("hit", "miss", "effect"):
                if outcome_name in attack and not attack[outcome_name]:
                    del attack[outcome_name]
            if attack:
                if (
                    attack_kind == "MonsterAttackEntry"
                    and not attack.get("name")
                    and not attack.get("range")
                    and not attack.get("targets")
                    and not attack.get("attackBonuses")
                    and not attack.get("hit")
                    and not attack.get("miss")
                    and not attack.get("effect")
                ):
                    continue
                attacks.append(attack)
        attacks = _dedupe_entries(attacks)
        cleaned_attacks: List[Dict[str, Any]] = []
        for attack in attacks:
            if (
                str(attack.get("kind") or "") == "MonsterAttackEntry"
                and str(attack.get("name") or "").strip().lower() in {"aftereffect", "effect", "hit", "miss"}
                and not attack.get("description")
                and not attack.get("hit")
                and not attack.get("miss")
                and not attack.get("effect")
                and not attack.get("attacks")
            ):
                continue
            cleaned_attacks.append(attack)
        return cleaned_attacks

    powers: List[Dict[str, Any]] = []
    section = _find_first_section(root, "Powers")
    if section is None:
        return powers

    for node in section.iter():
        local = _local_name(node.tag)
        if local not in {"MonsterPower", "Power"}:
            continue
        name = _first_available_text(node, ["Name", "Display"])
        usage = _first_available_text(node, ["Usage", "PowerUsage"])
        usage_details = _first_available_text(node, ["UsageDetails"])
        action = _first_available_text(node, ["Action"])
        trigger = _first_available_text(node, ["Trigger"])
        requirements = _first_available_text(node, ["Requirements"])
        power_type = _first_available_text(node, ["Type"])
        flavor_text = _first_available_text(node, ["FlavorText"])
        is_basic_raw = _direct_child_text(node, "IsBasic")
        is_basic = _coerce_value(is_basic_raw) if is_basic_raw else False
        tier_raw = _direct_child_text(node, "Tier")
        tier = _coerce_value(tier_raw) if tier_raw else ""
        keywords = _first_available_text(node, ["Keywords"])
        keyword_names: List[str] = []
        keyword_section = _find_first_section(node, "Keywords")
        if keyword_section is not None:
            keyword_names = _extract_reference_names(keyword_section)
        keyword_tokens = [
            _normalize_text(token)
            for token in re.split(r"[;,]", keywords)
            if _normalize_text(token)
        ]
        for keyword_name in keyword_names:
            normalized_keyword_name = _normalize_text(keyword_name)
            if normalized_keyword_name and normalized_keyword_name.lower() not in {
                token.lower() for token in keyword_tokens
            }:
                keyword_tokens.append(normalized_keyword_name)
        range_text = _first_available_text(node, ["Range"])
        description_candidates = _all_descendant_texts(node, "Description")
        description = description_candidates[0] if description_candidates else ""
        attacks = _extract_attacks(node)
        damage_expressions: List[str] = []
        for expression_node in node.iter():
            if _local_name(expression_node.tag) != "Expression":
                continue
            expression_text = _normalize_text(expression_node.text)
            if expression_text:
                damage_expressions.append(expression_text)
        deduped_damage_expressions: List[str] = []
        seen_expressions = set()
        for expression in damage_expressions:
            lowered = expression.lower()
            if lowered in seen_expressions:
                continue
            seen_expressions.add(lowered)
            deduped_damage_expressions.append(expression)
        if name or usage or action or keywords or keyword_tokens or description or attacks:
            powers.append(
                {
                    "name": name,
                    "usage": usage,
                    "usageDetails": usage_details,
                    "action": action,
                    "trigger": trigger,
                    "requirements": requirements,
                    "type": power_type,
                    "isBasic": is_basic,
                    "tier": tier,
                    "flavorText": flavor_text,
                    "keywords": keywords,
                    "keywordNames": keyword_names,
                    "keywordTokens": keyword_tokens,
                    "range": range_text,
                    "description": description,
                    "damageExpressions": deduped_damage_expressions,
                    "attacks": attacks,
                }
            )
    return powers


def _extract_unmapped_sections(root: ET.Element) -> Dict[str, Any]:
    mapped = {
        "Name",
        "Level",
        "Role",
        "Size",
        "Origin",
        "Type",
        "Experience",
        "XP",
        "AbilityScores",
        "Defenses",
        "AttackBonuses",
        "Skills",
        "Powers",
    }
    out: Dict[str, Any] = {}
    for child in list(root):
        tag = _local_name(child.tag)
        if tag in mapped:
            continue
        out[tag] = _element_to_structured(child)
    return out


def _parse_monster_file(xml_text: str, fallback_name: str) -> Dict[str, Any]:
    root = ET.fromstring(xml_text)

    role_object = _find_first_section(root, "Role")
    role_name = ""
    if role_object is not None:
        role_name = _first_descendant_text(role_object, "Name") or ""

    size_object = _find_first_section(root, "Size")
    size_name = ""
    if size_object is not None:
        size_name = _first_descendant_text(size_object, "Name") or ""

    origin_object = _find_first_section(root, "Origin")
    origin_name = ""
    if origin_object is not None:
        origin_name = _first_descendant_text(origin_object, "Name") or ""

    type_object = _find_first_section(root, "Type")
    type_name = ""
    if type_object is not None:
        type_name = _first_descendant_text(type_object, "Name") or ""

    is_leader_raw = _direct_child_text(root, "IsLeader") or ""
    is_leader = False
    if is_leader_raw:
        coerced = _coerce_value(is_leader_raw)
        is_leader = bool(coerced) if isinstance(coerced, bool) else str(is_leader_raw).strip().lower() == "true"

    return {
        "name": _direct_child_text(root, "Name") or fallback_name,
        "level": _direct_child_text(root, "Level") or "",
        "role": role_name,
        "isLeader": is_leader,
        "size": size_name,
        "origin": origin_name,
        "type": type_name,
        "xp": (
            _first_descendant_attr(root, "Experience", "FinalValue")
            or _first_descendant_attr(root, "XP", "FinalValue")
            or _first_descendant_text(root, "Experience")
            or _first_descendant_text(root, "XP")
            or ""
        ),
        "stats": {
            "abilityScores": _extract_named_final_values(root, "AbilityScores"),
            "defenses": _extract_named_final_values(root, "Defenses"),
            "attackBonuses": _extract_named_final_values(root, "AttackBonuses"),
            "skills": _extract_named_final_values(root, "Skills"),
            "otherNumbers": {
                **_extract_named_value_texts(root, "Characteristics"),
                **_extract_core_final_values(root),
            },
        },
        "powers": _extract_powers(root),
        "sections": _extract_unmapped_sections(root),
    }


def _read_monster_files(monster_root: Path) -> List[Path]:
    return sorted(path for path in monster_root.rglob("*.monster") if path.is_file())


def _read_source_records(source: Path) -> List[Dict[str, str]]:
    if source.is_dir():
        files = _read_monster_files(source)
        records: List[Dict[str, str]] = []
        for monster_file in files:
            records.append(
                {
                    "relativePath": monster_file.relative_to(source).as_posix(),
                    "fileName": monster_file.name,
                    "xml": monster_file.read_text(encoding="utf-8"),
                }
            )
        return records

    if source.is_file() and source.suffix.lower() in {".monster", ".xml"}:
        if source.suffix.lower() == ".monster":
            return [
                {
                    "relativePath": source.name,
                    "fileName": source.name,
                    "xml": source.read_text(encoding="utf-8"),
                }
            ]

        root = ET.parse(source).getroot()
        if _local_name(root.tag) == "Monster":
            xml_text = ET.tostring(root, encoding="unicode")
            return [{"relativePath": source.name, "fileName": source.name, "xml": xml_text}]

        records = []
        counter = 0
        for monster_node in root.iter():
            if _local_name(monster_node.tag) != "Monster":
                continue
            counter += 1
            xml_text = ET.tostring(monster_node, encoding="unicode")
            synthetic_name = f"{source.stem}_{counter:05d}.monster"
            records.append(
                {
                    "relativePath": synthetic_name,
                    "fileName": synthetic_name,
                    "xml": xml_text,
                }
            )
        return records

    raise FileNotFoundError(f"Monster source path not found or unsupported: {source}")


def _clear_old_entries(entries_dir: Path) -> None:
    if not entries_dir.exists():
        return
    for file in entries_dir.glob("*.json"):
        file.unlink()


def build_monster_index(monster_root: Path, output_root: Path) -> None:
    if not monster_root.exists():
        raise FileNotFoundError(f"Monster source path not found: {monster_root}")

    records = _read_source_records(monster_root)
    monsters_dir = output_root / "monsters"
    entries_dir = monsters_dir / "entries"
    entries_dir.mkdir(parents=True, exist_ok=True)
    _clear_old_entries(entries_dir)

    index_rows: List[Dict[str, Any]] = []

    for source_row in records:
        relative_path = source_row["relativePath"]
        xml_text = source_row["xml"]
        fallback_name = Path(source_row["fileName"]).stem
        monster_id = _safe_id(relative_path)
        parse_error = ""
        parsed_payload: Dict[str, Any]

        try:
            parsed_payload = _parse_monster_file(xml_text, fallback_name)
        except ET.ParseError as error:
            parse_error = str(error)
            parsed_payload = {
                "name": fallback_name,
                "level": "",
                "role": "",
                "isLeader": False,
                "size": "",
                "origin": "",
                "type": "",
                "xp": "",
                "stats": {"abilityScores": {}, "defenses": {}, "attackBonuses": {}, "skills": {}, "otherNumbers": {}},
                "powers": [],
                "sections": {},
            }

        entry = {
            "id": monster_id,
            "fileName": source_row["fileName"],
            "relativePath": relative_path,
            "sourceRoot": str(monster_root).replace("\\", "/"),
            "parseError": parse_error,
            **parsed_payload,
        }
        (entries_dir / f"{monster_id}.json").write_text(
            json.dumps(entry, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
        )

        index_rows.append(
            {
                "id": monster_id,
                "fileName": source_row["fileName"],
                "relativePath": relative_path,
                "name": parsed_payload.get("name", fallback_name),
                "level": parsed_payload.get("level", ""),
                "role": parsed_payload.get("role", ""),
                "isLeader": bool(parsed_payload.get("isLeader", False)),
                "parseError": parse_error,
            }
        )

    index_payload = {"meta": {"version": 3, "count": len(index_rows), "source": str(monster_root)}, "monsters": index_rows}
    (monsters_dir / "index.json").write_text(
        json.dumps(index_payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
    )
    print(f"Wrote monster index: {monsters_dir / 'index.json'}")
    print(f"Wrote monster entries: {len(index_rows)}")
    if not records:
        print("No monster records found in source input.")


def main() -> None:
    source = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("MonsterFiles")
    output = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("generated")
    build_monster_index(source, output)


if __name__ == "__main__":
    main()
