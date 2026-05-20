# Vision
The final product will be a fully integrated suite of 4th Edition Dungeons and Dragons tools to assist and manage the experience of playing and running a session or campaign.

**Race/class builder fidelity:** See [class-build-options.md](./class-build-options.md) for PHB vs Essentials build indexing; run `tools/etl/list_race_class_selection_gaps.py` for coverage gaps.

## Standalone Products
### 1. Character Builder
        - Character Builder
        - Character Sheets
        - Item Store
### 2. Monster Editor
        - Browser
        - Monster Templates
        - Editor/creator
        - Encounter Builder
### 3. NPC Creator
### 4. Campaign Notes
### 5. Resource Editor

## Tier 2 Products
### 1. Encounter Tracker
        - Dependent on Character Sheets, Encounter Builder
        - Track initiative, rounds, hp, statuses, delay
        - Global notes
        - DM information such as defenses, tactics, etc

### 2. Resource Tracker
        - Dependent on Item integration
        - Track treasure packages: quantity and distribution.
        - Auditable resource tracking, when gold and items was given, lost spent
        - (Optional) Tracking of consumables such as food, water and survival supplies

### 3. Campaign builder/tracker
        - Node based plot/note journaling
        - Item/NPC journaling
        - Optional LLM Skills based settings/resource/adventure generator

## Tier 3 Product
### 1.  Session hosting
        - Local webserver to host session
        - Integratation for DM to character sheets to encounter tracker

### 2. Integrated VTT