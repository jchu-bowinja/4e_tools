#!/usr/bin/env python3
"""Generate docs/class-feature-priority-fix-report.md from generated/rules_index.json."""

from __future__ import annotations

import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
INDEX_PATH = ROOT / "generated" / "rules_index.json"
OUT_MD = ROOT / "docs" / "class-feature-priority-fix-report.md"
OUT_JSON = ROOT / "docs" / "generated-priority-fix-report.json"


def parse_level(val, default: int = 1) -> int:
    if val is None:
        return default
    m = re.search(r"\d+", str(val))
    return int(m.group()) if m else default


def main() -> None:
    data = json.loads(INDEX_PATH.read_text())
    classes_by_id = {c["id"]: c for c in data["classes"]}
    hybrids_by_id = {h["id"]: h for h in data.get("hybridClasses") or []}
    features_by_id = {f["id"]: f for f in data.get("classFeatures") or []}
    choice_groups_by_class = data.get("classFeatureChoiceGroupsByClassId") or {}
    build_opts_by_class = data.get("classBuildOptionsByClassId") or {}
    granted_names = data.get("grantedClassFeatureNamesBySupportId") or {}

    parent_of = {}
    for c in data["classes"]:
        p = (c.get("raw") or {}).get("specific", {}).get("_ParentClass")
        if p:
            parent_of[c["id"]] = p

    feature_to_classes: dict[str, set[str]] = defaultdict(set)
    option_to_parent: dict[str, dict] = {}
    for cls_id, groups in choice_groups_by_class.items():
        for g in groups:
            pid = g.get("parentFeatureId")
            if pid:
                feature_to_classes[pid].add(cls_id)
            for o in g.get("options") or []:
                oid = o.get("id")
                if oid:
                    feature_to_classes[oid].add(cls_id)
                    option_to_parent[oid] = {
                        "class_id": cls_id,
                        "parent_name": g.get("parentFeatureName"),
                        "parent_key": g.get("key"),
                        "option_name": o.get("name"),
                    }

    def cls_label(cid: str) -> str:
        if cid in hybrids_by_id:
            return hybrids_by_id[cid].get("name", cid)
        c = classes_by_id.get(cid, {})
        name = c.get("name", cid)
        if cid in parent_of:
            pname = classes_by_id.get(parent_of[cid], {}).get("name", parent_of[cid])
            return f"{name} (Essentials, parent: {pname})"
        return name

    def rules_of(cf: dict) -> dict:
        return (cf.get("raw") or {}).get("rules") or {}

    def support_classes_for_feature(cf: dict) -> list[str]:
        out: set[str] = set()
        spec = (cf.get("raw") or {}).get("specific") or {}
        cid = spec.get("Class")
        if cid and (cid in classes_by_id or cid in hybrids_by_id):
            out.add(cid)
            if cid in parent_of:
                out.add(parent_of[cid])
        for sid in feature_to_classes.get(cf["id"], []):
            out.add(sid)
            if sid in parent_of:
                out.add(parent_of[sid])
        fname = cf.get("name", "")
        for sid, names in granted_names.items():
            if fname in names or any(fname.startswith(n + " ") for n in names if n):
                out.add(sid)
        for t in str(spec.get("_Subclasses") or "").split(","):
            t = t.strip()
            if t.startswith("ID_"):
                out.add(t)
        return sorted(out, key=lambda x: cls_label(x))

    def power_grants(cf: dict) -> list[str]:
        return [
            g.get("attrs", {}).get("name")
            for g in rules_of(cf).get("grant") or []
            if g.get("attrs", {}).get("type") == "Power"
            and str(g.get("attrs", {}).get("name", "")).startswith("ID_FMP_POWER")
        ]

    def power_select_l1(cf: dict) -> list[dict]:
        out = []
        for s in rules_of(cf).get("select") or []:
            a = s.get("attrs") or {}
            if a.get("type") != "Power":
                continue
            if parse_level(a.get("Level")) > 1:
                continue
            out.append(a)
        return out

    def cf_select_l1_options(cf: dict) -> list[dict]:
        spec = (cf.get("raw") or {}).get("specific") or {}
        if spec.get("_PARSED_SUB_FEATURES"):
            return []
        out = []
        for s in rules_of(cf).get("select") or []:
            a = s.get("attrs") or {}
            if a.get("type") != "Class Feature":
                continue
            if parse_level(a.get("Level")) > 1:
                continue
            label = a.get("name") or "Class Feature"
            names = []
            for t in (a.get("Category") or "").split("|"):
                t = t.strip()
                if not t.startswith("ID_") or t == cf["id"]:
                    continue
                if re.match(r"^ID_(?:FMP|DBB)_CLASS_\d+$", t):
                    continue
                child = features_by_id.get(t)
                if child:
                    names.append(child.get("name", t))
            if len(names) >= 2:
                out.append({"label": label, "options": sorted(names)})
        return out

    def modify_by_type(cf: dict, typ: str) -> list[dict]:
        return [
            g.get("attrs")
            for g in rules_of(cf).get("modify") or []
            if g.get("attrs", {}).get("type") == typ
        ]

    def replace_rules(cf: dict) -> list[dict]:
        return [g.get("attrs") for g in rules_of(cf).get("replace") or []]

    # --- collect steps ---
    p0: dict[str, list] = defaultdict(list)
    for oid, meta in option_to_parent.items():
        cf = features_by_id.get(oid)
        if not cf:
            continue
        grants = power_grants(cf)
        if not grants:
            continue
        p0[meta["class_id"]].append(
            {
                "choice_path": f"{meta['parent_name']} → {meta['option_name']}",
                "feature": cf["name"],
                "powers_granted": len(grants),
            }
        )
    for cf in data.get("classFeatures") or []:
        grants = power_grants(cf)
        if not grants or cf["id"] in option_to_parent:
            continue
        spec = (cf.get("raw") or {}).get("specific") or {}
        if parse_level(spec.get("Level")) != 1:
            continue
        for cid in support_classes_for_feature(cf):
            names = granted_names.get(cid, [])
            if cf.get("name") not in names:
                continue
            p0[cid].append(
                {
                    "choice_path": f"Auto-granted: {cf['name']}",
                    "feature": cf["name"],
                    "powers_granted": len(grants),
                }
            )

    p1a: dict[str, list] = defaultdict(list)
    for oid, meta in option_to_parent.items():
        cf = features_by_id.get(oid)
        if not cf or not power_select_l1(cf):
            continue
        p1a[meta["class_id"]].append(
            {
                "choice_path": f"{meta['parent_name']} → {meta['option_name']} → power variant",
                "feature": cf["name"],
                "nested_key": f"classPower:{oid}",
            }
        )

    p1b: dict[str, list] = defaultdict(list)
    for oid, meta in option_to_parent.items():
        cf = features_by_id.get(oid)
        if not cf:
            continue
        for n in cf_select_l1_options(cf):
            p1b[meta["class_id"]].append(
                {
                    "choice_path": f"{meta['parent_name']} → {meta['option_name']} → {n['label']}",
                    "feature": cf["name"],
                    "options": n["options"],
                    "nested_key": f"classFeature:{oid}",
                }
            )

    p1c, p1d, p1f = defaultdict(list), defaultdict(list), defaultdict(list)
    seen_c, seen_d, seen_f = defaultdict(set), defaultdict(set), defaultdict(set)
    for cf in data.get("classFeatures") or []:
        mods_p = modify_by_type(cf, "Power")
        mods_w = modify_by_type(cf, "Weapon")
        reps = replace_rules(cf)
        for cid in support_classes_for_feature(cf):
            if mods_p and cf["id"] not in seen_c[cid]:
                seen_c[cid].add(cf["id"])
                p1c[cid].append(
                    {
                        "feature": cf["name"],
                        "fields": sorted(set(m.get("Field", "?") for m in mods_p)),
                        "count": len(mods_p),
                    }
                )
            if mods_w and cf["id"] not in seen_d[cid]:
                seen_d[cid].add(cf["id"])
                p1d[cid].append(
                    {
                        "feature": cf["name"],
                        "fields": sorted(set(m.get("Field", "?") for m in mods_w)),
                        "count": len(mods_w),
                    }
                )
            if reps and cf["id"] not in seen_f[cid]:
                seen_f[cid].add(cf["id"])
                p1f[cid].append({"feature": cf["name"], "count": len(reps)})

    p1e: dict[str, list] = defaultdict(list)
    for cls_id, opts in build_opts_by_class.items():
        for o in opts:
            if not str(o.get("id", "")).startswith("ID_FMP_BUILD_"):
                continue
            pids = o.get("powerIds") or []
            if not pids:
                continue
            p1e[cls_id].append({"build": o.get("name"), "suggested_powers": len(pids)})

    total_w = sum(1 for cf in data.get("classFeatures") or [] if modify_by_type(cf, "Weapon"))
    total_p = sum(1 for cf in data.get("classFeatures") or [] if modify_by_type(cf, "Power"))
    total_r = sum(1 for cf in data.get("classFeatures") or [] if replace_rules(cf))

    weapon_unmapped: dict[str, list] = defaultdict(list)
    for cf in data.get("classFeatures") or []:
        w = modify_by_type(cf, "Weapon")
        if not w:
            continue
        cid = (cf.get("raw") or {}).get("specific", {}).get("Class")
        if cid:
            continue
        name = cf.get("name", "")
        if name.startswith("Arena Weapon"):
            bucket = "Arena Training (Fighter build — internal weapon rows)"
        elif "Crossbow" in name:
            bucket = "Crossbow Savant / internal weapon rows"
        elif "Bow Implement" in name:
            bucket = "Bow Implement (Ranger)"
        else:
            bucket = "Other internal / unscoped weapon modify"
        weapon_unmapped[bucket].append(
            {
                "feature": name,
                "fields": sorted(set(x.get("Field", "?") for x in w)),
                "count": len(w),
            }
        )

    choice_summary = {}
    for cls_id, groups in choice_groups_by_class.items():
        if not groups:
            continue
        rows = []
        for g in groups:
            row = {
                "group": g.get("parentFeatureName"),
                "key": g.get("key"),
                "kind": g.get("kind"),
                "pick_count": g.get("pickCount"),
                "visible_when": g.get("visibleWhen"),
            }
            if g.get("kind") == "classFeature":
                row["options"] = [o.get("name") for o in g.get("options", [])]
            elif g.get("kind") == "power":
                row["power_pool_size"] = len(g.get("powerIds") or [])
            rows.append(row)
        choice_summary[cls_label(cls_id)] = rows

    report = {
        "meta": {
            "source": str(INDEX_PATH.relative_to(ROOT)),
            "total_classes_with_choice_groups": len(choice_groups_by_class),
            "feature_totals": {"modify_weapon": total_w, "modify_power": total_p, "replace": total_r},
            "trait_package_mappings": len(data.get("traitPackageIdByClassFeatureId") or {}),
        },
        "steps": {
            "P0_class_feature_granted_powers": {
                "status": "Fixed (5609f82)",
                "classes": {cls_label(k): v for k, v in sorted(p0.items(), key=lambda x: cls_label(x[0]))},
                "counts": (len(p0), sum(len(v) for v in p0.values())),
            },
            "P1a_nested_power_choices": {
                "status": "Fixed (9b4c41e)",
                "classes": {cls_label(k): v for k, v in sorted(p1a.items(), key=lambda x: cls_label(x[0]))},
                "counts": (len(p1a), sum(len(v) for v in p1a.values())),
            },
            "P1b_nested_class_feature_choices": {
                "status": "Fixed (9b4c41e)",
                "classes": {cls_label(k): v for k, v in sorted(p1b.items(), key=lambda x: cls_label(x[0]))},
                "counts": (len(p1b), sum(len(v) for v in p1b.values())),
            },
            "P1c_modify_power": {
                "status": "Fixed",
                "classes": {cls_label(k): v for k, v in sorted(p1c.items(), key=lambda x: cls_label(x[0]))},
                "counts": (len(p1c), sum(len(v) for v in p1c.values())),
            },
            "P1d_modify_weapon": {
                "status": "Fixed",
                "classes": {cls_label(k): v for k, v in sorted(p1d.items(), key=lambda x: cls_label(x[0]))},
                "counts": (len(p1d), sum(len(v) for v in p1d.values())),
            },
            "P1e_essentials_build_powers": {
                "status": "Fixed (9b4c41e)",
                "classes": {cls_label(k): v for k, v in sorted(p1e.items(), key=lambda x: cls_label(x[0]))},
                "counts": (len(p1e), sum(len(v) for v in p1e.values())),
            },
            "P1f_rules_replace": {
                "status": "Fixed",
                "classes": {cls_label(k): v for k, v in sorted(p1f.items(), key=lambda x: cls_label(x[0]))},
                "counts": (len(p1f), sum(len(v) for v in p1f.values())),
            },
        },
        "followups": {
            "tome_of_readiness_level_pool": {
                "status": "Fixed (09d47f3)",
                "detail": "`$$LEVEL,<class>,<usage>` power-select categories; builder passes character level into choice pools.",
            },
            "trait_package_pact_chains": {
                "status": "Fixed",
                "detail": (
                    "`traitPackageIdByClassFeatureId` ETL map; grant expansion follows pact/domain "
                    "progression when the matching trait package is active (e.g. Binder Star Pact L13 upgrade)."
                ),
            },
            "dmg2_role_bucket_powerswaps": {
                "status": "Fixed",
                "detail": (
                    "DMG2 milestone features (Level 03 Defender Encounter Power, …) index `powerswap` without "
                    "fixed power lists; runtime resolves class usage pools and filters by class role."
                ),
            },
            "warpriest_domain_string_requires": {
                "status": "Open",
                "detail": "Warpriest domain progression grants use string `requires` (e.g. Storm Domain) rather than trait package ids.",
            },
        },
        "indexed_choice_groups_by_class": choice_summary,
    }
    OUT_JSON.write_text(json.dumps(report, indent=2))

    def md_table(headers: list[str], rows: list[dict]) -> str:
        if not rows:
            return "_None._\n\n"
        lines = [
            "| " + " | ".join(headers) + " |",
            "| " + " | ".join(["---"] * len(headers)) + " |",
        ]
        for r in rows:
            lines.append(
                "| "
                + " | ".join(str(r.get(h, "")).replace("|", "\\|") for h in headers)
                + " |"
            )
        return "\n".join(lines) + "\n\n"

    lines: list[str] = []
    lines.append("# Class feature priority fix — affected classes report\n\n")
    lines.append(
        "Generated from `generated/rules_index.json`. "
        "Regenerate: `python tools/etl/generate_class_feature_priority_report.py`\n\n"
    )
    lines.append("## Summary\n\n")
    lines.append("| Step | Status | Classes | Items | Compendium features (global) |\n")
    lines.append("|------|--------|---------|-------|------------------------------|\n")
    ft = report["meta"]["feature_totals"]
    for label, status, key, global_n in [
        ("P0 — Class-feature granted powers", "Fixed (`5609f82`)", "P0_class_feature_granted_powers", "—"),
        ("P0 — Theme / path power level resolution", "Fixed (`5609f82`)", None, "—"),
        ("P1a — Nested power choice groups", "Fixed (`9b4c41e`)", "P1a_nested_power_choices", "—"),
        ("P1b — Nested class-feature choice groups", "Fixed (`9b4c41e`)", "P1b_nested_class_feature_choices", "—"),
        ("P1c — `rules.modify Power` (power cards)", "Fixed", "P1c_modify_power", str(ft["modify_power"])),
        ("P1d — `rules.modify Weapon`", "Fixed", "P1d_modify_weapon", str(ft["modify_weapon"])),
        ("P1e — Essentials build suggested powers", "Fixed (`9b4c41e`)", "P1e_essentials_build_powers", "—"),
        ("P1f — `rules.replace`", "Fixed", "P1f_rules_replace", str(ft["replace"])),
    ]:
        if key:
            cc, ic = report["steps"][key]["counts"]
            lines.append(f"| {label} | {status} | {cc} | {ic} | {global_n} |\n")
        else:
            lines.append(f"| {label} | {status} | — | — | {global_n} |\n")

    lines.append("\n**Notes:**\n\n")
    lines.append(
        "- **P1a/P1b** counts are *player-visible* nested picks (parent option in an indexed `classFeature` group). "
        "Hybrid/internal-only Power selects (~90 in the audit) are excluded.\n"
    )
    lines.append(
        "- **P1d** compendium has 127 `modify Weapon` rows; class-mapped features (Rogue Weapon Talent, Druid of Summer, …) "
        "apply in attack preview. Internal Arena Weapon rows without a `Class` field remain unmapped — "
        "see [unmapped section](#p1d-unmapped-weapon-modify-features).\n"
    )
    lines.append(
        "- **P1c/P1f follow-ups:** trait-package pact chains and DMG2 role-bucket powerswaps are fixed; "
        "see [follow-ups](#follow-ups).\n"
    )
    lines.append(
        f"- **Trait package map:** {report['meta']['trait_package_mappings']} selectable class features "
        "indexed in `traitPackageIdByClassFeatureId`.\n"
    )
    lines.append(
        "- **Indexed choice groups** exist for 46 classes; full list in "
        "[appendix](#appendix-indexed-choice-groups-by-class).\n"
    )

    sections = [
        (
            "P0 — Class-feature granted powers",
            "P0_class_feature_granted_powers",
            "When the player selects a class-feature option, `rules.grant type=Power` on that feature must appear on the character.",
            "p0",
        ),
        (
            "P1a — Nested power choice groups",
            "P1a_nested_power_choices",
            "After picking a parent option, expose a dependent power pick (`classPower:{featureId}` with `visibleWhen`).",
            "p1a",
        ),
        (
            "P1b — Nested class-feature choice groups",
            "P1b_nested_class_feature_choices",
            "After picking a parent option, expose a dependent class-feature pick (`classFeature:{featureId}` with `visibleWhen`).",
            "p1b",
        ),
        (
            "P1c — Class-feature `rules.modify Power`",
            "P1c_modify_power",
            "Apply compendium power patches (Usage, Display, Keywords, …) on power cards from active class features.",
            "p1c",
        ),
        (
            "P1d — Class-feature `rules.modify Weapon` (class-mapped)",
            "P1d_modify_weapon",
            "Weapon key ability, damage die, off-hand/load properties — only features with explicit `Class` in compendium.",
            "p1d",
        ),
        (
            "P1e — Essentials build suggested powers",
            "P1e_essentials_build_powers",
            "Pre-fill empty PHB power slots when player selects an `ID_FMP_BUILD_*` Essentials build.",
            "p1e",
        ),
        (
            "P1f — Class-feature `rules.replace`",
            "P1f_rules_replace",
            "Swap granted powers at higher levels (pact upgrades, Warpriest dailies, etc.).",
            "p1f",
        ),
    ]

    for title, key, desc, fmt in sections:
        lines.append(f"\n## {title}\n\n")
        lines.append(f"_{desc}_\n\n")
        lines.append(f"**Status:** {report['steps'][key]['status']}\n\n")
        step = report["steps"][key]
        if not step["classes"]:
            lines.append("_No class-mapped entries._\n\n")
            continue
        for cls_name, items in sorted(step["classes"].items()):
            lines.append(f"### {cls_name}\n\n")
            if fmt in ("p0", "p1a"):
                rows = [
                    {
                        "Choice path": i.get("choice_path"),
                        "Feature": i.get("feature"),
                        "Detail": i.get("powers_granted") or i.get("nested_key"),
                    }
                    for i in items
                ]
                lines.append(md_table(["Choice path", "Feature", "Detail"], rows))
            elif fmt == "p1b":
                for i in items:
                    opts = ", ".join(i.get("options", []))
                    lines.append(f"- **{i['choice_path']}** (`{i['nested_key']}`): {opts}\n")
                lines.append("\n")
            elif fmt == "p1e":
                rows = [{"Build": i["build"], "Suggested powers": i["suggested_powers"]} for i in items]
                lines.append(md_table(["Build", "Suggested powers"], rows))
            elif fmt in ("p1c", "p1d"):
                rows = [
                    {
                        "Feature": i["feature"],
                        "Modify fields": ", ".join(i["fields"]),
                        "Rules": i["count"],
                    }
                    for i in items
                ]
                lines.append(md_table(["Feature", "Modify fields", "Rules"], rows))
            elif fmt == "p1f":
                rows = [{"Feature": i["feature"], "Replace rules": i["count"]} for i in items]
                lines.append(md_table(["Feature", "Replace rules"], rows))

    lines.append(
        "\n## Follow-ups\n\n"
        "_Additional gaps discovered during P1 implementation._\n\n"
    )
    lines.append("| Item | Status | Detail |\n")
    lines.append("|------|--------|--------|\n")
    for key, row in report["followups"].items():
        title = key.replace("_", " ").title()
        lines.append(f"| {title} | {row['status']} | {row['detail']} |\n")

    lines.append("\n## P0 — Theme / path power level resolution\n\n")
    lines.append(
        "_Powers whose level lives on the parent theme feature (not the power row) must appear on Theme tab and power lists._\n\n"
    )
    lines.append("**Status:** Fixed (`5609f82`)\n\n")
    lines.append(
        "**Example:** Bloodsworn → Bloodied Determination (`ID_FMP_POWER_16429`, level from parent feature `ID_FMP_CLASS_FEATURE_4469`).\n\n"
    )
    lines.append(
        "**Affected:** All theme, paragon path, and epic destiny features with `rules.grant type=Power` where the power row lacks `Level`.\n\n"
    )

    lines.append("\n## P1d — Unmapped weapon modify features\n\n")
    lines.append(
        "_127 compendium class features have `rules.modify type=Weapon`; 124 lack a `Class` field and are internal weapon definition rows._\n\n"
    )
    for bucket, items in sorted(weapon_unmapped.items(), key=lambda x: -len(x[1])):
        lines.append(f"### {bucket} ({len(items)} features)\n\n")
        if len(items) <= 8:
            for i in items:
                lines.append(f"- {i['feature']} ({', '.join(i['fields'])})\n")
        else:
            lines.append(
                f"- Sample: {items[0]['feature']}, {items[1]['feature']}, … ({len(items)} total)\n"
            )
            fields = sorted(set(f for i in items for f in i["fields"]))
            lines.append(f"- Fields modified: {', '.join(fields)}\n")
        lines.append("\n")

    lines.append("\n## Appendix: Indexed choice groups by class\n\n")
    lines.append("_Existing L1 `classFeatureChoiceGroupsByClassId` before runtime nested append._\n\n")
    for cls_name, groups in sorted(report["indexed_choice_groups_by_class"].items()):
        lines.append(f"### {cls_name}\n\n")
        for g in groups:
            vw = ""
            if g.get("visible_when"):
                vw = f" _(visible when {g['visible_when'].get('groupKey')} = option)_"
            if g["kind"] == "classFeature":
                opts = ", ".join(g.get("options") or [])
                lines.append(f"- **{g['group']}** — pick {g['pick_count']}: {opts}{vw}\n")
            else:
                lines.append(
                    f"- **{g['group']}** — power pick {g['pick_count']} "
                    f"(pool {g.get('power_pool_size', '?')}){vw}\n"
                )
        lines.append("\n")

    OUT_MD.write_text("".join(lines))
    print(f"Wrote {OUT_MD.relative_to(ROOT)}")
    print(f"Wrote {OUT_JSON.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
