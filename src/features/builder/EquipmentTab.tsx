import { useMemo, useState, type CSSProperties } from "react";
import type { Armor, CharacterBuild, EnhancementLevel, Implement, MagicItem, RulesIndex, Weapon } from "../../rules/models";
import type { EquipmentCombatBonuses } from "../../rules/equipment";
import { normalizeCharacterEquipment } from "../../rules/equipment";
import { equipmentEnchantmentEffects } from "../../rules/equipmentEnchantmentEffects";
import {
  enchantmentFamilyKeyFromId,
  equipmentDuplicateEnchantmentWarnings,
  findEnchantmentFamilyById,
  formatEnchantmentFamilyLabel,
  type EnchantmentFamily
} from "../../rules/enchantmentFamilies";
import { AdjustableNumberInput } from "../../ui/AdjustableNumberInput";
import { ensureSelectedEntityInFiltered, filterRulesEntitiesByQuery } from "./featPowerFilters";
import {
  setImplementEnchantmentFamily,
  setImplementEnhancement,
  setImplementSuperior,
  setNeckEnchantmentFamily,
  setNeckEnhancement,
  setStandardSlotBase,
  setStandardSlotEnchantmentFamily,
  setStandardSlotEnhancement,
  type StandardEquipmentSlotKey
} from "./equipmentBuildUpdates";
import {
  magicArmorEnchantmentFamilies,
  magicArmorOptions,
  magicImplementEnchantmentFamilies,
  magicImplementOptions,
  magicNeckEnchantmentFamilies,
  magicNeckOptions,
  magicWeaponEnchantmentFamilies,
  magicWeaponOptions
} from "./magicItemOptions";

interface EquipmentTabProps {
  index: RulesIndex;
  build: CharacterBuild;
  onBuildChange: (next: CharacterBuild) => void;
  magicCombat: EquipmentCombatBonuses;
}

const selectStyle: CSSProperties = {
  width: "100%",
  marginTop: "0.2rem",
  padding: "0.35rem",
  borderRadius: "6px",
  border: "1px solid var(--panel-border)",
  boxSizing: "border-box"
};

const searchStyle: CSSProperties = {
  width: "100%",
  marginTop: "0.2rem",
  padding: "0.35rem 0.45rem",
  borderRadius: "6px",
  border: "1px solid var(--panel-border)",
  boxSizing: "border-box"
};

const slotSectionStyle: CSSProperties = {
  padding: "0.65rem 0.75rem",
  borderRadius: "8px",
  border: "1px solid var(--panel-border)",
  backgroundColor: "var(--surface-0)",
  display: "grid",
  gap: "0.55rem"
};

const slotTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: "0.92rem",
  fontWeight: 700,
  color: "var(--text-primary)"
};

function filterEnchantmentFamilies(families: EnchantmentFamily[], query: string): EnchantmentFamily[] {
  const q = query.trim().toLowerCase();
  if (!q) return families;
  return families.filter(
    (f) => f.displayName.toLowerCase().includes(q) || f.key.includes(q) || formatEnchantmentFamilyLabel(f).toLowerCase().includes(q)
  );
}

function ensureSelectedFamilyInFiltered(
  filtered: EnchantmentFamily[],
  selectedKey: string | undefined,
  allFamilies: EnchantmentFamily[]
): EnchantmentFamily[] {
  if (!selectedKey) return filtered;
  if (filtered.some((f) => f.key === selectedKey)) return filtered;
  const selected = allFamilies.find((f) => f.key === selectedKey);
  return selected ? [selected, ...filtered] : filtered;
}

function EnchantmentPlusInput(props: {
  title: string;
  hasEnchantment: boolean;
  allowedEnhancements: EnhancementLevel[];
  value: number;
  onChange: (value: EnhancementLevel) => void;
}): JSX.Element {
  const { title, hasEnchantment, allowedEnhancements, value, onChange } = props;
  if (hasEnchantment && allowedEnhancements.length > 0) {
    return (
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value) as EnhancementLevel)}
        style={{ ...selectStyle, marginTop: "0.25rem" }}
        aria-label={`${title} enhancement`}
      >
        {allowedEnhancements.map((n) => (
          <option key={n} value={n}>
            +{n}
          </option>
        ))}
      </select>
    );
  }
  return (
    <AdjustableNumberInput
      min={0}
      max={6}
      value={value}
      onChange={onChange}
      ariaLabel={`${title} enhancement`}
      style={{ marginTop: "0.25rem" }}
    />
  );
}

interface StandardSlotSectionProps {
  title: string;
  baseLabel: string;
  baseOptions: Armor[] | Weapon[];
  baseValue: string | undefined;
  onBaseChange: (id: string | undefined) => void;
  baseSearch: string;
  onBaseSearchChange: (value: string) => void;
  basePlaceholder: string;
  formatBaseOption: (item: Armor | Weapon) => string;
  enchantmentFamilies: EnchantmentFamily[];
  selectedFamilyKey: string | undefined;
  onEnchantmentFamilyChange: (familyKey: string | undefined) => void;
  enchantmentSearch: string;
  onEnchantmentSearchChange: (value: string) => void;
  enhancement: number;
  onEnhancementChange: (value: EnhancementLevel) => void;
}

function StandardSlotSection(props: StandardSlotSectionProps): JSX.Element {
  const {
    title,
    baseLabel,
    baseOptions,
    baseValue,
    onBaseChange,
    baseSearch,
    onBaseSearchChange,
    basePlaceholder,
    formatBaseOption,
    enchantmentFamilies,
    selectedFamilyKey,
    onEnchantmentFamilyChange,
    enchantmentSearch,
    onEnchantmentSearchChange,
    enhancement,
    onEnhancementChange
  } = props;

  const selectedFamily = enchantmentFamilies.find((f) => f.key === selectedFamilyKey);

  const filteredBase = useMemo(
    () => ensureSelectedEntityInFiltered(filterRulesEntitiesByQuery(baseOptions, baseSearch), baseValue, baseOptions),
    [baseOptions, baseSearch, baseValue]
  );
  const filteredFamilies = useMemo(
    () =>
      ensureSelectedFamilyInFiltered(
        filterEnchantmentFamilies(enchantmentFamilies, enchantmentSearch),
        selectedFamilyKey,
        enchantmentFamilies
      ),
    [enchantmentFamilies, enchantmentSearch, selectedFamilyKey]
  );

  return (
    <section style={slotSectionStyle}>
      <h4 style={slotTitleStyle}>{title}</h4>
      <label style={{ fontSize: "0.88rem" }}>
        Filter {baseLabel.toLowerCase()}
        <input
          type="search"
          value={baseSearch}
          onChange={(e) => onBaseSearchChange(e.target.value)}
          placeholder={basePlaceholder}
          style={searchStyle}
        />
      </label>
      <label style={{ fontSize: "0.88rem" }}>
        1. {baseLabel}
        <select value={baseValue || ""} onChange={(e) => onBaseChange(e.target.value || undefined)} style={selectStyle}>
          <option value="">None</option>
          {filteredBase.map((item) => (
            <option key={item.id} value={item.id}>
              {formatBaseOption(item)}
            </option>
          ))}
        </select>
      </label>
      <label style={{ fontSize: "0.88rem" }}>
        Filter enchantment
        <input
          type="search"
          value={enchantmentSearch}
          onChange={(e) => onEnchantmentSearchChange(e.target.value)}
          placeholder="Magic item name"
          style={searchStyle}
        />
      </label>
      <label style={{ fontSize: "0.88rem" }}>
        2. Enchantment
        <select
          value={selectedFamilyKey || ""}
          onChange={(e) => onEnchantmentFamilyChange(e.target.value || undefined)}
          style={selectStyle}
        >
          <option value="">None (mundane)</option>
          {filteredFamilies.map((family) => (
            <option key={family.key} value={family.key}>
              {formatEnchantmentFamilyLabel(family)}
            </option>
          ))}
        </select>
      </label>
      <label style={{ fontSize: "0.88rem", display: "block" }}>
        3. Plus {selectedFamily ? `(+${selectedFamily.allowedEnhancements.join(", +")})` : "(+0–+6)"}
        <EnchantmentPlusInput
          title={title}
          hasEnchantment={!!selectedFamily}
          allowedEnhancements={selectedFamily?.allowedEnhancements ?? []}
          value={enhancement}
          onChange={onEnhancementChange}
        />
      </label>
    </section>
  );
}

export function EquipmentTab({ index, build, onBuildChange, magicCombat }: EquipmentTabProps): JSX.Element {
  const equipment = useMemo(() => normalizeCharacterEquipment(build.equipment), [build.equipment]);
  const equipmentWarnings = useMemo(() => equipmentDuplicateEnchantmentWarnings(build, index), [build, index]);
  const enchantmentEffects = useMemo(
    () => equipmentEnchantmentEffects(equipment, index),
    [equipment, index]
  );

  const armorOptions = useMemo(
    () => index.armors.filter((a) => (a.armorType || "").toLowerCase() !== "shield"),
    [index.armors]
  );
  const shieldOptions = useMemo(
    () => index.armors.filter((a) => (a.armorType || "").toLowerCase() === "shield"),
    [index.armors]
  );
  const weaponsSorted = useMemo(
    () =>
      [...(index.weapons ?? [])].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })),
    [index.weapons]
  );
  const implementsSorted = useMemo(
    () =>
      [...(index.implements ?? [])].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })),
    [index.implements]
  );

  const selectedArmor = armorOptions.find((a) => a.id === equipment.armor?.baseId);
  const selectedShield = shieldOptions.find((a) => a.id === equipment.shield?.baseId);
  const selectedMainWeapon = weaponsSorted.find((w) => w.id === equipment.mainHand?.baseId);
  const selectedOffHandWeapon = weaponsSorted.find((w) => w.id === equipment.offHand?.baseId);

  const magicArmorCatalog = useMemo(() => magicArmorOptions(index, selectedArmor), [index, selectedArmor]);
  const magicShieldCatalog = useMemo(() => magicArmorOptions(index, selectedShield), [index, selectedShield]);
  const magicMainWeaponCatalog = useMemo(
    () => magicWeaponOptions(index, selectedMainWeapon),
    [index, selectedMainWeapon]
  );
  const magicOffHandCatalog = useMemo(
    () => magicWeaponOptions(index, selectedOffHandWeapon),
    [index, selectedOffHandWeapon]
  );
  const magicNeckCatalog = useMemo(() => magicNeckOptions(index), [index]);
  const magicImplementCatalog = useMemo(() => magicImplementOptions(index), [index]);

  const magicArmorFamilies = useMemo(
    () => magicArmorEnchantmentFamilies(index, selectedArmor),
    [index, selectedArmor]
  );
  const magicShieldFamilies = useMemo(
    () => magicArmorEnchantmentFamilies(index, selectedShield),
    [index, selectedShield]
  );
  const magicMainWeaponFamilies = useMemo(
    () => magicWeaponEnchantmentFamilies(index, selectedMainWeapon),
    [index, selectedMainWeapon]
  );
  const magicOffHandFamilies = useMemo(
    () => magicWeaponEnchantmentFamilies(index, selectedOffHandWeapon),
    [index, selectedOffHandWeapon]
  );
  const magicNeckFamilies = useMemo(() => magicNeckEnchantmentFamilies(index), [index]);
  const magicImplementFamilies = useMemo(() => magicImplementEnchantmentFamilies(index), [index]);

  const [armorBaseSearch, setArmorBaseSearch] = useState("");
  const [shieldBaseSearch, setShieldBaseSearch] = useState("");
  const [mainWeaponBaseSearch, setMainWeaponBaseSearch] = useState("");
  const [offHandBaseSearch, setOffHandBaseSearch] = useState("");
  const [implementBaseSearch, setImplementBaseSearch] = useState("");
  const [armorEnchantSearch, setArmorEnchantSearch] = useState("");
  const [shieldEnchantSearch, setShieldEnchantSearch] = useState("");
  const [mainEnchantSearch, setMainEnchantSearch] = useState("");
  const [offHandEnchantSearch, setOffHandEnchantSearch] = useState("");
  const [neckEnchantSearch, setNeckEnchantSearch] = useState("");
  const [implementEnchantSearch, setImplementEnchantSearch] = useState("");

  const filteredImplements = useMemo(
    () =>
      ensureSelectedEntityInFiltered(
        filterRulesEntitiesByQuery(implementsSorted, implementBaseSearch),
        equipment.implement?.superiorImplementId,
        implementsSorted
      ),
    [implementsSorted, implementBaseSearch, equipment.implement?.superiorImplementId]
  );
  const neckFamilyKey = enchantmentFamilyKeyFromId(index, equipment.neck?.enchantmentId);
  const implementFamilyKey = enchantmentFamilyKeyFromId(index, equipment.implement?.enchantmentId);
  const neckSelectedFamily = findEnchantmentFamilyById(index, equipment.neck?.enchantmentId);
  const implementSelectedFamily = findEnchantmentFamilyById(index, equipment.implement?.enchantmentId);

  const filteredNeckFamilies = useMemo(
    () =>
      ensureSelectedFamilyInFiltered(
        filterEnchantmentFamilies(magicNeckFamilies, neckEnchantSearch),
        neckFamilyKey,
        magicNeckFamilies
      ),
    [magicNeckFamilies, neckEnchantSearch, neckFamilyKey]
  );
  const filteredImplementFamilies = useMemo(
    () =>
      ensureSelectedFamilyInFiltered(
        filterEnchantmentFamilies(magicImplementFamilies, implementEnchantSearch),
        implementFamilyKey,
        magicImplementFamilies
      ),
    [magicImplementFamilies, implementEnchantSearch, implementFamilyKey]
  );

  function patchStandard(
    slotKey: StandardEquipmentSlotKey,
    fn: (b: CharacterBuild) => CharacterBuild
  ): void {
    onBuildChange(fn(build));
  }

  const hasMagicBonuses =
    magicCombat.defenses.ac > 0 ||
    magicCombat.defenses.fortitude > 0 ||
    magicCombat.defenses.reflex > 0 ||
    magicCombat.defenses.will > 0 ||
    magicCombat.mainWeaponAttack > 0 ||
    magicCombat.offHandWeaponAttack > 0 ||
    magicCombat.implementAttack > 0;

  return (
    <>
    <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1.05rem", fontWeight: 700 }}>Equipment</h3>
    <div
      style={{
        marginTop: "0.35rem",
        display: "grid",
        gap: "0.85rem",
        padding: "0.75rem",
        borderRadius: "8px",
        border: "1px solid var(--panel-border)",
        backgroundColor: "var(--surface-1)"
      }}
    >
      <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-muted)", lineHeight: 1.45 }}>
        Per slot: pick base gear, an optional magic enchantment, then plus. Enchantments group all compendium +1…+6
        variants into one entry; plus is limited to tiers that exist for that enchantment.
      </p>
      {equipmentWarnings.map((msg) => (
        <p key={msg} style={{ margin: 0, fontSize: "0.82rem", color: "var(--warning-text, #b45309)" }}>
          {msg}
        </p>
      ))}
      {hasMagicBonuses && (
        <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-secondary)" }}>
          Active bonuses: AC +{magicCombat.defenses.ac}, Fort +{magicCombat.defenses.fortitude}, Ref +{" "}
          {magicCombat.defenses.reflex}, Will +{magicCombat.defenses.will}
          {magicCombat.mainWeaponAttack > 0 ? `; main attack +${magicCombat.mainWeaponAttack}` : ""}
          {magicCombat.offHandWeaponAttack > 0 ? `; off-hand attack +${magicCombat.offHandWeaponAttack}` : ""}
          {magicCombat.implementAttack > 0 ? `; implement attack +${magicCombat.implementAttack}` : ""}
        </p>
      )}
      {enchantmentEffects.length > 0 && (
        <div
          style={{
            display: "grid",
            gap: "0.45rem",
            padding: "0.5rem 0.6rem",
            borderRadius: "6px",
            border: "1px solid var(--panel-border)",
            backgroundColor: "var(--surface-0)"
          }}
        >
          <p style={{ margin: 0, fontSize: "0.76rem", fontWeight: 700, color: "var(--text-secondary)" }}>
            Enchantment effects
          </p>
          {enchantmentEffects.map((row) => (
            <div key={row.slotLabel} style={{ fontSize: "0.78rem", lineHeight: 1.45, color: "var(--text-primary)" }}>
              <span style={{ fontWeight: 600 }}>{row.slotLabel}</span>
              <span style={{ color: "var(--text-muted)" }}> — {row.name}</span>
              {row.property && (
                <div style={{ marginTop: "0.15rem", color: "var(--text-secondary)" }}>
                  <span style={{ fontWeight: 600 }}>Property: </span>
                  {row.property}
                </div>
              )}
              {row.power && (
                <div style={{ marginTop: "0.15rem", color: "var(--text-secondary)" }}>
                  <span style={{ fontWeight: 600 }}>Power: </span>
                  {row.power}
                </div>
              )}
              {row.critical && (
                <div style={{ marginTop: "0.15rem", color: "var(--text-secondary)" }}>
                  <span style={{ fontWeight: 600 }}>Critical: </span>
                  {row.critical}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "0.75rem" }}>
        <StandardSlotSection
          title="Armor"
          baseLabel="Armor"
          baseOptions={armorOptions}
          baseValue={equipment.armor?.baseId}
          onBaseChange={(id) => patchStandard("armor", (b) => setStandardSlotBase(b, "armor", id))}
          baseSearch={armorBaseSearch}
          onBaseSearchChange={setArmorBaseSearch}
          basePlaceholder="Name, category…"
          formatBaseOption={(a) => `${(a as Armor).name} (+${(a as Armor).armorBonus || 0} AC)`}
          enchantmentFamilies={magicArmorFamilies}
          selectedFamilyKey={enchantmentFamilyKeyFromId(index, equipment.armor?.enchantmentId)}
          onEnchantmentFamilyChange={(familyKey) =>
            patchStandard("armor", (b) => setStandardSlotEnchantmentFamily(b, index, "armor", familyKey, magicArmorCatalog))
          }
          enchantmentSearch={armorEnchantSearch}
          onEnchantmentSearchChange={setArmorEnchantSearch}
          enhancement={equipment.armor?.enhancement ?? 0}
          onEnhancementChange={(n) =>
            patchStandard("armor", (b) => setStandardSlotEnhancement(b, index, "armor", n, magicArmorCatalog))
          }
        />
        <StandardSlotSection
          title="Shield"
          baseLabel="Shield"
          baseOptions={shieldOptions}
          baseValue={equipment.shield?.baseId}
          onBaseChange={(id) => patchStandard("shield", (b) => setStandardSlotBase(b, "shield", id))}
          baseSearch={shieldBaseSearch}
          onBaseSearchChange={setShieldBaseSearch}
          basePlaceholder="Name"
          formatBaseOption={(a) => `${(a as Armor).name} (+${(a as Armor).armorBonus || 0} AC)`}
          enchantmentFamilies={magicShieldFamilies}
          selectedFamilyKey={enchantmentFamilyKeyFromId(index, equipment.shield?.enchantmentId)}
          onEnchantmentFamilyChange={(familyKey) =>
            patchStandard("shield", (b) => setStandardSlotEnchantmentFamily(b, index, "shield", familyKey, magicShieldCatalog))
          }
          enchantmentSearch={shieldEnchantSearch}
          onEnchantmentSearchChange={setShieldEnchantSearch}
          enhancement={equipment.shield?.enhancement ?? 0}
          onEnhancementChange={(n) =>
            patchStandard("shield", (b) => setStandardSlotEnhancement(b, index, "shield", n, magicShieldCatalog))
          }
        />
      </div>

      <StandardSlotSection
        title="Main hand"
        baseLabel="Weapon"
        baseOptions={weaponsSorted}
        baseValue={equipment.mainHand?.baseId}
        onBaseChange={(id) => patchStandard("mainHand", (b) => setStandardSlotBase(b, "mainHand", id))}
        baseSearch={mainWeaponBaseSearch}
        onBaseSearchChange={setMainWeaponBaseSearch}
        basePlaceholder="Name, category…"
        formatBaseOption={(w) => {
          const weapon = w as Weapon;
          return `${weapon.name}${weapon.weaponCategory ? ` (${weapon.weaponCategory})` : ""}`;
        }}
        enchantmentFamilies={magicMainWeaponFamilies}
        selectedFamilyKey={enchantmentFamilyKeyFromId(index, equipment.mainHand?.enchantmentId)}
        onEnchantmentFamilyChange={(familyKey) =>
          patchStandard("mainHand", (b) =>
            setStandardSlotEnchantmentFamily(b, index, "mainHand", familyKey, magicMainWeaponCatalog)
          )
        }
        enchantmentSearch={mainEnchantSearch}
        onEnchantmentSearchChange={setMainEnchantSearch}
        enhancement={equipment.mainHand?.enhancement ?? 0}
        onEnhancementChange={(n) =>
          patchStandard("mainHand", (b) => setStandardSlotEnhancement(b, index, "mainHand", n, magicMainWeaponCatalog))
        }
      />

      <StandardSlotSection
        title="Off hand"
        baseLabel="Weapon"
        baseOptions={weaponsSorted}
        baseValue={equipment.offHand?.baseId}
        onBaseChange={(id) => patchStandard("offHand", (b) => setStandardSlotBase(b, "offHand", id))}
        baseSearch={offHandBaseSearch}
        onBaseSearchChange={setOffHandBaseSearch}
        basePlaceholder="Name, category…"
        formatBaseOption={(w) => {
          const weapon = w as Weapon;
          return `${weapon.name}${weapon.weaponCategory ? ` (${weapon.weaponCategory})` : ""}`;
        }}
        enchantmentFamilies={magicOffHandFamilies}
        selectedFamilyKey={enchantmentFamilyKeyFromId(index, equipment.offHand?.enchantmentId)}
        onEnchantmentFamilyChange={(familyKey) =>
          patchStandard("offHand", (b) =>
            setStandardSlotEnchantmentFamily(b, index, "offHand", familyKey, magicOffHandCatalog)
          )
        }
        enchantmentSearch={offHandEnchantSearch}
        onEnchantmentSearchChange={setOffHandEnchantSearch}
        enhancement={equipment.offHand?.enhancement ?? 0}
        onEnhancementChange={(n) =>
          patchStandard("offHand", (b) => setStandardSlotEnhancement(b, index, "offHand", n, magicOffHandCatalog))
        }
      />

      <section style={slotSectionStyle}>
        <h4 style={slotTitleStyle}>Implement</h4>
        <label style={{ fontSize: "0.88rem" }}>
          Filter superior implement
          <input
            type="search"
            value={implementBaseSearch}
            onChange={(e) => setImplementBaseSearch(e.target.value)}
            placeholder="Name, group…"
            style={searchStyle}
          />
        </label>
        <label style={{ fontSize: "0.88rem" }}>
          1. Superior implement
          <select
            value={equipment.implement?.superiorImplementId || ""}
            onChange={(e) => onBuildChange(setImplementSuperior(build, e.target.value || undefined))}
            style={selectStyle}
          >
            <option value="">None</option>
            {filteredImplements.map((imp: Implement) => (
              <option key={imp.id} value={imp.id}>
                {imp.name}
                {imp.implementGroup ? ` (${imp.implementGroup})` : ""}
              </option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: "0.88rem" }}>
          Filter enchantment
          <input
            type="search"
            value={implementEnchantSearch}
            onChange={(e) => setImplementEnchantSearch(e.target.value)}
            placeholder="Staff, orb, holy symbol…"
            style={searchStyle}
          />
        </label>
        <label style={{ fontSize: "0.88rem" }}>
          2. Enchantment
          <select
            value={implementFamilyKey || ""}
            onChange={(e) =>
              onBuildChange(setImplementEnchantmentFamily(build, index, e.target.value || undefined, magicImplementCatalog))
            }
            style={selectStyle}
          >
            <option value="">None (mundane)</option>
            {filteredImplementFamilies.map((family) => (
              <option key={family.key} value={family.key}>
                {formatEnchantmentFamilyLabel(family)}
              </option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: "0.88rem", display: "block" }}>
          3. Plus{" "}
          {implementSelectedFamily
            ? `(+${implementSelectedFamily.allowedEnhancements.join(", +")})`
            : "(+0–+6)"}
          <EnchantmentPlusInput
            title="Implement"
            hasEnchantment={!!implementSelectedFamily}
            allowedEnhancements={implementSelectedFamily?.allowedEnhancements ?? []}
            value={equipment.implement?.enhancement ?? 0}
            onChange={(n) => onBuildChange(setImplementEnhancement(build, index, n, magicImplementCatalog))}
          />
        </label>
      </section>

      <section style={slotSectionStyle}>
        <h4 style={slotTitleStyle}>Neck</h4>
        <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-muted)" }}>
          No mundane base — magic enchantment and plus only.
        </p>
        <label style={{ fontSize: "0.88rem" }}>
          Filter enchantment
          <input
            type="search"
            value={neckEnchantSearch}
            onChange={(e) => setNeckEnchantSearch(e.target.value)}
            placeholder="Cloak, amulet…"
            style={searchStyle}
          />
        </label>
        <label style={{ fontSize: "0.88rem" }}>
          1. Enchantment
          <select
            value={neckFamilyKey || ""}
            onChange={(e) =>
              onBuildChange(setNeckEnchantmentFamily(build, index, e.target.value || undefined, magicNeckCatalog))
            }
            style={selectStyle}
          >
            <option value="">None</option>
            {filteredNeckFamilies.map((family) => (
              <option key={family.key} value={family.key}>
                {formatEnchantmentFamilyLabel(family)}
              </option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: "0.88rem", display: "block" }}>
          2. Plus {neckSelectedFamily ? `(+${neckSelectedFamily.allowedEnhancements.join(", +")})` : "(+0–+6)"}
          <EnchantmentPlusInput
            title="Neck"
            hasEnchantment={!!neckSelectedFamily}
            allowedEnhancements={neckSelectedFamily?.allowedEnhancements ?? []}
            value={equipment.neck?.enhancement ?? 0}
            onChange={(n) => onBuildChange(setNeckEnhancement(build, index, n, magicNeckCatalog))}
          />
        </label>
      </section>
    </div>
    </>
  );
}
