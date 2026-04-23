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
        if "FinalValue" not in node.attrib:
            continue
        name = _direct_child_text(node, "Name")
        if not name:
            continue
        result[name] = _coerce_value(node.attrib["FinalValue"])
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
    powers: List[Dict[str, Any]] = []
    section = _find_first_section(root, "Powers")
    if section is None:
        return powers

    for node in section.iter():
        local = _local_name(node.tag)
        if local not in {"MonsterPower", "Power"}:
            continue
        name = _direct_child_text(node, "Name") or _direct_child_text(node, "Display") or ""
        usage = _direct_child_text(node, "Usage") or _direct_child_text(node, "PowerUsage") or ""
        usage_details = _direct_child_text(node, "UsageDetails") or ""
        action = _direct_child_text(node, "Action") or ""
        trigger = _direct_child_text(node, "Trigger") or ""
        requirements = _direct_child_text(node, "Requirements") or ""
        power_type = _direct_child_text(node, "Type") or ""
        flavor_text = _direct_child_text(node, "FlavorText") or ""
        is_basic_raw = _direct_child_text(node, "IsBasic")
        is_basic = _coerce_value(is_basic_raw) if is_basic_raw else False
        tier_raw = _direct_child_text(node, "Tier")
        tier = _coerce_value(tier_raw) if tier_raw else ""
        keywords = _direct_child_text(node, "Keywords") or ""
        range_text = _first_descendant_text(node, "Range") or ""
        description = _first_descendant_text(node, "Description") or ""
        if name or usage or action or keywords or description:
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
                    "range": range_text,
                    "description": description,
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

    return {
        "name": _direct_child_text(root, "Name") or fallback_name,
        "level": _direct_child_text(root, "Level") or "",
        "role": role_name,
        "size": size_name,
        "origin": origin_name,
        "type": type_name,
        "xp": _first_descendant_text(root, "Experience") or _first_descendant_text(root, "XP") or "",
        "stats": {
            "abilityScores": _extract_named_final_values(root, "AbilityScores"),
            "defenses": _extract_named_final_values(root, "Defenses"),
            "attackBonuses": _extract_named_final_values(root, "AttackBonuses"),
            "skills": _extract_named_final_values(root, "Skills"),
            "otherNumbers": _extract_named_value_texts(root, "Characteristics"),
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
