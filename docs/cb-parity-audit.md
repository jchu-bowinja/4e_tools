# Character Builder parity audit (legacy CB vs 4e_builder)

Human-in-the-loop workflow: you operate **D&D Insider Character Builder** (CBLoader); we capture behavior, UI states, and data mappings into this repo.

## How to run a session

1. Open CBLoader / Character Builder on your desktop.
2. Run the explorer from the **repo root** (optional, for window/control names):
   ```powershell
   cd C:\projects\4e_builder
   powershell -ExecutionPolicy Bypass -File tools/cb-explore.ps1
   ```
3. Follow the **active session** checklist below.
4. After each step, paste or attach:
   - screenshot(s)
   - any validation/error text (copy exact wording)
   - exported character file path + contents (if export exists)
5. Record findings in `docs/cb-parity/sessions/` (one markdown file per session).

## JSON mapping reference

Our build model lives in `src/rules/models.ts` (`CharacterBuild`). Session notes should call out:

| Legacy concept | Our field / module |
|----------------|-------------------|
| Name, level | `name`, `level` |
| Race + subrace / options | `raceId`, `raceSelections`, `racialAbilityChoice` |
| Class / hybrid / theme | `classId`, `characterStyle`, `hybridClassIdA/B`, `themeId` |
| Ability scores | `abilityScores`, `pointBuyBudget`, `asiChoices` |
| Skills | `trainedSkillIds` |
| Feats | `featIds` |
| Powers / slots | `powerIds`, `classPowerSlots` |
| Equipment / gold | `equipment`, `inventory`, `gold`, `equippedSlots` |
| Paragon / epic | `paragonPathId`, `paragonMulticlassing`, `epicDestinyId` |

Validation parity: compare CB messages to `src/rules/characterValidator.ts` and tests in `tests/rules/characterValidator.test.ts`.

---

## Session 1 — New character (level 1, PHB fighter)

**Goal:** Baseline happy path + first JSON snapshot for a simple PHB build.

### Prerequisites

- [ ] CBLoader is running and you can reach **New Character** (or equivalent).
- [ ] Note CB version / rules sources visible in UI (e.g. PHB, Essentials, compendium packs).

### Steps (legacy app)

| # | Action | Capture |
|---|--------|---------|
| 1 | Start new character | Screenshot of first screen; list all top-level tabs/wizards |
| 2 | Set name (e.g. `Parity Test 01`) | — |
| 3 | Level = 1 | — |
| 4 | Race: **Human** (PHB) | Screenshot of race options; note any mandatory sub-choices |
| 5 | Class: **Fighter** (PHB, not Essentials knight) | Screenshot; note build style if prompted |
| 6 | Ability generation: note method (point buy / standard / custom) | Screenshot of scores + budget; final six numbers |
| 7 | Skills: pick exactly what CB requires | List trained skills shown |
| 8 | Feats: pick **Weapon Expertise (Heavy Blade)** or first legal feat | Feat list UI if filtered |
| 9 | Powers: accept defaults or pick required at-wills | Screenshot of power pane |
| 10 | Equipment: note starting gold / kit | Screenshot or values |
| 11 | Summary / character sheet view | Full summary screenshot |
| 12 | Save / export | File path, format (.dnd4e, xml, etc.), paste file contents if text |

### Same build in 4e_builder (after legacy capture)

1. `npm run dev` → open builder in browser.
2. Recreate the same choices.
3. Export or copy saved JSON from app storage (`src/features/builder/storage.ts`).
4. Diff mentally (or paste both in session file):
   - ability scores, defenses, HP, surges
   - trained skills, feat names, power names
   - starting equipment / gold

### Session 1 output template

Create `docs/cb-parity/sessions/YYYY-MM-DD-session-01.md`:

```markdown
# Session 01 — PHB L1 Human Fighter

## Legacy environment
- CB window title:
- Rules sources enabled:
- Export format:

## Step notes
(Per-step screenshots attached / described)

## Legacy export snippet
(paste or link)

## 4e_builder JSON
(paste)

## Gaps
| Area | Legacy | Ours | Priority |
|------|--------|------|----------|
| | | | |

## Validator messages to add
- 
```

---

## Backlog (future sessions)

| Session | Focus |
|---------|--------|
| 2 | Essentials class (e.g. Knight) vs PHB class |
| 3 | Hybrid character (two classes) |
| 4 | Level-up 1→2 (feat, HP, power slot) |
| 5 | Multiclass / multiclass feat |
| 6 | Paragon path at 11 |
| 7 | Item store / magic item purchase |
| 8 | Invalid build / error messages |

---

## Automation (optional)

`tools/cb-explore.ps1` dumps top-level windows and, when the Character Builder window is found, prints a shallow UI Automation tree. Use output to refine control names for future scripts—not required for Session 1.
