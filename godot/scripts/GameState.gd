extends Node
## ============================================================================
## FICSIT Labs — Global State, Save/Load Serializer, Pioneer Inventory & History
## ============================================================================

signal state_changed
signal selection_changed
signal history_changed
signal inventory_changed

const SAVE_FILE_PATH: String = "user://ficsit_saves.json"
const SETTINGS_FILE_PATH: String = "user://ficsit_settings.json"
const PIONEER_INVENTORY_SIZE: int = 45
const MAX_HISTORY_STEPS: int = 50

var app_mode: String = "title" # "title" | "playing"
var active_tool: String = "edit" # "edit" | "move" | "select" | "waypoint" | "build"
var active_build_id: String = ""
var active_belt_tier: int = 1

var session_name: String = "Rocky Desert Sector 01"
var active_slot_id: String = "slot_autosave_default"
var nodes: Array = []
var connections: Array = []
var camera: Dictionary = {"x": -1820.0, "y": -1920.0, "zoom": 0.74}

var selected_node_id: String = ""
var selected_node_ids: Array[String] = []
var selected_connection_id: String = ""

var settings: Dictionary = {
	"uiScale": 1.0,
	"snapToGrid": true,
	"wiringMode": "both",
	"performanceMode": "60fps",
	"sfxEnabled": true,
	"rateDisplayFormat": "per_minute",
}

var pioneer_inventory: Array[Dictionary] = []
var save_slots: Array = []

var _undo_stack: Array[Dictionary] = []
var _redo_stack: Array[Dictionary] = []
var _sim_accum: float = 0.0
var _autosave_timer: float = 0.0

func _ready() -> void:
	_init_default_pioneer_inventory()
	load_settings_from_disk()
	load_saves_from_disk()
	if save_slots.is_empty():
		start_new_session("Rocky Desert Sector 01", false)
	else:
		load_slot_into_active(save_slots[0], false)

func _process(delta: float) -> void:
	if app_mode != "playing":
		return
	var clamped_dt: float = clampf(delta, 0.001, 0.15)
	_sim_accum = minf(_sim_accum + clamped_dt, FactorySim.FIXED_SIM_DT * 3.0)
	while _sim_accum >= FactorySim.FIXED_SIM_DT:
		FactorySim.step_simulation(nodes, connections, FactorySim.FIXED_SIM_DT)
		_sim_accum -= FactorySim.FIXED_SIM_DT

	_autosave_timer += clamped_dt
	if _autosave_timer >= 8.0:
		_autosave_timer = 0.0
		upsert_autosave()

func _init_default_pioneer_inventory() -> void:
	pioneer_inventory.clear()
	var starter_stacks: Array[Dictionary] = [
		{"itemId": "iron_rod", "itemName": "Iron Rod", "count": 148},
		{"itemId": "screw", "itemName": "Screws", "count": 393},
		{"itemId": "iron_plate", "itemName": "Iron Plate", "count": 35},
		{"itemId": "iron_ore", "itemName": "Iron Ore", "count": 100},
		{"itemId": "iron_ore", "itemName": "Iron Ore", "count": 99},
		{"itemId": "copper_ore", "itemName": "Copper Ore", "count": 63},
		{"itemId": "limestone", "itemName": "Limestone", "count": 100},
		{"itemId": "power_shard", "itemName": "Power Shard", "count": 10},
		{"itemId": "rotor", "itemName": "Rotor", "count": 22},
		{"itemId": "cable", "itemName": "Cable", "count": 180},
		{"itemId": "iron_plate", "itemName": "Iron Plate", "count": 200},
		{"itemId": "reinforced_plate", "itemName": "Reinforced Plate", "count": 100},
		{"itemId": "iron_ingot", "itemName": "Iron Ingot", "count": 100},
		{"itemId": "copper_ingot", "itemName": "Copper Ingot", "count": 100},
		{"itemId": "wire", "itemName": "Wire", "count": 500},
		{"itemId": "concrete", "itemName": "Concrete", "count": 200},
		{"itemId": "somersloop", "itemName": "Somersloop", "count": 4},
	]
	for i in range(PIONEER_INVENTORY_SIZE):
		if i < starter_stacks.size():
			pioneer_inventory.append(starter_stacks[i].duplicate(true))
		else:
			pioneer_inventory.append({"itemId": "", "itemName": "", "count": 0})

func sort_pioneer_inventory() -> void:
	var non_empty: Array[Dictionary] = []
	for slot in pioneer_inventory:
		var c: int = int(slot.get("count", 0))
		var id_str: String = str(slot.get("itemId", ""))
		if c > 0 and not id_str.is_empty():
			non_empty.append(slot.duplicate(true))

	# Consolidate partial stacks of the same item up to stack size
	var merged: Array[Dictionary] = []
	for entry in non_empty:
		var item_id: String = str(entry.get("itemId", ""))
		var item_name: String = str(entry.get("itemName", ""))
		var remaining: int = int(entry.get("count", 0))
		var max_stack: int = Catalog.get_item_stack_size(item_id)
		for m in merged:
			if str(m.get("itemId", "")) == item_id and int(m.get("count", 0)) < max_stack:
				var space: int = max_stack - int(m.get("count", 0))
				var take: int = mini(space, remaining)
				m["count"] = int(m.get("count", 0)) + take
				remaining -= take
				if remaining <= 0:
					break
		while remaining > 0:
			var chunk: int = mini(max_stack, remaining)
			merged.append({"itemId": item_id, "itemName": item_name, "count": chunk})
			remaining -= chunk

	merged.sort_custom(func(a: Dictionary, b: Dictionary) -> bool:
		var na: String = str(a.get("itemName", ""))
		var nb: String = str(b.get("itemName", ""))
		if na == nb:
			return int(a.get("count", 0)) > int(b.get("count", 0))
		return na < nb
	)

	pioneer_inventory.clear()
	for i in range(PIONEER_INVENTORY_SIZE):
		if i < merged.size():
			pioneer_inventory.append(merged[i])
		else:
			pioneer_inventory.append({"itemId": "", "itemName": "", "count": 0})
	SynthAudio.play_sfx("click")
	inventory_changed.emit()

func trash_pioneer_slot(slot_idx: int) -> void:
	if slot_idx < 0 or slot_idx >= pioneer_inventory.size():
		return
	pioneer_inventory[slot_idx] = {"itemId": "", "itemName": "", "count": 0}
	SynthAudio.play_sfx("disconnect")
	inventory_changed.emit()

func add_item_to_pioneer_inventory(item_id: String, item_name: String, amount: int) -> int:
	if amount <= 0 or item_id.is_empty():
		return 0
	var remaining: int = amount
	var max_stack: int = Catalog.get_item_stack_size(item_id)
	for slot in pioneer_inventory:
		if str(slot.get("itemId", "")) == item_id and int(slot.get("count", 0)) < max_stack:
			var space: int = max_stack - int(slot.get("count", 0))
			var add: int = mini(space, remaining)
			slot["count"] = int(slot.get("count", 0)) + add
			remaining -= add
			if remaining <= 0:
				inventory_changed.emit()
				return amount
	for i in range(pioneer_inventory.size()):
		if int(pioneer_inventory[i].get("count", 0)) <= 0:
			var add: int = mini(max_stack, remaining)
			pioneer_inventory[i] = {"itemId": item_id, "itemName": item_name, "count": add}
			remaining -= add
			if remaining <= 0:
				inventory_changed.emit()
				return amount
	inventory_changed.emit()
	return amount - remaining

func take_item_from_pioneer_inventory(item_id: String, max_amount: int) -> int:
	var needed: int = max_amount
	var taken: int = 0
	for i in range(pioneer_inventory.size() - 1, -1, -1):
		var slot: Dictionary = pioneer_inventory[i]
		if str(slot.get("itemId", "")).to_lower() == item_id.to_lower() and int(slot.get("count", 0)) > 0:
			var avail: int = int(slot.get("count", 0))
			var pull: int = mini(avail, needed)
			slot["count"] = avail - pull
			if int(slot["count"]) <= 0:
				pioneer_inventory[i] = {"itemId": "", "itemName": "", "count": 0}
			taken += pull
			needed -= pull
			if needed <= 0:
				break
	if taken > 0:
		inventory_changed.emit()
	return taken

func create_sector_world_deposits() -> Array:
	var list: Array = []
	for spec in Catalog.SECTOR_01_DEPOSIT_SPECS:
		var node: Dictionary = FactorySim.create_machine_node(
			"resource_deposit",
			float(spec.get("x", 0.0)),
			float(spec.get("y", 0.0)),
			str(spec.get("id", "")),
			str(spec.get("recipeId", "deposit_iron"))
		)
		node["title"] = str(spec.get("title", "Resource Deposit"))
		node["purity"] = str(spec.get("purity", "normal"))
		list.append(node)
	return list

func ensure_world_deposits_present(existing_nodes: Array) -> Array:
	var result: Array = existing_nodes.duplicate(true)
	var existing_ids: Dictionary = {}
	for n in result:
		existing_ids[str(n.get("id", ""))] = true
	for dep in create_sector_world_deposits():
		var did: String = str(dep.get("id", ""))
		if not existing_ids.has(did):
			result.push_front(dep)
	return result

func create_starter_factory() -> Dictionary:
	var world_deposits: Array = create_sector_world_deposits()
	var starter_dep: Dictionary = world_deposits[0]
	for d in world_deposits:
		if str(d.get("id", "")) == "starter_deposit":
			starter_dep = d
			break

	var base_x: float = float(starter_dep.get("x", 2544.0))
	var base_y: float = float(starter_dep.get("y", 2784.0))

	var miner: Dictionary = FactorySim.create_machine_node("miner_mk1", base_x, base_y, "starter_miner", "mine_iron")
	var smelter: Dictionary = FactorySim.create_machine_node("smelter", base_x + 408.0, base_y, "starter_smelter", "smelt_iron")
	var constructor_node: Dictionary = FactorySim.create_machine_node("constructor", base_x + 816.0, base_y, "starter_constructor", "construct_iron_plate")
	var hub: Dictionary = FactorySim.create_machine_node("the_hub", base_x + 1224.0, base_y + 24.0, "starter_hub", "")

	var all_nodes: Array = world_deposits
	all_nodes.append(miner)
	all_nodes.append(smelter)
	all_nodes.append(constructor_node)
	all_nodes.append(hub)

	var conns: Array = [
		{
			"id": "conn_starter_1",
			"fromNodeId": miner["id"],
			"fromPortId": miner["outputs"][0]["id"],
			"toNodeId": smelter["id"],
			"toPortId": smelter["inputs"][0]["id"],
			"beltTier": 1,
			"itemName": "Iron Ore",
			"ratePerMin": 60.0,
			"maxCapacityPerMin": 60.0,
			"firstItemArrived": true,
			"waypoints": [],
			"inFlightItems": [],
		},
		{
			"id": "conn_starter_2",
			"fromNodeId": smelter["id"],
			"fromPortId": smelter["outputs"][0]["id"],
			"toNodeId": constructor_node["id"],
			"toPortId": constructor_node["inputs"][0]["id"],
			"beltTier": 1,
			"itemName": "Iron Ingot",
			"ratePerMin": 30.0,
			"maxCapacityPerMin": 60.0,
			"firstItemArrived": true,
			"waypoints": [],
			"inFlightItems": [],
		},
		{
			"id": "conn_starter_3",
			"fromNodeId": constructor_node["id"],
			"fromPortId": constructor_node["outputs"][0]["id"],
			"toNodeId": hub["id"],
			"toPortId": hub["inputs"][0]["id"],
			"beltTier": 1,
			"itemName": "Iron Plate",
			"ratePerMin": 20.0,
			"maxCapacityPerMin": 60.0,
			"firstItemArrived": true,
			"waypoints": [],
			"inFlightItems": [],
		},
	]

	FactorySim.step_simulation(all_nodes, conns, 0.0)
	return {"nodes": all_nodes, "connections": conns}

func start_new_session(new_session_name: String, switch_to_play: bool = true) -> void:
	var starter: Dictionary = create_starter_factory()
	session_name = new_session_name.strip_edges() if not new_session_name.strip_edges().is_empty() else "Rocky Desert Sector 01"
	nodes = starter["nodes"]
	connections = starter["connections"]
	camera = {"x": -1820.0, "y": -1920.0, "zoom": 0.74}
	selected_node_id = ""
	selected_node_ids.clear()
	selected_connection_id = ""
	_undo_stack.clear()
	_redo_stack.clear()
	upsert_autosave()
	if switch_to_play:
		app_mode = "playing"
	state_changed.emit()
	selection_changed.emit()
	history_changed.emit()

func get_selected_node() -> Dictionary:
	if selected_node_id.is_empty():
		return {}
	for n in nodes:
		if str(n.get("id", "")) == selected_node_id:
			return n
	return {}

func get_selected_connection() -> Dictionary:
	if selected_connection_id.is_empty():
		return {}
	for c in connections:
		if str(c.get("id", "")) == selected_connection_id:
			return c
	return {}

func select_node(node_id: String) -> void:
	selected_node_id = node_id
	selected_node_ids.clear()
	if not node_id.is_empty():
		selected_node_ids.append(node_id)
		selected_connection_id = ""
	selection_changed.emit()

func select_connection(conn_id: String) -> void:
	selected_connection_id = conn_id
	if not conn_id.is_empty():
		selected_node_id = ""
		selected_node_ids.clear()
	selection_changed.emit()

func clear_selection() -> void:
	selected_node_id = ""
	selected_node_ids.clear()
	selected_connection_id = ""
	selection_changed.emit()

func push_snapshot(description: String) -> void:
	_undo_stack.append({
		"nodes": nodes.duplicate(true),
		"connections": connections.duplicate(true),
		"description": description,
	})
	if _undo_stack.size() > MAX_HISTORY_STEPS:
		_undo_stack.pop_front()
	_redo_stack.clear()
	history_changed.emit()

func can_undo() -> bool:
	return not _undo_stack.is_empty()

func can_redo() -> bool:
	return not _redo_stack.is_empty()

func undo() -> void:
	if _undo_stack.is_empty():
		return
	var snap: Dictionary = _undo_stack.pop_back()
	_redo_stack.append({
		"nodes": nodes.duplicate(true),
		"connections": connections.duplicate(true),
		"description": str(snap.get("description", "Undo")),
	})
	nodes = snap["nodes"]
	connections = snap["connections"]
	SynthAudio.play_sfx("click")
	state_changed.emit()
	selection_changed.emit()
	history_changed.emit()

func redo() -> void:
	if _redo_stack.is_empty():
		return
	var snap: Dictionary = _redo_stack.pop_back()
	_undo_stack.append({
		"nodes": nodes.duplicate(true),
		"connections": connections.duplicate(true),
		"description": str(snap.get("description", "Redo")),
	})
	nodes = snap["nodes"]
	connections = snap["connections"]
	SynthAudio.play_sfx("click")
	state_changed.emit()
	selection_changed.emit()
	history_changed.emit()

func dismantle_nodes(ids_to_remove: Array[String]) -> void:
	var filtered_ids: Array[String] = []
	for id_str in ids_to_remove:
		for n in nodes:
			if str(n.get("id", "")) == id_str and str(n.get("buildingId", "")) != "resource_deposit":
				filtered_ids.append(id_str)
	if filtered_ids.is_empty():
		return
	push_snapshot("Dismantle Machines")
	var next_nodes: Array = []
	for n in nodes:
		if not filtered_ids.has(str(n.get("id", ""))):
			next_nodes.append(n)
	var next_conns: Array = []
	for c in connections:
		if not filtered_ids.has(str(c.get("fromNodeId", ""))) and not filtered_ids.has(str(c.get("toNodeId", ""))):
			next_conns.append(c)
	nodes = next_nodes
	connections = next_conns
	clear_selection()
	SynthAudio.play_sfx("disconnect")
	state_changed.emit()

func dismantle_connection(conn_id: String) -> void:
	if conn_id.is_empty():
		return
	push_snapshot("Dismantle Belt")
	var next_conns: Array = []
	for c in connections:
		if str(c.get("id", "")) != conn_id:
			next_conns.append(c)
	connections = next_conns
	if selected_connection_id == conn_id:
		selected_connection_id = ""
	SynthAudio.play_sfx("disconnect")
	state_changed.emit()
	selection_changed.emit()

func _strip_runtime_cache_for_save(raw_conns: Array) -> Array:
	var cleaned: Array = []
	for c in raw_conns:
		var dup: Dictionary = c.duplicate(true)
		dup.erase("_cachedPoints")
		cleaned.append(dup)
	return cleaned

func upsert_autosave() -> void:
	var slot_data: Dictionary = {
		"id": "slot_autosave_" + session_name.to_lower().replace(" ", "_"),
		"sessionName": session_name,
		"slotName": "Autosave — " + session_name,
		"kind": "auto",
		"updatedAt": int(Time.get_unix_time_from_system() * 1000.0),
		"nodes": nodes.duplicate(true),
		"connections": _strip_runtime_cache_for_save(connections),
		"camera": camera.duplicate(true),
	}
	var replaced: bool = false
	for i in range(save_slots.size()):
		if str(save_slots[i].get("id", "")) == str(slot_data["id"]):
			save_slots[i] = slot_data
			replaced = true
			break
	if not replaced:
		save_slots.push_front(slot_data)
	save_slots_to_disk()

func create_manual_save(slot_label: String) -> void:
	var clean_label: String = slot_label.strip_edges() if not slot_label.strip_edges().is_empty() else "Sector Save"
	var slot_data: Dictionary = {
		"id": "slot_manual_%d" % int(Time.get_unix_time_from_system() * 1000.0),
		"sessionName": session_name,
		"slotName": clean_label,
		"kind": "manual",
		"updatedAt": int(Time.get_unix_time_from_system() * 1000.0),
		"nodes": nodes.duplicate(true),
		"connections": _strip_runtime_cache_for_save(connections),
		"camera": camera.duplicate(true),
	}
	save_slots.push_front(slot_data)
	save_slots_to_disk()
	SynthAudio.play_sfx("save")
	state_changed.emit()

func load_slot_into_active(slot: Dictionary, switch_to_play: bool = true) -> void:
	session_name = str(slot.get("sessionName", "Rocky Desert Sector 01"))
	active_slot_id = str(slot.get("id", "slot_autosave_default"))
	nodes = ensure_world_deposits_present(slot.get("nodes", []))
	connections = (slot.get("connections", []) as Array).duplicate(true)
	var cam: Dictionary = slot.get("camera", {"x": -1820.0, "y": -1920.0, "zoom": 0.74})
	camera = {
		"x": float(cam.get("x", -1820.0)),
		"y": float(cam.get("y", -1920.0)),
		"zoom": clampf(float(cam.get("zoom", 0.74)), Catalog.MIN_ZOOM, Catalog.MAX_ZOOM),
	}
	FactorySim.step_simulation(nodes, connections, 0.0)
	clear_selection()
	_undo_stack.clear()
	_redo_stack.clear()
	if switch_to_play:
		app_mode = "playing"
	state_changed.emit()
	history_changed.emit()

func export_current_save_json() -> String:
	var payload: Dictionary = {
		"version": Catalog.APP_VERSION,
		"sessionName": session_name,
		"slotName": "Exported Save",
		"updatedAt": int(Time.get_unix_time_from_system() * 1000.0),
		"nodes": nodes,
		"connections": _strip_runtime_cache_for_save(connections),
		"camera": camera,
	}
	return JSON.stringify(payload, "  ")

func import_save_json(raw_json: String) -> Dictionary:
	var parsed: Variant = JSON.parse_string(raw_json.strip_edges())
	if typeof(parsed) != TYPE_DICTIONARY:
		return {"ok": false, "error": "Invalid JSON format."}
	var dict: Dictionary = parsed as Dictionary
	if not dict.has("nodes") or not dict.has("connections"):
		return {"ok": false, "error": "Save JSON is missing nodes or connections."}
	load_slot_into_active(dict, true)
	upsert_autosave()
	SynthAudio.play_sfx("save")
	return {"ok": true}

func save_slots_to_disk() -> void:
	var file := FileAccess.open(SAVE_FILE_PATH, FileAccess.WRITE)
	if file:
		file.store_string(JSON.stringify(save_slots))

func load_saves_from_disk() -> void:
	if not FileAccess.file_exists(SAVE_FILE_PATH):
		return
	var file := FileAccess.open(SAVE_FILE_PATH, FileAccess.READ)
	if not file:
		return
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	if typeof(parsed) == TYPE_ARRAY:
		save_slots = parsed as Array

func save_settings_to_disk() -> void:
	var file := FileAccess.open(SETTINGS_FILE_PATH, FileAccess.WRITE)
	if file:
		file.store_string(JSON.stringify(settings))
	Engine.max_fps = 30 if str(settings.get("performanceMode", "60fps")) == "battery_saver" else 60
	state_changed.emit()

func load_settings_from_disk() -> void:
	if not FileAccess.file_exists(SETTINGS_FILE_PATH):
		return
	var file := FileAccess.open(SETTINGS_FILE_PATH, FileAccess.READ)
	if not file:
		return
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	if typeof(parsed) == TYPE_DICTIONARY:
		for k in (parsed as Dictionary).keys():
			settings[k] = parsed[k]
	Engine.max_fps = 30 if str(settings.get("performanceMode", "60fps")) == "battery_saver" else 60
