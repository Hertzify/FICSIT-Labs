extends CanvasLayer
## ============================================================================
## FICSIT Labs — Native Godot 4 UI Controller (HUD, Machine Inspector,
## Pioneer Inventory, Build Menu, Belt Inspector, Main Menu & Settings)
## ============================================================================

@export var sector_world_path: NodePath
var _sector_world: Node2D

var _root: Control
var _title_overlay: PanelContainer
var _hud_container: Control
var _inspector_modal: PanelContainer
var _build_modal: PanelContainer
var _belt_modal: PanelContainer
var _settings_modal: PanelContainer

var _tool_buttons: Dictionary = {}
var _undo_btn: Button
var _redo_btn: Button
var _belt_tier_btn: Button
var _snap_btn: Button

# Inspector live UI references
var _insp_title_lbl: Label
var _insp_status_lbl: Label
var _insp_top_plate: TextureRect
var _insp_lower_plate: TextureRect
var _insp_clock_slider: HSlider
var _insp_clock_input: LineEdit
var _insp_rate_input: LineEdit
var _insp_shard_label: Label
var _insp_standby_btn: Button
var _insp_buffer_lbl: Label
var _insp_recipe_box: HBoxContainer
var _inv_grid: GridContainer
var _selected_inv_slot: int = 0

func _ready() -> void:
	if not sector_world_path.is_empty():
		_sector_world = get_node_or_null(sector_world_path) as Node2D
	if _sector_world:
		_sector_world.connect("request_open_node_inspector", _open_node_inspector)
		_sector_world.connect("request_open_belt_inspector", _open_belt_inspector)

	_build_ui_tree()
	GameState.state_changed.connect(_sync_ui_state)
	GameState.selection_changed.connect(_sync_ui_state)
	GameState.history_changed.connect(_sync_ui_state)
	GameState.inventory_changed.connect(_refresh_pioneer_inventory)
	_sync_ui_state()

func _process(_delta: float) -> void:
	if _inspector_modal and _inspector_modal.visible:
		_refresh_live_inspector_telemetry()

func _build_ui_tree() -> void:
	_root = Control.new()
	_root.set_anchors_preset(Control.PRESET_FULL_RECT)
	_root.mouse_filter = Control.MOUSE_FILTER_PASS
	add_child(_root)

	_build_playing_hud()
	_build_title_menu()
	_build_machine_inspector_modal()
	_build_build_menu_modal()
	_build_belt_inspector_modal()
	_build_settings_modal()

func _make_panel_style(bg_col: Color, border_col: Color, radius: int = 12) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = bg_col
	sb.border_color = border_col
	sb.set_border_width_all(1)
	sb.set_corner_radius_all(radius)
	sb.set_content_margin_all(14)
	return sb

func _build_playing_hud() -> void:
	_hud_container = Control.new()
	_hud_container.set_anchors_preset(Control.PRESET_FULL_RECT)
	_hud_container.mouse_filter = Control.MOUSE_FILTER_PASS
	_root.add_child(_hud_container)

	# Top-Left Menu & Settings Bar
	var top_left := HBoxContainer.new()
	top_left.position = Vector2(16, 14)
	top_left.add_theme_constant_override("separation", 8)
	_hud_container.add_child(top_left)

	var menu_btn := Button.new()
	menu_btn.text = "Menu"
	menu_btn.custom_minimum_size = Vector2(76, 44)
	menu_btn.pressed.connect(func() -> void:
		SynthAudio.play_sfx("click")
		GameState.app_mode = "title"
		GameState.state_changed.emit()
	)
	top_left.add_child(menu_btn)

	var settings_btn := Button.new()
	settings_btn.text = "Settings"
	settings_btn.custom_minimum_size = Vector2(92, 44)
	settings_btn.pressed.connect(func() -> void:
		SynthAudio.play_sfx("click")
		_settings_modal.visible = true
	)
	top_left.add_child(settings_btn)

	# Top-Center Tool Selector Bar (Edit, Move, Select, Corner Dot, Undo, Redo)
	var top_center := HBoxContainer.new()
	top_center.set_anchors_preset(Control.PRESET_CENTER_TOP)
	top_center.position = Vector2(-240, 14)
	top_center.add_theme_constant_override("separation", 6)
	_hud_container.add_child(top_center)

	var tools: Array[Dictionary] = [
		{"id": "edit", "label": "Edit"},
		{"id": "move", "label": "Move"},
		{"id": "select", "label": "Select"},
		{"id": "waypoint", "label": "90° Dot"},
	]
	for t in tools:
		var btn := Button.new()
		var tid: String = str(t["id"])
		btn.text = str(t["label"])
		btn.custom_minimum_size = Vector2(74, 44)
		btn.pressed.connect(func() -> void:
			SynthAudio.play_sfx("click")
			GameState.active_tool = tid
			GameState.active_build_id = ""
			_sync_ui_state()
		)
		top_center.add_child(btn)
		_tool_buttons[tid] = btn

	_undo_btn = Button.new()
	_undo_btn.text = "Undo"
	_undo_btn.custom_minimum_size = Vector2(68, 44)
	_undo_btn.pressed.connect(func() -> void: GameState.undo())
	top_center.add_child(_undo_btn)

	_redo_btn = Button.new()
	_redo_btn.text = "Redo"
	_redo_btn.custom_minimum_size = Vector2(68, 44)
	_redo_btn.pressed.connect(func() -> void: GameState.redo())
	top_center.add_child(_redo_btn)

	# Bottom-Left Belt Tier & Snap Bar
	var bottom_left := HBoxContainer.new()
	bottom_left.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	bottom_left.position = Vector2(16, -60)
	bottom_left.add_theme_constant_override("separation", 8)
	_hud_container.add_child(bottom_left)

	_belt_tier_btn = Button.new()
	_belt_tier_btn.text = "Belt: Mk.1"
	_belt_tier_btn.custom_minimum_size = Vector2(110, 44)
	_belt_tier_btn.pressed.connect(func() -> void:
		SynthAudio.play_sfx("click")
		GameState.active_belt_tier = (GameState.active_belt_tier % 6) + 1
		_sync_ui_state()
	)
	bottom_left.add_child(_belt_tier_btn)

	_snap_btn = Button.new()
	_snap_btn.text = "Snap: ON"
	_snap_btn.custom_minimum_size = Vector2(104, 44)
	_snap_btn.pressed.connect(func() -> void:
		SynthAudio.play_sfx("click")
		GameState.settings["snapToGrid"] = not bool(GameState.settings.get("snapToGrid", true))
		GameState.save_settings_to_disk()
		_sync_ui_state()
	)
	bottom_left.add_child(_snap_btn)

	# Bottom-Right Build Menu Button
	var build_btn := Button.new()
	build_btn.text = "BUILD"
	build_btn.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	build_btn.position = Vector2(-116, -64)
	build_btn.custom_minimum_size = Vector2(100, 48)
	build_btn.pressed.connect(func() -> void:
		SynthAudio.play_sfx("click")
		_build_modal.visible = not _build_modal.visible
	)
	_hud_container.add_child(build_btn)

func _build_title_menu() -> void:
	_title_overlay = PanelContainer.new()
	_title_overlay.set_anchors_preset(Control.PRESET_CENTER)
	_title_overlay.custom_minimum_size = Vector2(540, 420)
	_title_overlay.position = Vector2(-270, -210)
	_title_overlay.add_theme_stylebox_override("panel", _make_panel_style(Color(0.05, 0.07, 0.11, 0.96), Color("#F59E0B"), 16))
	_root.add_child(_title_overlay)

	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 14)
	_title_overlay.add_child(vbox)

	var title_lbl := Label.new()
	title_lbl.text = "FICSIT LABS — NATIVE GODOT 4 ENGINE"
	title_lbl.add_theme_font_size_override("font_size", 22)
	title_lbl.add_theme_color_override("font_color", Color("#F59E0B"))
	vbox.add_child(title_lbl)

	var sub_lbl := Label.new()
	sub_lbl.text = "2D Automation & Logistics Tycoon · " + Catalog.APP_BUILD_TAG
	sub_lbl.add_theme_font_size_override("font_size", 13)
	sub_lbl.add_theme_color_override("font_color", Color("#94A3B8"))
	vbox.add_child(sub_lbl)

	var cont_btn := Button.new()
	cont_btn.text = "Continue Session"
	cont_btn.custom_minimum_size = Vector2(0, 48)
	cont_btn.pressed.connect(func() -> void:
		SynthAudio.play_sfx("click")
		GameState.app_mode = "playing"
		GameState.state_changed.emit()
	)
	vbox.add_child(cont_btn)

	var new_btn := Button.new()
	new_btn.text = "New Game — Fresh Sector 01"
	new_btn.custom_minimum_size = Vector2(0, 48)
	new_btn.pressed.connect(func() -> void:
		SynthAudio.play_sfx("place")
		GameState.start_new_session("Rocky Desert Sector 01", true)
	)
	vbox.add_child(new_btn)

	var set_btn := Button.new()
	set_btn.text = "Settings & Save Export/Import"
	set_btn.custom_minimum_size = Vector2(0, 48)
	set_btn.pressed.connect(func() -> void:
		SynthAudio.play_sfx("click")
		_settings_modal.visible = true
	)
	vbox.add_child(set_btn)

func _build_machine_inspector_modal() -> void:
	_inspector_modal = PanelContainer.new()
	_inspector_modal.visible = false
	_inspector_modal.set_anchors_preset(Control.PRESET_CENTER)
	_inspector_modal.custom_minimum_size = Vector2(940, 560)
	_inspector_modal.position = Vector2(-470, -280)
	_inspector_modal.add_theme_stylebox_override("panel", _make_panel_style(Color("#1A1E24"), Color("#3D424B"), 8))
	_root.add_child(_inspector_modal)

	var outer_vbox := VBoxContainer.new()
	outer_vbox.add_theme_constant_override("separation", 10)
	_inspector_modal.add_child(outer_vbox)

	# Top Title Bar with Close 'X'
	var header := HBoxContainer.new()
	outer_vbox.add_child(header)

	_insp_title_lbl = Label.new()
	_insp_title_lbl.text = "Miner Mk.1"
	_insp_title_lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_insp_title_lbl.add_theme_font_size_override("font_size", 18)
	header.add_child(_insp_title_lbl)

	var dismantle_btn := Button.new()
	dismantle_btn.text = "Dismantle"
	dismantle_btn.custom_minimum_size = Vector2(96, 38)
	dismantle_btn.pressed.connect(func() -> void:
		if not GameState.selected_node_id.is_empty():
			GameState.dismantle_nodes([GameState.selected_node_id])
			_inspector_modal.visible = false
	)
	header.add_child(dismantle_btn)

	var close_btn := Button.new()
	close_btn.text = "✕"
	close_btn.custom_minimum_size = Vector2(44, 38)
	close_btn.pressed.connect(func() -> void:
		SynthAudio.play_sfx("click")
		_inspector_modal.visible = false
	)
	header.add_child(close_btn)

	# Dual-Panel Body: Left = Authentic Satisfactory Machine Bay + Overclocking, Right = Pioneer Inventory
	var body_split := HBoxContainer.new()
	body_split.add_theme_constant_override("separation", 16)
	body_split.size_flags_vertical = Control.SIZE_EXPAND_FILL
	outer_vbox.add_child(body_split)

	# Left Column: Machine Plates, Recipe Selector & Manual Clock Speed / Rate Inputs
	var left_col := VBoxContainer.new()
	left_col.custom_minimum_size = Vector2(520, 0)
	left_col.add_theme_constant_override("separation", 8)
	body_split.add_child(left_col)

	_insp_top_plate = TextureRect.new()
	_insp_top_plate.custom_minimum_size = Vector2(500, 175)
	_insp_top_plate.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_insp_top_plate.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	left_col.add_child(_insp_top_plate)

	_insp_status_lbl = Label.new()
	_insp_status_lbl.text = "Status: Running · 5.0 MW · 100% Eff"
	_insp_status_lbl.add_theme_font_size_override("font_size", 13)
	_insp_status_lbl.add_theme_color_override("font_color", Color("#FACC15"))
	left_col.add_child(_insp_status_lbl)

	_insp_buffer_lbl = Label.new()
	_insp_buffer_lbl.text = "Output Buffer: 0 / 100"
	_insp_buffer_lbl.add_theme_font_size_override("font_size", 13)
	left_col.add_child(_insp_buffer_lbl)

	_insp_recipe_box = HBoxContainer.new()
	_insp_recipe_box.add_theme_constant_override("separation", 6)
	left_col.add_child(_insp_recipe_box)

	_insp_lower_plate = TextureRect.new()
	_insp_lower_plate.custom_minimum_size = Vector2(500, 125)
	_insp_lower_plate.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_insp_lower_plate.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	_insp_lower_plate.texture = Catalog.get_cached_texture("res://assets/icons/buildings/machine_lower_bay_clean.png")
	left_col.add_child(_insp_lower_plate)

	# Overclocking Controls (1% - 250%, Manual % and Items/Min inputs, Power Shard Slots)
	var oc_row := HBoxContainer.new()
	oc_row.add_theme_constant_override("separation", 8)
	left_col.add_child(oc_row)

	var oc_lbl := Label.new()
	oc_lbl.text = "Clock %:"
	oc_row.add_child(oc_lbl)

	_insp_clock_input = LineEdit.new()
	_insp_clock_input.custom_minimum_size = Vector2(76, 36)
	_insp_clock_input.text_submitted.connect(_on_manual_clock_submitted)
	oc_row.add_child(_insp_clock_input)

	var rate_lbl := Label.new()
	rate_lbl.text = "Target /min:"
	oc_row.add_child(rate_lbl)

	_insp_rate_input = LineEdit.new()
	_insp_rate_input.custom_minimum_size = Vector2(82, 36)
	_insp_rate_input.text_submitted.connect(_on_manual_rate_submitted)
	oc_row.add_child(_insp_rate_input)

	_insp_standby_btn = Button.new()
	_insp_standby_btn.text = "STANDBY: OFF"
	_insp_standby_btn.custom_minimum_size = Vector2(124, 36)
	_insp_standby_btn.pressed.connect(_on_toggle_inspector_standby)
	oc_row.add_child(_insp_standby_btn)

	_insp_clock_slider = HSlider.new()
	_insp_clock_slider.min_value = 1.0
	_insp_clock_slider.max_value = 100.0
	_insp_clock_slider.step = 1.0
	_insp_clock_slider.value_changed.connect(_on_clock_slider_changed)
	left_col.add_child(_insp_clock_slider)

	# Power Shard Slot Controls (Manual insertion/removal only, never auto-added by clock speed)
	var shard_row := HBoxContainer.new()
	shard_row.add_theme_constant_override("separation", 8)
	left_col.add_child(shard_row)

	_insp_shard_label = Label.new()
	_insp_shard_label.text = "Power Shards: 0 / 3 (Max 100%)"
	_insp_shard_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	shard_row.add_child(_insp_shard_label)

	var add_shard_btn := Button.new()
	add_shard_btn.text = "+ Insert Shard"
	add_shard_btn.custom_minimum_size = Vector2(115, 36)
	add_shard_btn.pressed.connect(_on_insert_power_shard)
	shard_row.add_child(add_shard_btn)

	var rem_shard_btn := Button.new()
	rem_shard_btn.text = "- Remove Shard"
	rem_shard_btn.custom_minimum_size = Vector2(115, 36)
	rem_shard_btn.pressed.connect(_on_remove_power_shard)
	shard_row.add_child(rem_shard_btn)

	# Right Column: Pioneer Inventory (9x5 Grid + Sort + Trash)
	var right_col := VBoxContainer.new()
	right_col.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	right_col.add_theme_constant_override("separation", 8)
	body_split.add_child(right_col)

	var inv_title := Label.new()
	inv_title.text = "All Items (Pioneer Inventory 9×5):"
	inv_title.add_theme_font_size_override("font_size", 14)
	right_col.add_child(inv_title)

	_inv_grid = GridContainer.new()
	_inv_grid.columns = 9
	_inv_grid.add_theme_constant_override("h_separation", 4)
	_inv_grid.add_theme_constant_override("v_separation", 4)
	right_col.add_child(_inv_grid)

	var inv_footer := HBoxContainer.new()
	inv_footer.add_theme_constant_override("separation", 12)
	right_col.add_child(inv_footer)

	var sort_btn := Button.new()
	sort_btn.text = "↓≡ Sort"
	sort_btn.custom_minimum_size = Vector2(110, 42)
	sort_btn.pressed.connect(func() -> void: GameState.sort_pioneer_inventory())
	inv_footer.add_child(sort_btn)

	var trash_btn := Button.new()
	trash_btn.text = "🗑 Trash Selected"
	trash_btn.custom_minimum_size = Vector2(140, 42)
	trash_btn.pressed.connect(func() -> void: GameState.trash_pioneer_slot(_selected_inv_slot))
	inv_footer.add_child(trash_btn)

func _open_node_inspector(node_id: String) -> void:
	GameState.select_node(node_id)
	var node: Dictionary = GameState.get_selected_node()
	if node.is_empty() or str(node.get("buildingId", "")) == "resource_deposit":
		return

	var b_id: String = str(node.get("buildingId", ""))
	if b_id == "miner_mk1":
		_insp_top_plate.texture = Catalog.get_cached_texture("res://assets/icons/buildings/miner_top_bay_clean.png")
	else:
		_insp_top_plate.texture = Catalog.get_cached_texture("res://assets/icons/buildings/processor_top_bay_clean.png")

	# Populate recipe selector buttons
	for child in _insp_recipe_box.get_children():
		child.queue_free()
	var b_def: Dictionary = Catalog.BUILDINGS.get(b_id, {})
	var avail_recipes: Array = b_def.get("availableRecipeIds", [])
	for r_id in avail_recipes:
		var r_def: Dictionary = Catalog.RECIPES.get(str(r_id), {})
		var r_btn := Button.new()
		r_btn.text = str(r_def.get("name", r_id))
		r_btn.custom_minimum_size = Vector2(90, 34)
		var captured_rid: String = str(r_id)
		r_btn.pressed.connect(func() -> void:
			var cur_n: Dictionary = GameState.get_selected_node()
			if not cur_n.is_empty():
				GameState.push_snapshot("Change Recipe")
				FactorySim.change_node_recipe(cur_n, captured_rid)
				FactorySim.step_simulation(GameState.nodes, GameState.connections, 0.0)
				SynthAudio.play_sfx("click")
				_refresh_live_inspector_telemetry()
				GameState.state_changed.emit()
		)
		_insp_recipe_box.add_child(r_btn)

	_refresh_pioneer_inventory()
	_refresh_live_inspector_telemetry()
	_inspector_modal.visible = true

func _refresh_live_inspector_telemetry() -> void:
	var node: Dictionary = GameState.get_selected_node()
	if node.is_empty():
		_inspector_modal.visible = false
		return

	var b_id: String = str(node.get("buildingId", ""))
	var shards: int = int(node.get("powerShards", 0))
	var max_clock: float = Catalog.get_max_clock_speed_pct(shards)
	var clock_pct: float = Catalog.clamp_clock_speed_pct(float(node.get("overclock", 100.0)), shards)
	var is_stby: bool = bool(node.get("standby", false))
	var mw_val: float = Catalog.get_building_power_mw(b_id, clock_pct, is_stby)
	var eff_val: int = int(roundf(float(node.get("efficiency", 0.0))))

	_insp_title_lbl.text = str(node.get("title", "Machine"))
	_insp_status_lbl.text = "Status: %s · %.1f MW · %d%% Efficiency" % [str(node.get("status", "running")).to_upper(), mw_val, eff_val]
	_insp_buffer_lbl.text = "Input Buffer: %d   |   Output Buffer: %d / %d" % [int(node.get("storage", 0)), int(node.get("outputStorage", 0)), int(node.get("maxStorage", 100))]

	_insp_clock_slider.max_value = max_clock
	_insp_clock_slider.set_value_no_signal(clock_pct)
	if not _insp_clock_input.has_focus():
		_insp_clock_input.text = "%.1f" % clock_pct

	var outs: Array = node.get("outputs", [])
	var target_rate: float = float(outs[0].get("ratePerMin", 60.0)) if outs.size() > 0 else 60.0
	if not _insp_rate_input.has_focus():
		_insp_rate_input.text = "%.1f" % target_rate

	_insp_shard_label.text = "Power Shards: %d / 3 (Max %d%%)" % [shards, int(max_clock)]
	_insp_standby_btn.text = "STANDBY: ON" if is_stby else "STANDBY: OFF"

func _on_clock_slider_changed(val: float) -> void:
	var node: Dictionary = GameState.get_selected_node()
	if node.is_empty():
		return
	# Increasing clock speed clamps strictly to unlocked Power Shard limit and plays zero SFX
	var shards: int = int(node.get("powerShards", 0))
	node["overclock"] = Catalog.clamp_clock_speed_pct(val, shards)
	FactorySim.step_simulation(GameState.nodes, GameState.connections, 0.0)
	_refresh_live_inspector_telemetry()
	GameState.state_changed.emit()

func _on_manual_clock_submitted(text: String) -> void:
	var node: Dictionary = GameState.get_selected_node()
	if node.is_empty():
		return
	var parsed: float = text.to_float()
	var shards: int = int(node.get("powerShards", 0))
	node["overclock"] = Catalog.clamp_clock_speed_pct(parsed, shards)
	FactorySim.step_simulation(GameState.nodes, GameState.connections, 0.0)
	_insp_clock_input.release_focus()
	_refresh_live_inspector_telemetry()
	GameState.state_changed.emit()

func _on_manual_rate_submitted(text: String) -> void:
	var node: Dictionary = GameState.get_selected_node()
	if node.is_empty():
		return
	var desired_rate: float = maxf(0.1, text.to_float())
	var b_id: String = str(node.get("buildingId", ""))
	var base_rate: float = 60.0
	if b_id == "miner_mk1":
		var purity_key: String = str(node.get("purity", "normal"))
		var p_cfg: Dictionary = Catalog.PURITY_CONFIG.get(purity_key, Catalog.PURITY_CONFIG["normal"])
		base_rate = 60.0 * float(p_cfg.get("multiplier", 1.0))
	else:
		var recipe: Dictionary = Catalog.RECIPES.get(str(node.get("recipeId", "")), {})
		var r_outs: Array = recipe.get("outputs", [])
		if r_outs.size() > 0:
			base_rate = float(r_outs[0].get("ratePerMin", 30.0))

	var raw_pct: float = (desired_rate / maxf(0.1, base_rate)) * 100.0
	var shards: int = int(node.get("powerShards", 0))
	node["overclock"] = Catalog.clamp_clock_speed_pct(raw_pct, shards)
	FactorySim.step_simulation(GameState.nodes, GameState.connections, 0.0)
	_insp_rate_input.release_focus()
	_refresh_live_inspector_telemetry()
	GameState.state_changed.emit()

func _on_insert_power_shard() -> void:
	var node: Dictionary = GameState.get_selected_node()
	if node.is_empty():
		return
	var cur_shards: int = int(node.get("powerShards", 0))
	if cur_shards >= 3:
		return
	if GameState.take_item_from_pioneer_inventory("power_shard", 1) > 0:
		node["powerShards"] = cur_shards + 1
		SynthAudio.play_sfx("click")
		_refresh_live_inspector_telemetry()
		GameState.state_changed.emit()
	else:
		SynthAudio.play_sfx("error")

func _on_remove_power_shard() -> void:
	var node: Dictionary = GameState.get_selected_node()
	if node.is_empty():
		return
	var cur_shards: int = int(node.get("powerShards", 0))
	if cur_shards <= 0:
		return
	node["powerShards"] = cur_shards - 1
	node["overclock"] = Catalog.clamp_clock_speed_pct(float(node.get("overclock", 100.0)), cur_shards - 1)
	GameState.add_item_to_pioneer_inventory("power_shard", "Power Shard", 1)
	FactorySim.step_simulation(GameState.nodes, GameState.connections, 0.0)
	SynthAudio.play_sfx("click")
	_refresh_live_inspector_telemetry()
	GameState.state_changed.emit()

func _on_toggle_inspector_standby() -> void:
	var node: Dictionary = GameState.get_selected_node()
	if node.is_empty():
		return
	node["standby"] = not bool(node.get("standby", false))
	FactorySim.step_simulation(GameState.nodes, GameState.connections, 0.0)
	SynthAudio.play_sfx("click")
	_refresh_live_inspector_telemetry()
	GameState.state_changed.emit()

func _refresh_pioneer_inventory() -> void:
	if _inv_grid == null:
		return
	for child in _inv_grid.get_children():
		child.queue_free()

	for i in range(GameState.pioneer_inventory.size()):
		var slot: Dictionary = GameState.pioneer_inventory[i]
		var count: int = int(slot.get("count", 0))
		var item_id: String = str(slot.get("itemId", ""))
		var btn := Button.new()
		btn.custom_minimum_size = Vector2(38, 38)
		if count > 0 and not item_id.is_empty():
			btn.text = str(count)
			btn.icon = Catalog.get_item_texture(item_id)
			btn.expand_icon = true
		else:
			btn.text = ""
		var idx: int = i
		btn.pressed.connect(func() -> void:
			_selected_inv_slot = idx
			SynthAudio.play_sfx("click")
		)
		_inv_grid.add_child(btn)

func _build_build_menu_modal() -> void:
	_build_modal = PanelContainer.new()
	_build_modal.visible = false
	_build_modal.set_anchors_preset(Control.PRESET_CENTER)
	_build_modal.custom_minimum_size = Vector2(680, 420)
	_build_modal.position = Vector2(-340, -210)
	_build_modal.add_theme_stylebox_override("panel", _make_panel_style(Color("#111827"), Color("#F59E0B"), 12))
	_root.add_child(_build_modal)

	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 10)
	_build_modal.add_child(vbox)

	var header := HBoxContainer.new()
	vbox.add_child(header)

	var lbl := Label.new()
	lbl.text = "FICSIT BUILD MENU — SELECT MACHINE TO DEPLOY"
	lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	lbl.add_theme_font_size_override("font_size", 17)
	lbl.add_theme_color_override("font_color", Color("#F59E0B"))
	header.add_child(lbl)

	var close_btn := Button.new()
	close_btn.text = "✕"
	close_btn.custom_minimum_size = Vector2(44, 38)
	close_btn.pressed.connect(func() -> void: _build_modal.visible = false)
	header.add_child(close_btn)

	var grid := GridContainer.new()
	grid.columns = 3
	grid.add_theme_constant_override("h_separation", 10)
	grid.add_theme_constant_override("v_separation", 10)
	vbox.add_child(grid)

	for b_id in Catalog.BUILDINGS.keys():
		var b_def: Dictionary = Catalog.BUILDINGS[b_id]
		if not bool(b_def.get("buildable", true)):
			continue
		var btn := Button.new()
		btn.text = str(b_def.get("name", b_id))
		btn.icon = Catalog.get_building_texture(str(b_id))
		btn.expand_icon = true
		btn.custom_minimum_size = Vector2(200, 64)
		var captured_id: String = str(b_id)
		btn.pressed.connect(func() -> void:
			SynthAudio.play_sfx("click")
			GameState.active_tool = "build"
			GameState.active_build_id = captured_id
			_build_modal.visible = false
			_sync_ui_state()
		)
		grid.add_child(btn)

func _build_belt_inspector_modal() -> void:
	_belt_modal = PanelContainer.new()
	_belt_modal.visible = false
	_belt_modal.set_anchors_preset(Control.PRESET_CENTER)
	_belt_modal.custom_minimum_size = Vector2(460, 280)
	_belt_modal.position = Vector2(-230, -140)
	_belt_modal.add_theme_stylebox_override("panel", _make_panel_style(Color("#111827"), Color("#38BDF8"), 12))
	_root.add_child(_belt_modal)

	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 10)
	_belt_modal.add_child(vbox)

	var header := HBoxContainer.new()
	vbox.add_child(header)

	var lbl := Label.new()
	lbl.text = "CONVEYOR BELT INSPECTOR (MK.1 – MK.6)"
	lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	header.add_child(lbl)

	var close_btn := Button.new()
	close_btn.text = "✕"
	close_btn.custom_minimum_size = Vector2(44, 38)
	close_btn.pressed.connect(func() -> void: _belt_modal.visible = false)
	header.add_child(close_btn)

	var tier_grid := GridContainer.new()
	tier_grid.columns = 3
	tier_grid.add_theme_constant_override("h_separation", 8)
	tier_grid.add_theme_constant_override("v_separation", 8)
	vbox.add_child(tier_grid)

	for tier_num in range(1, 7):
		var t_def: Dictionary = Catalog.CONVEYOR_BELT_TIERS[tier_num]
		var btn := Button.new()
		btn.text = "%s (%d/m)" % [str(t_def["shortLabel"]), int(t_def["capacityPerMin"])]
		btn.custom_minimum_size = Vector2(132, 44)
		var captured_tier: int = tier_num
		btn.pressed.connect(func() -> void:
			var conn: Dictionary = GameState.get_selected_connection()
			if not conn.is_empty():
				GameState.push_snapshot("Upgrade Belt Tier")
				conn["beltTier"] = captured_tier
				FactorySim.step_simulation(GameState.nodes, GameState.connections, 0.0)
				SynthAudio.play_sfx("connect")
				GameState.state_changed.emit()
		)
		tier_grid.add_child(btn)

	var dis_btn := Button.new()
	dis_btn.text = "Dismantle Conveyor Belt"
	dis_btn.custom_minimum_size = Vector2(0, 44)
	dis_btn.pressed.connect(func() -> void:
		if not GameState.selected_connection_id.is_empty():
			GameState.dismantle_connection(GameState.selected_connection_id)
			_belt_modal.visible = false
	)
	vbox.add_child(dis_btn)

func _open_belt_inspector(_conn_id: String) -> void:
	_belt_modal.visible = true

func _build_settings_modal() -> void:
	_settings_modal = PanelContainer.new()
	_settings_modal.visible = false
	_settings_modal.set_anchors_preset(Control.PRESET_CENTER)
	_settings_modal.custom_minimum_size = Vector2(540, 380)
	_settings_modal.position = Vector2(-270, -190)
	_settings_modal.add_theme_stylebox_override("panel", _make_panel_style(Color("#111827"), Color("#94A3B8"), 12))
	_root.add_child(_settings_modal)

	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 10)
	_settings_modal.add_child(vbox)

	var header := HBoxContainer.new()
	vbox.add_child(header)

	var lbl := Label.new()
	lbl.text = "SETTINGS & CROSS-PLATFORM SAVE TRANSFER"
	lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	header.add_child(lbl)

	var close_btn := Button.new()
	close_btn.text = "✕"
	close_btn.custom_minimum_size = Vector2(44, 38)
	close_btn.pressed.connect(func() -> void: _settings_modal.visible = false)
	header.add_child(close_btn)

	var perf_btn := Button.new()
	perf_btn.text = "Toggle Performance Mode (60 FPS / Battery Saver 30 FPS)"
	perf_btn.custom_minimum_size = Vector2(0, 44)
	perf_btn.pressed.connect(func() -> void:
		var cur: String = str(GameState.settings.get("performanceMode", "60fps"))
		GameState.settings["performanceMode"] = "battery_saver" if cur == "60fps" else "60fps"
		GameState.save_settings_to_disk()
		SynthAudio.play_sfx("click")
	)
	vbox.add_child(perf_btn)

	var rate_btn := Button.new()
	rate_btn.text = "Toggle Rate Format (60 per minute / 60/m)"
	rate_btn.custom_minimum_size = Vector2(0, 44)
	rate_btn.pressed.connect(func() -> void:
		var cur: String = str(GameState.settings.get("rateDisplayFormat", "per_minute"))
		GameState.settings["rateDisplayFormat"] = "compact" if cur == "per_minute" else "per_minute"
		GameState.save_settings_to_disk()
		SynthAudio.play_sfx("click")
	)
	vbox.add_child(rate_btn)

	var copy_save_btn := Button.new()
	copy_save_btn.text = "Copy Save JSON to Clipboard"
	copy_save_btn.custom_minimum_size = Vector2(0, 44)
	copy_save_btn.pressed.connect(func() -> void:
		DisplayServer.clipboard_set(GameState.export_current_save_json())
		SynthAudio.play_sfx("save")
	)
	vbox.add_child(copy_save_btn)

	var paste_save_btn := Button.new()
	paste_save_btn.text = "Import Save JSON from Clipboard"
	paste_save_btn.custom_minimum_size = Vector2(0, 44)
	paste_save_btn.pressed.connect(func() -> void:
		var clip: String = DisplayServer.clipboard_get()
		var res: Dictionary = GameState.import_save_json(clip)
		if bool(res.get("ok", false)):
			_settings_modal.visible = false
		else:
			SynthAudio.play_sfx("error")
	)
	vbox.add_child(paste_save_btn)

func _sync_ui_state() -> void:
	if _title_overlay == null or _hud_container == null:
		return
	var is_title: bool = GameState.app_mode == "title"
	_title_overlay.visible = is_title
	_hud_container.visible = not is_title
	if is_title:
		_inspector_modal.visible = false
		_build_modal.visible = false
		_belt_modal.visible = false

	if _undo_btn:
		_undo_btn.disabled = not GameState.can_undo()
	if _redo_btn:
		_redo_btn.disabled = not GameState.can_redo()
	if _belt_tier_btn:
		_belt_tier_btn.text = "Belt: Mk.%d" % GameState.active_belt_tier
	if _snap_btn:
		_snap_btn.text = "Snap: ON" if bool(GameState.settings.get("snapToGrid", true)) else "Snap: OFF"
