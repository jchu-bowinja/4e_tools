import { useMemo, useState, type ChangeEvent, type CSSProperties, type ReactNode } from "react";
import type {
  Armor,
  CharacterBuild,
  CharacterEquipment,
  EnhancementLevel,
  Implement,
  MagicItem,
  RulesIndex,
  Weapon
} from "../../rules/models";
import type { EquipmentCombatBonuses } from "../../rules/equipment";
import { normalizeCharacterEquipment } from "../../rules/equipment";
import {
  describeArmor,
  describeImplement,
  describeMagicItem,
  describeWeapon
} from "../../rules/equipmentDescriptions";
import { findMagicItem } from "../../rules/magicItemEquipment";
import { EquipmentSelectionDetails } from "./EquipmentSelectionDetails";
import {
  enchantmentFamilyKeyFromId,
  equipmentDuplicateEnchantmentWarnings,
  findEnchantmentFamilyById,
  formatEnchantmentFamilyLabel,
  magicItemFamilyDisplayName,
  type EnchantmentFamily
} from "../../rules/enchantmentFamilies";
import { AdjustableNumberInput, adjustableNumberWidthCh } from "../../ui/AdjustableNumberInput";
import { equipmentSlotGoldCost, type EquipmentPriceSlot } from "../../rules/equipmentItemPrice";
import { EquipmentSlotActions } from "./EquipmentSlotActions";
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

export type EquipmentEditorSlot = "armor" | "shield" | "mainHand" | "offHand" | "implement" | "neck";
/** Sheet inventory picker: both weapon hands share one category. */
export type EquipmentEditorSlotFilter = EquipmentEditorSlot | "weapon";

export const ADD_EQUIPMENT_OPTIONS: { value: EquipmentEditorSlotFilter; label: string }[] = [
  { value: "armor", label: "Armor" },
  { value: "shield", label: "Shield" },
  { value: "weapon", label: "Weapon" },
  { value: "implement", label: "Implement" },
  { value: "neck", label: "Neck" }
];

export const equipmentPickerSelectStyle: CSSProperties = {
  width: "100%",
  maxWidth: "22rem",
  marginTop: "0.25rem",
  padding: "0.4rem 0.5rem",
  borderRadius: "6px",
  border: "1px solid var(--panel-border)",
  boxSizing: "border-box"
};

interface EquipmentTabProps {
  index: RulesIndex;
  build: CharacterBuild;
  onBuildChange: (next: CharacterBuild) => void;
  magicCombat: EquipmentCombatBonuses;
  /** When embedded in another panel (e.g. character sheet), omit the tab title. */
  hideTitle?: boolean;
  /** When set, only render the editor for this equipment slot. */
  activeSlotOnly?: EquipmentEditorSlotFilter;
  /** Character gold pieces (builder or sheet). */
  gold?: number;
  onGoldChange?: (gold: number) => void;
  /** Add current slot configuration to inventory without spending gold. */
  onAddToInventory?: (slot: EquipmentEditorSlot) => void;
  /** Purchase current slot configuration (deduct gold; sheet also adds to inventory). */
  onBuy?: (slot: EquipmentEditorSlot) => void;
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

const fieldLabelStyle: CSSProperties = {
  fontSize: "0.88rem",
  display: "grid",
  gap: "0.2rem"
};

const selectInlineStyle: CSSProperties = {
  ...selectStyle,
  marginTop: 0
};

const pickerRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr minmax(6.5rem, 9.5rem)",
  gap: "0.45rem",
  alignItems: "center"
};

const inlineFilterStyle: CSSProperties = {
  ...searchStyle,
  marginTop: 0,
  width: "100%"
};

function EquipmentPickerRow(props: {
  filterValue: string;
  onFilterChange: (value: string) => void;
  filterPlaceholder: string;
  filterAriaLabel: string;
  children: ReactNode;
  between?: ReactNode;
}): JSX.Element {
  return (
    <div
      style={{
        ...pickerRowStyle,
        gridTemplateColumns: props.between
          ? "minmax(0, 1fr) auto minmax(6.5rem, 9.5rem)"
          : pickerRowStyle.gridTemplateColumns
      }}
    >
      <div style={{ minWidth: 0 }}>{props.children}</div>
      {props.between}
      <input
        type="search"
        value={props.filterValue}
        onChange={(e) => props.onFilterChange(e.target.value)}
        placeholder={props.filterPlaceholder}
        aria-label={props.filterAriaLabel}
        style={inlineFilterStyle}
      />
    </div>
  );
}

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

function stepEnhancementLevel(
  current: EnhancementLevel,
  allowed: EnhancementLevel[],
  direction: 1 | -1
): EnhancementLevel {
  const sorted = [...allowed].sort((a, b) => a - b);
  if (sorted.length === 0) {
    return Math.max(0, Math.min(6, current + direction)) as EnhancementLevel;
  }
  const idx = sorted.indexOf(current);
  const baseIdx = idx === -1 ? 0 : idx;
  const nextIdx = baseIdx + direction;
  if (nextIdx < 0) return sorted[0]!;
  if (nextIdx >= sorted.length) return sorted[sorted.length - 1]!;
  return sorted[nextIdx]!;
}

function snapEnhancementLevel(value: number, allowed: EnhancementLevel[]): EnhancementLevel {
  const sorted = [...allowed].sort((a, b) => a - b);
  if (sorted.length === 0) {
    return Math.max(0, Math.min(6, Math.trunc(value))) as EnhancementLevel;
  }
  if (sorted.includes(value as EnhancementLevel)) return value as EnhancementLevel;
  return sorted.reduce((best, level) =>
    Math.abs(level - value) < Math.abs(best - value) ? level : best
  );
}

function EnchantmentPlusInput(props: {
  title: string;
  allowedEnhancements: EnhancementLevel[];
  value: number;
  onChange: (value: EnhancementLevel) => void;
}): JSX.Element {
  const { title, allowedEnhancements, value, onChange } = props;
  const sortedAllowed = useMemo(
    () => [...allowedEnhancements].sort((a, b) => a - b),
    [allowedEnhancements]
  );
  const min = sortedAllowed.length > 0 ? sortedAllowed[0]! : 0;
  const max = sortedAllowed.length > 0 ? sortedAllowed[sortedAllowed.length - 1]! : 6;
  const resolved = snapEnhancementLevel(value, sortedAllowed);
  const ariaLabel = `${title} enhancement plus`;

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const raw = event.target.value;
    if (raw === "") {
      onChange(min);
      return;
    }
    const parsed = Number(raw);
    onChange(snapEnhancementLevel(Number.isFinite(parsed) ? parsed : min, sortedAllowed));
  };

  return (
    <div
      className="adjustable-number adjustable-number--compact"
      style={{ marginTop: 0, flexShrink: 0 }}
      title={sortedAllowed.length > 0 ? `Allowed: +${sortedAllowed.join(", +")}` : "+0 to +6"}
    >
      <span
        aria-hidden
        style={{
          fontSize: "0.85rem",
          fontWeight: 600,
          color: "var(--text-secondary)",
          paddingLeft: "0.1rem"
        }}
      >
        +
      </span>
      <input
        type="number"
        min={min}
        max={max}
        value={resolved}
        onChange={handleInputChange}
        aria-label={ariaLabel}
        className="adjustable-number__input"
        style={{ width: adjustableNumberWidthCh(resolved, max) }}
      />
      <div className="adjustable-number__stepper" role="group" aria-label={`${ariaLabel} adjustment`}>
        <button
          type="button"
          className="adjustable-number__step-btn"
          disabled={resolved >= max}
          onClick={() => onChange(stepEnhancementLevel(resolved, sortedAllowed, 1))}
          aria-label={`Increase ${ariaLabel}`}
        >
          +
        </button>
        <button
          type="button"
          className="adjustable-number__step-btn"
          disabled={resolved <= min}
          onClick={() => onChange(stepEnhancementLevel(resolved, sortedAllowed, -1))}
          aria-label={`Decrease ${ariaLabel}`}
        >
          −
        </button>
      </div>
    </div>
  );
}

interface StandardSlotSectionProps {
  index: RulesIndex;
  title: string;
  baseLabel: string;
  baseKind: "armor" | "weapon";
  baseOptions: Armor[] | Weapon[];
  baseValue: string | undefined;
  enchantmentId?: string;
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
  priceSlot: EquipmentPriceSlot;
  equipment: CharacterEquipment;
  gold: number;
  showAddToInventory: boolean;
  onAddToInventory?: () => void;
  onBuy?: () => void;
}

function StandardSlotSection(props: StandardSlotSectionProps): JSX.Element {
  const {
    index,
    title,
    baseLabel,
    baseKind,
    baseOptions,
    baseValue,
    enchantmentId,
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
    onEnhancementChange,
    priceSlot,
    equipment,
    gold,
    showAddToInventory,
    onAddToInventory,
    onBuy
  } = props;

  const price = equipmentSlotGoldCost(props.index, priceSlot, equipment);
  const hasSelection = Boolean(baseValue || enchantmentId);

  const selectedFamily = enchantmentFamilies.find((f) => f.key === selectedFamilyKey);
  const baseItem = baseValue ? baseOptions.find((item) => item.id === baseValue) : undefined;
  const baseDescription =
    baseItem && baseKind === "armor"
      ? describeArmor(baseItem as Armor)
      : baseItem && baseKind === "weapon"
        ? describeWeapon(baseItem as Weapon)
        : undefined;
  const enchantmentItem = enchantmentId ? findMagicItem(index, enchantmentId) : undefined;
  const enchantmentDescription = enchantmentItem ? describeMagicItem(enchantmentItem) : undefined;

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
      <label style={fieldLabelStyle}>
        1. {baseLabel}
        <EquipmentPickerRow
          filterValue={baseSearch}
          onFilterChange={onBaseSearchChange}
          filterPlaceholder={basePlaceholder}
          filterAriaLabel={`Filter ${baseLabel.toLowerCase()}`}
        >
          <select
            value={baseValue || ""}
            onChange={(e) => onBaseChange(e.target.value || undefined)}
            style={selectInlineStyle}
          >
            <option value="">None</option>
            {filteredBase.map((item) => (
              <option key={item.id} value={item.id}>
                {formatBaseOption(item)}
              </option>
            ))}
          </select>
        </EquipmentPickerRow>
      </label>
      <label style={fieldLabelStyle}>
        2. Enchantment
        <EquipmentPickerRow
          filterValue={enchantmentSearch}
          onFilterChange={onEnchantmentSearchChange}
          filterPlaceholder="Magic item name"
          filterAriaLabel="Filter enchantment"
          between={
            <EnchantmentPlusInput
              title={title}
              allowedEnhancements={selectedFamily?.allowedEnhancements ?? []}
              value={enhancement}
              onChange={onEnhancementChange}
            />
          }
        >
          <select
            value={selectedFamilyKey || ""}
            onChange={(e) => onEnchantmentFamilyChange(e.target.value || undefined)}
            style={selectInlineStyle}
          >
            <option value="">None (mundane)</option>
            {filteredFamilies.map((family) => (
              <option key={family.key} value={family.key}>
                {formatEnchantmentFamilyLabel(family)}
              </option>
            ))}
          </select>
        </EquipmentPickerRow>
      </label>
      <EquipmentSelectionDetails
        baseName={baseItem?.name}
        baseDescription={baseDescription}
        enchantmentName={enchantmentItem ? magicItemFamilyDisplayName(enchantmentItem.name) : undefined}
        enchantmentDescription={enchantmentDescription}
      />
      <EquipmentSlotActions
        price={price}
        gold={gold}
        hasSelection={hasSelection}
        showAddToInventory={showAddToInventory}
        onAddToInventory={onAddToInventory}
        onBuy={onBuy}
      />
    </section>
  );
}

export function EquipmentTab({
  index,
  build,
  onBuildChange,
  magicCombat,
  hideTitle,
  activeSlotOnly: activeSlotOnlyProp,
  gold: goldProp,
  onGoldChange,
  onAddToInventory,
  onBuy
}: EquipmentTabProps): JSX.Element {
  const [pickedSlot, setPickedSlot] = useState<EquipmentEditorSlotFilter | "">("");
  const useParentSlotPicker = hideTitle === true;
  const activeSlotFilter: EquipmentEditorSlotFilter | undefined = useParentSlotPicker
    ? activeSlotOnlyProp
    : pickedSlot || undefined;

  const equipment = useMemo(() => normalizeCharacterEquipment(build.equipment), [build.equipment]);
  const gold = goldProp ?? build.gold ?? 0;
  const showInventoryActions = Boolean(onAddToInventory || onBuy);
  const showAddToInventory = Boolean(onAddToInventory);

  const slotActionProps = (slot: EquipmentEditorSlot) => {
    if (!showInventoryActions) {
      return {
        priceSlot: slot,
        equipment,
        gold,
        showAddToInventory: false,
        onAddToInventory: undefined,
        onBuy: undefined
      };
    }
    return {
      priceSlot: slot,
      equipment,
      gold,
      showAddToInventory,
      onAddToInventory: onAddToInventory ? () => onAddToInventory(slot) : undefined,
      onBuy: onBuy ? () => onBuy(slot) : undefined
    };
  };
  const equipmentWarnings = useMemo(() => equipmentDuplicateEnchantmentWarnings(build, index), [build, index]);

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
  const selectedSuperiorImplement = implementsSorted.find((i) => i.id === equipment.implement?.superiorImplementId);
  const implementEnchantmentItem = equipment.implement?.enchantmentId
    ? findMagicItem(index, equipment.implement.enchantmentId)
    : undefined;
  const neckEnchantmentItem = equipment.neck?.enchantmentId ? findMagicItem(index, equipment.neck.enchantmentId) : undefined;

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

  const showSlot = (slot: EquipmentEditorSlot): boolean => {
    if (!activeSlotFilter) return false;
    if (activeSlotFilter === "weapon") return slot === "mainHand" || slot === "offHand";
    return activeSlotFilter === slot;
  };
  return (
    <>
    {!hideTitle && <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1.05rem", fontWeight: 700 }}>Equipment</h3>}
    <div
      style={{
        marginTop: hideTitle ? 0 : "0.35rem",
        display: "grid",
        gap: "0.85rem",
        padding: "0.75rem",
        borderRadius: "8px",
        border: "1px solid var(--panel-border)",
        backgroundColor: "var(--surface-1)"
      }}
    >
      {onGoldChange && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.45rem 0.55rem",
            borderRadius: "6px",
            border: "1px solid var(--panel-border)",
            backgroundColor: "var(--surface-0)"
          }}
        >
          <span style={{ fontSize: "0.88rem", fontWeight: 600 }}>Gold</span>
          <AdjustableNumberInput
            compact
            min={0}
            max={99_999_999}
            value={gold}
            onChange={onGoldChange}
            ariaLabel="Gold pieces"
          />
          <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>gp</span>
        </div>
      )}
      {!useParentSlotPicker && (
        <select
          value={pickedSlot}
          onChange={(e) => setPickedSlot((e.target.value || "") as EquipmentEditorSlotFilter | "")}
          style={equipmentPickerSelectStyle}
          aria-label="Add equipment"
        >
          <option value="">Add equipment…</option>
          {ADD_EQUIPMENT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )}
      {!activeSlotFilter && (
        <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-muted)", lineHeight: 1.45 }}>
          Per slot: pick base gear, an optional magic enchantment, then plus. Enchantments group all compendium +1…+6
          variants into one entry; plus is limited to tiers that exist for that enchantment.
        </p>
      )}
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
      {showSlot("armor") && (
        <StandardSlotSection
          index={index}
          title="Armor"
          baseLabel="Armor"
          baseKind="armor"
          baseOptions={armorOptions}
          baseValue={equipment.armor?.baseId}
          enchantmentId={equipment.armor?.enchantmentId}
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
          {...slotActionProps("armor")}
        />
      )}

      {showSlot("shield") && (
        <StandardSlotSection
          index={index}
          title="Shield"
          baseLabel="Shield"
          baseKind="armor"
          baseOptions={shieldOptions}
          baseValue={equipment.shield?.baseId}
          enchantmentId={equipment.shield?.enchantmentId}
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
          {...slotActionProps("shield")}
        />
      )}

      {showSlot("mainHand") && (
      <StandardSlotSection
        index={index}
        title="Main hand"
        baseLabel="Weapon"
        baseKind="weapon"
        baseOptions={weaponsSorted}
        baseValue={equipment.mainHand?.baseId}
        enchantmentId={equipment.mainHand?.enchantmentId}
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
        {...slotActionProps("mainHand")}
      />
      )}

      {showSlot("offHand") && (
      <StandardSlotSection
        index={index}
        title="Off hand"
        baseLabel="Weapon"
        baseKind="weapon"
        baseOptions={weaponsSorted}
        baseValue={equipment.offHand?.baseId}
        enchantmentId={equipment.offHand?.enchantmentId}
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
        {...slotActionProps("offHand")}
      />
      )}

      {showSlot("implement") && (
      <section style={slotSectionStyle}>
        <h4 style={slotTitleStyle}>Implement</h4>
        <label style={fieldLabelStyle}>
          1. Superior implement
          <EquipmentPickerRow
            filterValue={implementBaseSearch}
            onFilterChange={setImplementBaseSearch}
            filterPlaceholder="Name, group…"
            filterAriaLabel="Filter superior implement"
          >
            <select
              value={equipment.implement?.superiorImplementId || ""}
              onChange={(e) => onBuildChange(setImplementSuperior(build, e.target.value || undefined))}
              style={selectInlineStyle}
            >
              <option value="">None</option>
              {filteredImplements.map((imp: Implement) => (
                <option key={imp.id} value={imp.id}>
                  {imp.name}
                  {imp.implementGroup ? ` (${imp.implementGroup})` : ""}
                </option>
              ))}
            </select>
          </EquipmentPickerRow>
        </label>
        <label style={fieldLabelStyle}>
          2. Enchantment
          <EquipmentPickerRow
            filterValue={implementEnchantSearch}
            onFilterChange={setImplementEnchantSearch}
            filterPlaceholder="Staff, orb, holy symbol…"
            filterAriaLabel="Filter enchantment"
            between={
              <EnchantmentPlusInput
                title="Implement"
                allowedEnhancements={implementSelectedFamily?.allowedEnhancements ?? []}
                value={equipment.implement?.enhancement ?? 0}
                onChange={(n) => onBuildChange(setImplementEnhancement(build, index, n, magicImplementCatalog))}
              />
            }
          >
            <select
              value={implementFamilyKey || ""}
              onChange={(e) =>
                onBuildChange(
                  setImplementEnchantmentFamily(build, index, e.target.value || undefined, magicImplementCatalog)
                )
              }
              style={selectInlineStyle}
            >
              <option value="">None (mundane)</option>
              {filteredImplementFamilies.map((family) => (
                <option key={family.key} value={family.key}>
                  {formatEnchantmentFamilyLabel(family)}
                </option>
              ))}
            </select>
          </EquipmentPickerRow>
        </label>
        <EquipmentSelectionDetails
          baseName={selectedSuperiorImplement?.name}
          baseDescription={selectedSuperiorImplement ? describeImplement(selectedSuperiorImplement) : undefined}
          enchantmentName={
            implementEnchantmentItem ? magicItemFamilyDisplayName(implementEnchantmentItem.name) : undefined
          }
          enchantmentDescription={
            implementEnchantmentItem ? describeMagicItem(implementEnchantmentItem) : undefined
          }
        />
        <EquipmentSlotActions
          price={equipmentSlotGoldCost(index, "implement", equipment)}
          gold={gold}
          hasSelection={Boolean(
            equipment.implement?.superiorImplementId || equipment.implement?.enchantmentId
          )}
          showAddToInventory={showAddToInventory}
          onAddToInventory={slotActionProps("implement").onAddToInventory}
          onBuy={slotActionProps("implement").onBuy}
        />
      </section>
      )}

      {showSlot("neck") && (
      <section style={slotSectionStyle}>
        <h4 style={slotTitleStyle}>Neck</h4>
        <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-muted)" }}>
          No mundane base — magic enchantment and plus only.
        </p>
        <label style={fieldLabelStyle}>
          1. Enchantment
          <EquipmentPickerRow
            filterValue={neckEnchantSearch}
            onFilterChange={setNeckEnchantSearch}
            filterPlaceholder="Cloak, amulet…"
            filterAriaLabel="Filter enchantment"
            between={
              <EnchantmentPlusInput
                title="Neck"
                allowedEnhancements={neckSelectedFamily?.allowedEnhancements ?? []}
                value={equipment.neck?.enhancement ?? 0}
                onChange={(n) => onBuildChange(setNeckEnhancement(build, index, n, magicNeckCatalog))}
              />
            }
          >
            <select
              value={neckFamilyKey || ""}
              onChange={(e) =>
                onBuildChange(setNeckEnchantmentFamily(build, index, e.target.value || undefined, magicNeckCatalog))
              }
              style={selectInlineStyle}
            >
              <option value="">None</option>
              {filteredNeckFamilies.map((family) => (
                <option key={family.key} value={family.key}>
                  {formatEnchantmentFamilyLabel(family)}
                </option>
              ))}
            </select>
          </EquipmentPickerRow>
        </label>
        <EquipmentSelectionDetails
          enchantmentName={
            neckEnchantmentItem ? magicItemFamilyDisplayName(neckEnchantmentItem.name) : undefined
          }
          enchantmentDescription={
            neckEnchantmentItem ? describeMagicItem(neckEnchantmentItem) : undefined
          }
        />
        <EquipmentSlotActions
          price={equipmentSlotGoldCost(index, "neck", equipment)}
          gold={gold}
          hasSelection={Boolean(equipment.neck?.enchantmentId)}
          showAddToInventory={showAddToInventory}
          onAddToInventory={slotActionProps("neck").onAddToInventory}
          onBuy={slotActionProps("neck").onBuy}
        />
      </section>
      )}
    </div>
    </>
  );
}
