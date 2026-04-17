import json
import sys
import traceback
from collections import defaultdict
from pathlib import Path
from typing import Dict, IO, Any, List, Optional
import xml.etree.ElementTree as ET


def _normalize_whitespace(text: Optional[str]) -> Optional[str]:
    if text is None:
        return None
    stripped = " ".join(text.split())
    return stripped if stripped else None


def _collect_tail_text(elem: ET.Element) -> Optional[str]:
    """
    Collect free-form text that appears directly inside a <RulesElement>
    but outside structured child tags (e.g. the long race descriptions).
    """
    parts: List[str] = []

    if elem.text and elem.text.strip():
        parts.append(elem.text)

    for child in elem:
        if child.tail and child.tail.strip():
            parts.append(child.tail)

    return _normalize_whitespace(" ".join(parts)) if parts else None


def rules_element_to_dict(elem: ET.Element) -> Dict[str, Any]:
    """
    Convert a <RulesElement> element into a JSON-serializable dict.

    The structure is intentionally generic so it works across all type= categories.
    """
    data: Dict[str, Any] = {}

    # Top-level attributes
    data["internal_id"] = elem.attrib.get("internal-id")
    data["name"] = elem.attrib.get("name")
    data["type"] = elem.attrib.get("type")
    data["source"] = elem.attrib.get("source")
    data["revision_date"] = elem.attrib.get("revision-date")

    # Simple child tags we know about
    prereqs = elem.find("Prereqs")
    if prereqs is not None:
        data["prereqs"] = _normalize_whitespace(prereqs.text or "")

    flavor = elem.find("Flavor")
    if flavor is not None:
        data["flavor"] = _normalize_whitespace(flavor.text or "")

    # Collect <specific name="..."> into a dict; handle duplicates as lists
    specifics: Dict[str, Any] = {}
    for s in elem.findall("specific"):
        key = s.attrib.get("name") or ""
        value = _normalize_whitespace(s.text or "")
        if not key:
            continue
        if key in specifics:
            if isinstance(specifics[key], list):
                specifics[key].append(value)
            else:
                specifics[key] = [specifics[key], value]
        else:
            specifics[key] = value
    if specifics:
        data["specific"] = specifics

    # <rules> block: preserve child tags + attributes
    rules_elem = elem.find("rules")
    if rules_elem is not None:
        rules: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        for child in rules_elem:
            tag = child.tag
            entry: Dict[str, Any] = {}
            if child.attrib:
                entry["attrs"] = dict(child.attrib)
            text = _normalize_whitespace(child.text or "")
            if text is not None:
                entry["text"] = text
            # Only append non-empty entries
            if entry:
                rules[tag].append(entry)
        if rules:
            data["rules"] = rules

    # Free-form body text inside the RulesElement (after structured tags)
    body_text = _collect_tail_text(elem)
    if body_text is not None:
        data["body"] = body_text

    return data


def _ensure_output_file(
    handles: Dict[str, IO[str]],
    started_flags: Dict[str, bool],
    out_dir: Path,
    elem_type: str,
) -> IO[str]:
    """
    Lazily open a JSON file for a given type and start a JSON array.
    """
    if elem_type in handles:
        return handles[elem_type]

    out_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{elem_type}.json"
    f = (out_dir / filename).open("w", encoding="utf-8")
    f.write("[\n")
    handles[elem_type] = f
    started_flags[elem_type] = False
    return f


def convert_xml_to_json_by_type(
    input_path: Path,
    output_dir: Path,
    error_log_path: Path,
) -> None:
    """
    Stream the large D20Rules XML and write one JSON array per type=.

    - Each file is named <type>.json and contains a JSON array of elements.
    - Any conversion error is logged to error_log_path as JSON Lines:
      { "internal_id": ..., "type": ..., "error": ..., "traceback": ..., "raw_xml": ... }
    """
    output_dir.mkdir(parents=True, exist_ok=True)

    type_files: Dict[str, IO[str]] = {}
    type_started: Dict[str, bool] = {}

    error_log = error_log_path.open("w", encoding="utf-8")

    try:
        context = ET.iterparse(str(input_path), events=("end",))

        for event, elem in context:
            if elem.tag != "RulesElement":
                continue

            elem_type = elem.attrib.get("type")
            internal_id = elem.attrib.get("internal-id")

            try:
                data = rules_element_to_dict(elem)
                if not elem_type:
                    # If type is missing, log as error and skip
                    raise ValueError("Missing 'type' attribute on RulesElement")

                f = _ensure_output_file(type_files, type_started, output_dir, elem_type)

                # Separator logic for JSON array
                if type_started[elem_type]:
                    f.write(",\n")
                json.dump(data, f, ensure_ascii=False)
                type_started[elem_type] = True

            except Exception as e:
                # Capture raw XML for later forensic analysis
                try:
                    raw_xml = ET.tostring(elem, encoding="unicode")
                except Exception:
                    raw_xml = None

                error_entry = {
                    "internal_id": internal_id,
                    "type": elem_type,
                    "error": str(e),
                    "traceback": traceback.format_exc(),
                    "raw_xml": raw_xml,
                }
                error_log.write(json.dumps(error_entry, ensure_ascii=False) + "\n")

            finally:
                # Free memory
                elem.clear()

    finally:
        # Close all JSON arrays and file handles
        for t, f in type_files.items():
            # Close the JSON array even if we never wrote anything else
            f.write("\n]\n")
            f.close()
        error_log.close()


def main(argv: Optional[List[str]] = None) -> None:
    if argv is None:
        argv = sys.argv[1:]

    if not (1 <= len(argv) <= 3):
        print(
            "Usage: python xml_to_json_by_type.py "
            "INPUT_XML [OUTPUT_DIR] [ERROR_LOG_PATH]"
        )
        print("Example:")
        print(
            "  python xml_to_json_by_type.py "
            "combined.dnd40.merged.xml out_json errors.jsonl"
        )
        sys.exit(1)

    input_path = Path(argv[0])
    output_dir = Path(argv[1]) if len(argv) >= 2 else Path("out_json")
    error_log_path = (
        Path(argv[2]) if len(argv) >= 3 else Path("conversion_errors.jsonl")
    )

    convert_xml_to_json_by_type(input_path, output_dir, error_log_path)


if __name__ == "__main__":
    main()

