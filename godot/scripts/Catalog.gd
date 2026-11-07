extends Node
## ============================================================================
## FICSIT Labs — Catalog & Geometry Registry (Godot 4 Statically-Typed GDScript)
## ============================================================================

const APP_VERSION: String = "0.0.2.1"
const APP_BUILD_TAG: String = "0.0.2.1 Initial Release"

const WORLD_WIDTH: float = 12000.0
const WORLD_HEIGHT: float = 8000.0
const MIN_ZOOM: float = 0.06
const MAX_ZOOM: float = 1.85
const LOD_ICON_BOX_ZOOM_THRESHOLD: float = 0.25
const WORLD_PADDING: float = 24.0
const GRID_PITCH: float = 24.0

const PIXELS_PER_METER: float = 15.0
const BELT_ITEM_LENGTH_METERS: float = 1.2
const BELT_ITEM_FOOTPRINT_PX: float = 18.0
const STORAGE_CONTAINER_SLOTS: int = 24
const OVERCLOCK_POWER_EXPONENT: float = 1.321928

var _texture_cache: Dictionary = {}

func _exit_tree() -> void:
	_texture_cache.clear()

const BUILD_CATEGORIES: Array[Dictionary] = [
	{"id": "special", "label": "Special", "subtitle": "FICSIT Command & Milestones"},
	{"id": "production", "label": "Production", "subtitle": "Resource Deposits, Miners & Processors"},
	{"id": "logistics", "label": "Logistics", "subtitle": "Conveyor Belts Mk.1–Mk.6, Splitters & Mergers"},
	{"id": "organization", "label": "Organization", "subtitle": "Storage Buffers & Depot Sinks"},
]

const CONVEYOR_BELT_TIERS: Dictionary = {
	1: {
		"tier": 1,
		"id": "conveyor_belt_mk1",
		"name": "Conveyor Belt Mk.1",
		"shortLabel": "Mk.1",
		"capacityPerMin": 60.0,
		"speedMetersPerSec": 1.2,
		"speedPxPerSec": 18.0,
		"accentColor": Color("#94A3B8"),
		"ingredientName": "Iron Plate",
		"iconPath": "res://assets/icons/buildings/conveyor_belt_mk1.png",
	},
	2: {
		"tier": 2,
		"id": "conveyor_belt_mk2",
		"name": "Conveyor Belt Mk.2",
		"shortLabel": "Mk.2",
		"capacityPerMin": 120.0,
		"speedMetersPerSec": 2.4,
		"speedPxPerSec": 36.0,
		"accentColor": Color("#F59E0B"),
		"ingredientName": "Reinforced Iron Plate",
		"iconPath": "res://assets/icons/buildings/conveyor_belt_mk2.png",
	},
	3: {
		"tier": 3,
		"id": "conveyor_belt_mk3",
		"name": "Conveyor Belt Mk.3",
		"shortLabel": "Mk.3",
		"capacityPerMin": 270.0,
		"speedMetersPerSec": 5.4,
		"speedPxPerSec": 81.0,
		"accentColor": Color("#38BDF8"),
		"ingredientName": "Steel Beam",
		"iconPath": "res://assets/icons/buildings/conveyor_belt_mk3.png",
	},
	4: {
		"tier": 4,
		"id": "conveyor_belt_mk4",
		"name": "Conveyor Belt Mk.4",
		"shortLabel": "Mk.4",
		"capacityPerMin": 480.0,
		"speedMetersPerSec": 9.6,
		"speedPxPerSec": 144.0,
		"accentColor": Color("#818CF8"),
		"ingredientName": "Encased Industrial Beam",
		"iconPath": "res://assets/icons/buildings/conveyor_belt_mk4.png",
	},
	5: {
		"tier": 5,
		"id": "conveyor_belt_mk5",
		"name": "Conveyor Belt Mk.5",
		"shortLabel": "Mk.5",
		"capacityPerMin": 780.0,
		"speedMetersPerSec": 15.6,
		"speedPxPerSec": 234.0,
		"accentColor": Color("#A855F7"),
		"ingredientName": "Aluminum Casing",
		"iconPath": "res://assets/icons/buildings/conveyor_belt_mk5.png",
	},
	6: {
		"tier": 6,
		"id": "conveyor_belt_mk6",
		"name": "Conveyor Belt Mk.6",
		"shortLabel": "Mk.6",
		"capacityPerMin": 1200.0,
		"speedMetersPerSec": 24.0,
		"speedPxPerSec": 360.0,
		"accentColor": Color("#EC4899"),
		"ingredientName": "Fused Modular Frame",
		"iconPath": "res://assets/icons/buildings/conveyor_belt_mk6.png",
	},
}

const ITEM_STACK_SIZES: Dictionary = {
	"iron_ore": 100,
	"iron ore": 100,
	"copper_ore": 100,
	"copper ore": 100,
	"limestone": 100,
	"iron_ingot": 100,
	"iron ingot": 100,
	"copper_ingot": 100,
	"copper ingot": 100,
	"iron_plate": 200,
	"iron plate": 200,
	"iron_rod": 200,
	"iron rod": 200,
	"wire": 500,
	"copper wire": 500,
	"cable": 200,
	"insulated cable": 200,
	"concrete": 500,
	"screw": 500,
	"screws": 500,
	"reinforced_plate": 100,
	"reinforced plate": 100,
	"reinforced iron plate": 100,
	"rotor": 100,
	"modular rotor": 100,
	"power_shard": 100,
	"power shard": 100,
	"somersloop": 50,
}

const ITEM_ICON_PATHS: Dictionary = {
	"iron_ore": "res://assets/icons/items/iron_ore.png",
	"iron ore": "res://assets/icons/items/iron_ore.png",
	"copper_ore": "res://assets/icons/items/copper_ore.png",
	"copper ore": "res://assets/icons/items/copper_ore.png",
	"limestone": "res://assets/icons/items/limestone.png",
	"iron_ingot": "res://assets/icons/items/iron_ingot.png",
	"iron ingot": "res://assets/icons/items/iron_ingot.png",
	"copper_ingot": "res://assets/icons/items/copper_ingot.png",
	"copper ingot": "res://assets/icons/items/copper_ingot.png",
	"iron_plate": "res://assets/icons/items/iron_plate.png",
	"iron plate": "res://assets/icons/items/iron_plate.png",
	"iron_rod": "res://assets/icons/items/iron_rod.png",
	"iron rod": "res://assets/icons/items/iron_rod.png",
	"wire": "res://assets/icons/items/wire.png",
	"copper wire": "res://assets/icons/items/wire.png",
	"cable": "res://assets/icons/items/cable.png",
	"insulated cable": "res://assets/icons/items/cable.png",
	"concrete": "res://assets/icons/items/concrete.png",
	"screw": "res://assets/icons/items/screw.png",
	"screws": "res://assets/icons/items/screw.png",
	"reinforced_plate": "res://assets/icons/items/reinforced_plate.png",
	"reinforced plate": "res://assets/icons/items/reinforced_plate.png",
	"reinforced iron plate": "res://assets/icons/items/reinforced_plate.png",
	"rotor": "res://assets/icons/items/rotor.png",
	"modular rotor": "res://assets/icons/items/rotor.png",
	"power_shard": "res://assets/icons/items/power_shard.png",
	"power shard": "res://assets/icons/items/power_shard.png",
	"somersloop": "res://assets/icons/items/somersloop.png",
}

const ITEM_ACCENT_COLORS: Dictionary = {
	"iron_ore": Color("#94A3B8"),
	"iron ore": Color("#94A3B8"),
	"copper_ore": Color("#F97316"),
	"copper ore": Color("#F97316"),
	"limestone": Color("#D6D3D1"),
	"iron_ingot": Color("#CBD5E1"),
	"iron ingot": Color("#CBD5E1"),
	"copper_ingot": Color("#FB923C"),
	"copper ingot": Color("#FB923C"),
	"iron_plate": Color("#E2E8F0"),
	"iron plate": Color("#E2E8F0"),
	"iron_rod": Color("#94A3B8"),
	"iron rod": Color("#94A3B8"),
	"wire": Color("#F59E0B"),
	"cable": Color("#38BDF8"),
	"concrete": Color("#A8A29E"),
	"screw": Color("#60A5FA"),
	"screws": Color("#60A5FA"),
	"reinforced_plate": Color("#818CF8"),
	"reinforced plate": Color("#818CF8"),
	"rotor": Color("#EC4899"),
	"power_shard": Color("#C084FC"),
}

const RECIPES: Dictionary = {
	"deposit_iron": {
		"id": "deposit_iron",
		"name": "Pure Iron Vein",
		"machineType": "resource_deposit",
		"cycleTimeSec": 1.0,
		"inputs": [],
		"outputs": [{"itemId": "iron_ore", "itemName": "Iron Ore", "ratePerMin": 60.0}],
	},
	"deposit_copper": {
		"id": "deposit_copper",
		"name": "Pure Copper Vein",
		"machineType": "resource_deposit",
		"cycleTimeSec": 1.0,
		"inputs": [],
		"outputs": [{"itemId": "copper_ore", "itemName": "Copper Ore", "ratePerMin": 60.0}],
	},
	"deposit_limestone": {
		"id": "deposit_limestone",
		"name": "Limestone Deposit",
		"machineType": "resource_deposit",
		"cycleTimeSec": 1.0,
		"inputs": [],
		"outputs": [{"itemId": "limestone", "itemName": "Limestone", "ratePerMin": 60.0}],
	},
	"mine_iron": {
		"id": "mine_iron",
		"name": "Extract Iron Ore",
		"machineType": "miner_mk1",
		"cycleTimeSec": 1.0,
		"inputs": [],
		"outputs": [{"itemId": "iron_ore", "itemName": "Iron Ore", "ratePerMin": 60.0}],
	},
	"mine_copper": {
		"id": "mine_copper",
		"name": "Extract Copper Ore",
		"machineType": "miner_mk1",
		"cycleTimeSec": 1.0,
		"inputs": [],
		"outputs": [{"itemId": "copper_ore", "itemName": "Copper Ore", "ratePerMin": 60.0}],
	},
	"mine_limestone": {
		"id": "mine_limestone",
		"name": "Extract Limestone",
		"machineType": "miner_mk1",
		"cycleTimeSec": 1.0,
		"inputs": [],
		"outputs": [{"itemId": "limestone", "itemName": "Limestone", "ratePerMin": 60.0}],
	},
	"smelt_iron": {
		"id": "smelt_iron",
		"name": "Iron Ingot",
		"machineType": "smelter",
		"cycleTimeSec": 2.0,
		"inputs": [{"itemId": "iron_ore", "itemName": "Iron Ore", "ratePerMin": 30.0}],
		"outputs": [{"itemId": "iron_ingot", "itemName": "Iron Ingot", "ratePerMin": 30.0}],
	},
	"smelt_copper": {
		"id": "smelt_copper",
		"name": "Copper Ingot",
		"machineType": "smelter",
		"cycleTimeSec": 2.0,
		"inputs": [{"itemId": "copper_ore", "itemName": "Copper Ore", "ratePerMin": 30.0}],
		"outputs": [{"itemId": "copper_ingot", "itemName": "Copper Ingot", "ratePerMin": 30.0}],
	},
	"construct_iron_plate": {
		"id": "construct_iron_plate",
		"name": "Iron Plate",
		"machineType": "constructor",
		"cycleTimeSec": 6.0,
		"inputs": [{"itemId": "iron_ingot", "itemName": "Iron Ingot", "ratePerMin": 30.0}],
		"outputs": [{"itemId": "iron_plate", "itemName": "Iron Plate", "ratePerMin": 20.0}],
	},
	"construct_iron_rod": {
		"id": "construct_iron_rod",
		"name": "Iron Rod",
		"machineType": "constructor",
		"cycleTimeSec": 4.0,
		"inputs": [{"itemId": "iron_ingot", "itemName": "Iron Ingot", "ratePerMin": 15.0}],
		"outputs": [{"itemId": "iron_rod", "itemName": "Iron Rod", "ratePerMin": 15.0}],
	},
	"construct_screws": {
		"id": "construct_screws",
		"name": "Screws",
		"machineType": "constructor",
		"cycleTimeSec": 6.0,
		"inputs": [{"itemId": "iron_rod", "itemName": "Iron Rod", "ratePerMin": 10.0}],
		"outputs": [{"itemId": "screw", "itemName": "Screws", "ratePerMin": 40.0}],
	},
	"construct_wire": {
		"id": "construct_wire",
		"name": "Copper Wire",
		"machineType": "constructor",
		"cycleTimeSec": 4.0,
		"inputs": [{"itemId": "copper_ingot", "itemName": "Copper Ingot", "ratePerMin": 15.0}],
		"outputs": [{"itemId": "wire", "itemName": "Wire", "ratePerMin": 30.0}],
	},
	"construct_cable": {
		"id": "construct_cable",
		"name": "Insulated Cable",
		"machineType": "constructor",
		"cycleTimeSec": 2.0,
		"inputs": [{"itemId": "wire", "itemName": "Wire", "ratePerMin": 60.0}],
		"outputs": [{"itemId": "cable", "itemName": "Cable", "ratePerMin": 30.0}],
	},
	"construct_concrete": {
		"id": "construct_concrete",
		"name": "Concrete",
		"machineType": "constructor",
		"cycleTimeSec": 4.0,
		"inputs": [{"itemId": "limestone", "itemName": "Limestone", "ratePerMin": 45.0}],
		"outputs": [{"itemId": "concrete", "itemName": "Concrete", "ratePerMin": 15.0}],
	},
	"assemble_reinforced_plate": {
		"id": "assemble_reinforced_plate",
		"name": "Reinforced Iron Plate",
		"machineType": "assembler",
		"cycleTimeSec": 12.0,
		"inputs": [
			{"itemId": "iron_plate", "itemName": "Iron Plate", "ratePerMin": 30.0},
			{"itemId": "screw", "itemName": "Screws", "ratePerMin": 60.0},
		],
		"outputs": [{"itemId": "reinforced_plate", "itemName": "Reinforced Plate", "ratePerMin": 5.0}],
	},
	"assemble_rotor": {
		"id": "assemble_rotor",
		"name": "Modular Rotor",
		"machineType": "assembler",
		"cycleTimeSec": 15.0,
		"inputs": [
			{"itemId": "iron_rod", "itemName": "Iron Rod", "ratePerMin": 20.0},
			{"itemId": "screw", "itemName": "Screws", "ratePerMin": 100.0},
		],
		"outputs": [{"itemId": "rotor", "itemName": "Rotor", "ratePerMin": 4.0}],
	},
}

const BUILDINGS: Dictionary = {
	"the_hub": {
		"id": "the_hub",
		"name": "The HUB Terminal",
		"category": "special",
		"subcategory": "Core Command",
		"description": "Central FICSIT Pioneer logistics terminal. Receives processed parts into your factory storage network.",
		"accentColor": Color("#F59E0B"),
		"width": 268.0,
		"height": 168.0,
		"inputPortCount": 2,
		"outputPortCount": 0,
		"defaultRecipeId": "",
		"availableRecipeIds": [],
		"powerMw": 0.0,
		"buildable": true,
		"iconPath": "res://assets/icons/buildings/the_hub.png",
	},
	"resource_deposit": {
		"id": "resource_deposit",
		"name": "Resource Deposit",
		"category": "production",
		"subcategory": "Natural World Deposit",
		"description": "Permanent planetary mineral vein outcrop generated on the sector terrain.",
		"accentColor": Color("#10B981"),
		"width": 268.0,
		"height": 144.0,
		"inputPortCount": 0,
		"outputPortCount": 0,
		"defaultRecipeId": "deposit_iron",
		"availableRecipeIds": [],
		"powerMw": 0.0,
		"buildable": false,
		"iconPath": "res://assets/icons/items/iron_ore.png",
	},
	"miner_mk1": {
		"id": "miner_mk1",
		"name": "Miner Mk.1",
		"category": "production",
		"subcategory": "Extractors",
		"description": "Built directly on top of a Resource Deposit to extract solid ore into its output buffer.",
		"accentColor": Color("#F59E0B"),
		"width": 268.0,
		"height": 144.0,
		"inputPortCount": 0,
		"outputPortCount": 1,
		"defaultRecipeId": "mine_iron",
		"availableRecipeIds": ["mine_iron", "mine_copper", "mine_limestone"],
		"powerMw": 5.0,
		"buildable": true,
		"iconPath": "res://assets/icons/buildings/miner_mk1.png",
	},
	"smelter": {
		"id": "smelter",
		"name": "Smelter",
		"category": "production",
		"subcategory": "Smelters",
		"description": "Smelts raw ore into pure metal ingots at 30 items/min.",
		"accentColor": Color("#F97316"),
		"width": 268.0,
		"height": 144.0,
		"inputPortCount": 1,
		"outputPortCount": 1,
		"defaultRecipeId": "smelt_iron",
		"availableRecipeIds": ["smelt_iron", "smelt_copper"],
		"powerMw": 4.0,
		"buildable": true,
		"iconPath": "res://assets/icons/buildings/smelter.png",
	},
	"constructor": {
		"id": "constructor",
		"name": "Constructor",
		"category": "production",
		"subcategory": "Manufacturers",
		"description": "Shapes a single ingot or mineral input into structural plates, rods, wire, or concrete.",
		"accentColor": Color("#06B6D4"),
		"width": 268.0,
		"height": 144.0,
		"inputPortCount": 1,
		"outputPortCount": 1,
		"defaultRecipeId": "construct_iron_plate",
		"availableRecipeIds": [
			"construct_iron_plate",
			"construct_iron_rod",
			"construct_screws",
			"construct_wire",
			"construct_cable",
			"construct_concrete",
		],
		"powerMw": 4.0,
		"buildable": true,
		"iconPath": "res://assets/icons/buildings/constructor.png",
	},
	"assembler": {
		"id": "assembler",
		"name": "Assembler",
		"category": "production",
		"subcategory": "Manufacturers",
		"description": "Combines two distinct input parts into advanced intermediate components.",
		"accentColor": Color("#3B82F6"),
		"width": 276.0,
		"height": 168.0,
		"inputPortCount": 2,
		"outputPortCount": 1,
		"defaultRecipeId": "assemble_reinforced_plate",
		"availableRecipeIds": ["assemble_reinforced_plate", "assemble_rotor"],
		"powerMw": 15.0,
		"buildable": true,
		"iconPath": "res://assets/icons/buildings/assembler.png",
	},
	"splitter": {
		"id": "splitter",
		"name": "Conveyor Splitter",
		"category": "logistics",
		"subcategory": "Flow Routing",
		"description": "Divides incoming conveyor throughput evenly across up to three connected output lines.",
		"accentColor": Color("#A855F7"),
		"width": 248.0,
		"height": 168.0,
		"inputPortCount": 1,
		"outputPortCount": 3,
		"defaultRecipeId": "",
		"availableRecipeIds": [],
		"powerMw": 0.0,
		"buildable": true,
		"iconPath": "res://assets/icons/buildings/splitter.png",
	},
	"merger": {
		"id": "merger",
		"name": "Conveyor Merger",
		"category": "logistics",
		"subcategory": "Flow Routing",
		"description": "Combines up to three incoming conveyor lines into a single consolidated output stream.",
		"accentColor": Color("#8B5CF6"),
		"width": 248.0,
		"height": 168.0,
		"inputPortCount": 3,
		"outputPortCount": 1,
		"defaultRecipeId": "",
		"availableRecipeIds": [],
		"powerMw": 0.0,
		"buildable": true,
		"iconPath": "res://assets/icons/buildings/merger.png",
	},
	"storage_container": {
		"id": "storage_container",
		"name": "Storage Container",
		"category": "organization",
		"subcategory": "Storage",
		"description": "Buffers incoming parts and passes surplus flow through its output port.",
		"accentColor": Color("#14B8A6"),
		"width": 260.0,
		"height": 144.0,
		"inputPortCount": 1,
		"outputPortCount": 1,
		"defaultRecipeId": "",
		"availableRecipeIds": [],
		"powerMw": 0.0,
		"buildable": true,
		"iconPath": "res://assets/icons/buildings/storage_container.png",
	},
}

const PURITY_CONFIG: Dictionary = {
	"impure": {"label": "IMPURE", "multiplier": 0.5, "ratePerMin": 30.0, "badgeColor": Color("#EF4444")},
	"normal": {"label": "NORMAL", "multiplier": 1.0, "ratePerMin": 60.0, "badgeColor": Color("#F97316")},
	"pure": {"label": "PURE", "multiplier": 2.0, "ratePerMin": 120.0, "badgeColor": Color("#22C55E")},
}

const SECTOR_01_DEPOSIT_SPECS: Array[Dictionary] = [
	{"id": "world_dep_limestone_pure_nw", "title": "Limestone Node (Pure)", "recipeId": "deposit_limestone", "purity": "pure", "x": 960.0, "y": 1560.0},
	{"id": "world_dep_iron_impure_fw1", "title": "Iron Node (Impure)", "recipeId": "deposit_iron", "purity": "impure", "x": 432.0, "y": 2760.0},
	{"id": "world_dep_iron_impure_sw1", "title": "Iron Node (Impure)", "recipeId": "deposit_iron", "purity": "impure", "x": 384.0, "y": 3960.0},
	{"id": "world_dep_iron_impure_sw2", "title": "Iron Node (Impure)", "recipeId": "deposit_iron", "purity": "impure", "x": 648.0, "y": 4128.0},
	{"id": "world_dep_iron_impure_nw1", "title": "Iron Node (Impure)", "recipeId": "deposit_iron", "purity": "impure", "x": 2064.0, "y": 1056.0},
	{"id": "world_dep_iron_impure_nw2", "title": "Iron Node (Impure)", "recipeId": "deposit_iron", "purity": "impure", "x": 2376.0, "y": 912.0},
	{"id": "world_dep_iron_impure_nw3", "title": "Iron Node (Impure)", "recipeId": "deposit_iron", "purity": "impure", "x": 2352.0, "y": 1224.0},
	{"id": "world_dep_iron_impure_uc1", "title": "Iron Node (Impure)", "recipeId": "deposit_iron", "purity": "impure", "x": 3168.0, "y": 1704.0},
	{"id": "world_dep_iron_impure_uc2", "title": "Iron Node (Impure)", "recipeId": "deposit_iron", "purity": "impure", "x": 3456.0, "y": 1536.0},
	{"id": "world_dep_limestone_normal_uc1", "title": "Limestone Node (Normal)", "recipeId": "deposit_limestone", "purity": "normal", "x": 3744.0, "y": 1272.0},
	{"id": "world_dep_copper_normal_uc1", "title": "Copper Node (Normal)", "recipeId": "deposit_copper", "purity": "normal", "x": 4272.0, "y": 1080.0},
	{"id": "world_dep_limestone_impure_st1", "title": "Limestone Node (Impure)", "recipeId": "deposit_limestone", "purity": "impure", "x": 1944.0, "y": 2736.0},
	{"id": "starter_deposit", "title": "Iron Node (Normal)", "recipeId": "deposit_iron", "purity": "normal", "x": 2544.0, "y": 2784.0},
	{"id": "world_dep_iron_normal_st2", "title": "Iron Node (Normal)", "recipeId": "deposit_iron", "purity": "normal", "x": 2376.0, "y": 2976.0},
	{"id": "world_dep_iron_normal_st3", "title": "Iron Node (Normal)", "recipeId": "deposit_iron", "purity": "normal", "x": 2688.0, "y": 3144.0},
	{"id": "world_dep_limestone_impure_st2", "title": "Limestone Node (Impure)", "recipeId": "deposit_limestone", "purity": "impure", "x": 3264.0, "y": 3384.0},
	{"id": "world_dep_iron_impure_st4", "title": "Iron Node (Impure)", "recipeId": "deposit_iron", "purity": "impure", "x": 3648.0, "y": 3672.0},
	{"id": "world_dep_iron_impure_st5", "title": "Iron Node (Impure)", "recipeId": "deposit_iron", "purity": "impure", "x": 3888.0, "y": 3840.0},
	{"id": "world_dep_copper_normal_st1", "title": "Copper Node (Normal)", "recipeId": "deposit_copper", "purity": "normal", "x": 4560.0, "y": 2880.0},
	{"id": "world_dep_iron_pure_nc1", "title": "Iron Node (Pure)", "recipeId": "deposit_iron", "purity": "pure", "x": 6144.0, "y": 1344.0},
	{"id": "world_dep_iron_pure_nc2", "title": "Iron Node (Pure)", "recipeId": "deposit_iron", "purity": "pure", "x": 6432.0, "y": 1488.0},
	{"id": "world_dep_copper_pure_nc1", "title": "Copper Node (Pure)", "recipeId": "deposit_copper", "purity": "pure", "x": 6816.0, "y": 1200.0},
	{"id": "world_dep_limestone_normal_cb1", "title": "Limestone Node (Normal)", "recipeId": "deposit_limestone", "purity": "normal", "x": 5856.0, "y": 3984.0},
	{"id": "world_dep_copper_normal_cb1", "title": "Copper Node (Normal)", "recipeId": "deposit_copper", "purity": "normal", "x": 6144.0, "y": 4152.0},
	{"id": "world_dep_copper_impure_cb2", "title": "Copper Node (Impure)", "recipeId": "deposit_copper", "purity": "impure", "x": 6408.0, "y": 4032.0},
	{"id": "world_dep_iron_normal_sd1", "title": "Iron Node (Normal)", "recipeId": "deposit_iron", "purity": "normal", "x": 2880.0, "y": 5904.0},
	{"id": "world_dep_iron_normal_sd2", "title": "Iron Node (Normal)", "recipeId": "deposit_iron", "purity": "normal", "x": 3168.0, "y": 6048.0},
	{"id": "world_dep_limestone_pure_sd1", "title": "Limestone Node (Pure)", "recipeId": "deposit_limestone", "purity": "pure", "x": 3648.0, "y": 6240.0},
	{"id": "world_dep_iron_pure_ef1", "title": "Iron Node (Pure)", "recipeId": "deposit_iron", "purity": "pure", "x": 9120.0, "y": 2160.0},
	{"id": "world_dep_copper_pure_ef1", "title": "Copper Node (Pure)", "recipeId": "deposit_copper", "purity": "pure", "x": 9456.0, "y": 2352.0},
	{"id": "world_dep_limestone_pure_ef1", "title": "Limestone Node (Pure)", "recipeId": "deposit_limestone", "purity": "pure", "x": 8928.0, "y": 5472.0},
	{"id": "world_dep_iron_pure_ef2", "title": "Iron Node (Pure)", "recipeId": "deposit_iron", "purity": "pure", "x": 10368.0, "y": 5184.0},
]

func get_cached_texture(path: String) -> Texture2D:
	if path.is_empty():
		return null
	if _texture_cache.has(path):
		return _texture_cache[path]
	if ResourceLoader.exists(path):
		var tex: Texture2D = load(path)
		_texture_cache[path] = tex
		return tex
	return null

func get_item_texture(item_id_or_name: String) -> Texture2D:
	var key: String = item_id_or_name.strip_edges().to_lower()
	var path: String = ITEM_ICON_PATHS.get(key, "res://assets/icons/items/iron_ore.png")
	return get_cached_texture(path)

func get_building_texture(building_id: String) -> Texture2D:
	var b: Dictionary = BUILDINGS.get(building_id, {})
	var path: String = b.get("iconPath", "res://assets/icons/buildings/smelter.png")
	return get_cached_texture(path)

func get_item_accent_color(item_id_or_name: String) -> Color:
	var key: String = item_id_or_name.strip_edges().to_lower()
	return ITEM_ACCENT_COLORS.get(key, Color("#F59E0B"))

func get_item_stack_size(item_id_or_name: String) -> int:
	if item_id_or_name.is_empty():
		return 100
	var key: String = item_id_or_name.strip_edges().to_lower()
	if ITEM_STACK_SIZES.has(key):
		return int(ITEM_STACK_SIZES[key])
	if key.contains("screw") or key.contains("wire") or key.contains("concrete"):
		return 500
	if key.contains("plate") and not key.contains("reinforced"):
		return 200
	if key.contains("rod") or key.contains("cable"):
		return 200
	return 100

func get_building_max_storage(building_id: String, recipe_id: String = "", item_name: String = "") -> int:
	if building_id == "storage_container" or building_id == "the_hub":
		return STORAGE_CONTAINER_SLOTS * get_item_stack_size(item_name)
	if building_id == "splitter" or building_id == "merger":
		return 9
	if building_id == "resource_deposit":
		return 100
	var recipe: Dictionary = RECIPES.get(recipe_id, {})
	var outputs: Array = recipe.get("outputs", [])
	var out_item: String = item_name
	if outputs.size() > 0:
		out_item = str(outputs[0].get("itemId", item_name))
	return get_item_stack_size(out_item)

func get_max_clock_speed_pct(power_shards: int = 0) -> float:
	var clamped: int = clampi(power_shards, 0, 3)
	return 100.0 + float(clamped * 50)

func clamp_clock_speed_pct(clock_speed_pct: float = 100.0, power_shards: int = 0) -> float:
	var max_clock: float = get_max_clock_speed_pct(power_shards)
	var clamped: float = clampf(clock_speed_pct, 1.0, max_clock)
	return roundf(clamped * 10000.0) / 10000.0

func get_scaled_rate_per_min(base_rate_per_min: float, clock_speed_pct: float = 100.0) -> float:
	var scaled: float = base_rate_per_min * (maxf(1.0, clock_speed_pct) / 100.0)
	return roundf(scaled * 100.0) / 100.0

func get_scaled_cycle_time_sec(base_cycle_sec: float, clock_speed_pct: float = 100.0) -> float:
	var ratio: float = maxf(0.01, clock_speed_pct / 100.0)
	return snappedf(base_cycle_sec / ratio, 0.01)

func get_building_power_mw(building_id: String, clock_speed_pct: float = 100.0, is_standby: bool = false) -> float:
	var b_def: Dictionary = BUILDINGS.get(building_id, {})
	var base_mw: float = float(b_def.get("powerMw", 0.0))
	if base_mw <= 0.0:
		return 0.0
	if is_standby:
		return 0.1
	var ratio: float = maxf(0.01, clock_speed_pct / 100.0)
	return snappedf(base_mw * pow(ratio, OVERCLOCK_POWER_EXPONENT), 0.1)

func is_macro_icon_zoom(zoom: float) -> bool:
	return zoom < LOD_ICON_BOX_ZOOM_THRESHOLD

func get_port_offset_y(index: int, total: int) -> float:
	if total <= 1:
		return 96.0
	if total == 2:
		return 72.0 if index == 0 else 120.0
	return 72.0 + float(index) * 24.0

func get_port_world_position(node: Dictionary, side: String, index: int, total: int) -> Vector2:
	var nx: float = float(node.get("x", 0.0))
	var ny: float = float(node.get("y", 0.0))
	var nw: float = float(node.get("width", 268.0))
	var py: float = ny + get_port_offset_y(index, total)
	var px: float = nx if side == "input" else nx + nw
	return Vector2(px, py)

func snap_to_grid(val: float, grid_size: float = GRID_PITCH) -> float:
	return roundf(val / grid_size) * grid_size

func clamp_node_to_world(x: float, y: float, w: float, h: float) -> Vector2:
	var min_x: float = WORLD_PADDING
	var min_y: float = WORLD_PADDING
	var max_x: float = maxf(min_x, WORLD_WIDTH - w - WORLD_PADDING)
	var max_y: float = maxf(min_y, WORLD_HEIGHT - h - WORLD_PADDING)
	return Vector2(clampf(x, min_x, max_x), clampf(y, min_y, max_y))

func clamp_camera_to_world(cam_pos: Vector2, cam_zoom: float, viewport_w: float, viewport_h: float) -> Dictionary:
	var safe_zoom: float = cam_zoom if is_finite(cam_zoom) and cam_zoom > 0.0 else 0.74
	var zoom: float = clampf(safe_zoom, MIN_ZOOM, MAX_ZOOM)
	var margin_x: float = minf(280.0, viewport_w * 0.25)
	var margin_y: float = minf(200.0, viewport_h * 0.25)

	var scaled_w: float = WORLD_WIDTH * zoom
	var scaled_h: float = WORLD_HEIGHT * zoom

	var bound1_x: float = margin_x
	var bound2_x: float = viewport_w - scaled_w - margin_x
	var min_x: float = minf(bound1_x, bound2_x)
	var max_x: float = maxf(bound1_x, bound2_x)

	var bound1_y: float = margin_y
	var bound2_y: float = viewport_h - scaled_h - margin_y
	var min_y: float = minf(bound1_y, bound2_y)
	var max_y: float = maxf(bound1_y, bound2_y)

	var safe_x: float = cam_pos.x if is_finite(cam_pos.x) else min_x
	var safe_y: float = cam_pos.y if is_finite(cam_pos.y) else min_y

	return {
		"x": clampf(safe_x, min_x, max_x),
		"y": clampf(safe_y, min_y, max_y),
		"zoom": zoom,
	}
