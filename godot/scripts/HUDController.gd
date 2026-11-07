extends CanvasLayer
## ============================================================================
## FICSIT Labs — 1:1 Native Godot 4 UI Controller
## Ported directly from MainMenu.tsx, SatisfactoryToolbar.tsx, BuildMenuModal.tsx,
## NodeInspectorPanel.tsx, MachineOverclockSection.tsx, PioneerInventoryPanel.tsx,
## SaveLoadModal.tsx, and SettingsModal.tsx
## ============================================================================

@export var sector_world_path: NodePath
var _sector_world: Node2D

var _root: Control

# 1. Title Screen Widescreen Left-Docked Main Menu + Modals
var _title_layer: Control
var _title_continue_btn: Button
var _title_continue_sub: Label
var _title_session_lbl: Label
var _title_stats_lbl: Label
var _new_game_backdrop: ColorRect
var _new_game_input: LineEdit

# 2. Playing HUD Overlay (Top-Left Menu/Settings, Top-Center Toolbar, Bottom-Left Belt/Snap, Bottom-Right Build)
var _hud_layer: Control
var _tool_buttons: Dictionary = {}
var _undo_btn: Button
var _redo_btn: Button
var _belt_flyout_panel: PanelContainer
var _belt_tier_btn: Button
var _belt_tier_dot: ColorRect
var _belt_tier_buttons: Dictionary = {}
var _snap_btn: Button
var _build_hud_btn: Button
var _active_build_banner: PanelContainer
var _active_build_lbl: Label
var _multi_select_bar: PanelContainer
var _multi_select_lbl: Label

# 3. Pause Menu Dialog
var _pause_backdrop: ColorRect
var _pause_session_lbl: Label

# 4. 12-Column Satisfactory Build Menu Modal
var _build_backdrop: ColorRect
var _build_active_cat: String = "production"
var _build_selected_id: String = "miner_mk1"
var _build_cat_buttons: Dictionary = {}
var _build_cards_vbox: VBoxContainer
var _build_insp_icon: TextureRect
var _build_insp_sub: Label
var _build_insp_title: Label
var _build_insp_desc: Label
var _build_insp_metrics: Label
var _build_deploy_btn: Button

# 5. Authentic Satisfactory Dual-Panel Machine Inspector + Pioneer Inventory Modal
var _inspector_backdrop: ColorRect
var _insp_title_lbl: Label
var _insp_tab_prod_btn: Button
var _insp_tab_rec_btn: Button
var _insp_active_tab: String = "production"
var _insp_prod_view: Control
var _insp_recipe_scroll: ScrollContainer
var _insp_recipe_list: VBoxContainer

# Top Bay Overlays (Miner 563x391 or Processor 563x391 scaled to fit 860x540 modal)
var _insp_top_plate: TextureRect
var _insp_miner_overlay: Control
var _insp_miner_ore_icon: TextureRect
var _insp_miner_ore_badge: Label
var _insp_miner_ore_title: Label
var _insp_miner_ore_rate: Label
var _insp_miner_prog_bar: ColorRect
var _insp_miner_status_lbl: Label
var _insp_miner_mw_lbl: Label
var _insp_miner_sec_lbl: Label
var _insp_miner_eff_lbl: Label

var _insp_proc_overlay: Control
var _insp_proc_recipe_btn: Button
var _insp_proc_inputs_vbox: VBoxContainer
var _insp_proc_out_icon: TextureRect
var _insp_proc_prog_bar: ColorRect
var _insp_proc_status_lbl: Label
var _insp_proc_mw_lbl: Label
var _insp_proc_sec_lbl: Label
var _insp_proc_out_slot_icon: TextureRect
var _insp_proc_out_slot_badge: Label
var _insp_proc_out_title: Label
var _insp_proc_out_rate: Label

# Lower Overclock Bay (machine_lower_bay_clean.png) Overlays
var _insp_lower_plate: TextureRect
var _insp_clock_input: LineEdit
var _insp_rate_input: LineEdit
var _insp_shard_slots: Array[Button] = []
var _insp_seg_fills: Array[ColorRect] = []
var _insp_seg_bgs: Array[ColorRect] = []
var _insp_clock_slider: HSlider
var _insp_paste_btn: Button
var _insp_rocker_on_bg: ColorRect
var _insp_rocker_off_bg: ColorRect

# Pioneer Inventory Right Column
var _inv_relevant_hbox: HBoxContainer
var _inv_grid: GridContainer
var _inv_sort_btn: Button
var _selected_inv_slot: int = 0
var _copied_machine_settings: Dictionary = {}

# 6. Conveyor Belt Inspector Modal
var _belt_backdrop: ColorRect
var _belt_title_lbl: Label
var _belt_metrics_lbl: Label
var _belt_tier_modal_btns: Dictionary = {}

# 7. Save / Load Manager Modal
var _saveload_backdrop: ColorRect
var _saveload_title_lbl: Label
var _saveload_name_input: LineEdit
var _saveload_slots_vbox: VBoxContainer
var _saveload_status_lbl: Label

# 8. Settings Modal
var _settings_backdrop: ColorRect
var _set_snap_btn: Button
var _set_perf_btn: Button
var _set_sfx_btn: Button
var _set_rate_btn: Button

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
	if _inspector_backdrop and _inspector_backdrop.visible:
		_refresh_live_inspector_telemetry()
	if _sector_world:
		_sector_world.set("modal_blocker_active", _is_any_modal_open())

func _is_any_modal_open() -> bool:
	return (
		(_inspector_backdrop != null and _inspector_backdrop.visible)
		or (_build_backdrop != null and _build_backdrop.visible)
		or (_belt_backdrop != null and _belt_backdrop.visible)
		or (_saveload_backdrop != null and _saveload_backdrop.visible)
		or (_settings_backdrop != null and _settings_backdrop.visible)
		or (_pause_backdrop != null and _pause_backdrop.visible)
		or (_new_game_backdrop != null and _new_game_backdrop.visible)
	)

# ============================================================================
# STYLEBOX & BUTTON THEME BUILDERS
# ============================================================================
func _make_box_style(
	bg_col: Color,
	border_col: Color = Color.TRANSPARENT,
	radius: int = 10,
	border_w: int = 1,
	pad_x: int = 12,
	pad_y: int = 10
) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = bg_col
	sb.set_corner_radius_all(radius)
	if border_w > 0 and border_col.a > 0.0:
		sb.border_color = border_col
		sb.set_border_width_all(border_w)
	sb.content_margin_left = pad_x
	sb.content_margin_right = pad_x
	sb.content_margin_top = pad_y
	sb.content_margin_bottom = pad_y
	return sb

func _style_button(
	btn: Button,
	bg_col: Color,
	border_col: Color,
	text_col: Color = Color("#F8FAFC"),
	radius: int = 10,
	font_size: int = 13,
	pad_x: int = 12,
	pad_y: int = 8
) -> void:
	var normal := _make_box_style(bg_col, border_col, radius, 1, pad_x, pad_y)
	var hover := _make_box_style(bg_col.lightened(0.10), border_col.lightened(0.18), radius, 1, pad_x, pad_y)
	var pressed := _make_box_style(bg_col.darkened(0.12), Color("#F59E0B"), radius, 2, pad_x, pad_y)
	var disabled := _make_box_style(Color(bg_col.r, bg_col.g, bg_col.b, 0.45), Color(border_col.r, border_col.g, border_col.b, 0.3), radius, 1, pad_x, pad_y)
	btn.add_theme_stylebox_override("normal", normal)
	btn.add_theme_stylebox_override("hover", hover)
	btn.add_theme_stylebox_override("pressed", pressed)
	btn.add_theme_stylebox_override("focus", hover)
	btn.add_theme_stylebox_override("disabled", disabled)
	btn.add_theme_color_override("font_color", text_col)
	btn.add_theme_color_override("font_hover_color", Color("#FFFFFF"))
	btn.add_theme_color_override("font_pressed_color", Color("#FFFFFF"))
	btn.add_theme_color_override("font_disabled_color", Color("#64748B"))
	btn.add_theme_font_size_override("font_size", font_size)
	btn.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND

func _make_modal_backdrop(z_idx: int = 20) -> Array:
	var backdrop := ColorRect.new()
	backdrop.set_anchors_preset(Control.PRESET_FULL_RECT)
	backdrop.color = Color(0.02, 0.03, 0.06, 0.72)
	backdrop.mouse_filter = Control.MOUSE_FILTER_STOP
	backdrop.visible = false
	backdrop.z_index = z_idx
	_root.add_child(backdrop)

	var center := CenterContainer.new()
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	center.mouse_filter = Control.MOUSE_FILTER_PASS
	backdrop.add_child(center)
	return [backdrop, center]

# ============================================================================
# ROOT UI TREE CONSTRUCTION
# ============================================================================
func _build_ui_tree() -> void:
	_root = Control.new()
	_root.set_anchors_preset(Control.PRESET_FULL_RECT)
	_root.mouse_filter = Control.MOUSE_FILTER_PASS
	add_child(_root)

	_build_playing_hud()
	_build_title_menu()
	_build_pause_modal()
	_build_build_menu_modal()
	_build_machine_inspector_modal()
	_build_belt_inspector_modal()
	_build_saveload_modal()
	_build_settings_modal()

# ============================================================================
# 1. WIDESCREEN LEFT-DOCKED MAIN MENU (1:1 Port of MainMenu.tsx)
# ============================================================================
func _build_title_menu() -> void:
	_title_layer = Control.new()
	_title_layer.set_anchors_preset(Control.PRESET_FULL_RECT)
	_title_layer.mouse_filter = Control.MOUSE_FILTER_STOP
	_root.add_child(_title_layer)

	var bg_tint := ColorRect.new()
	bg_tint.set_anchors_preset(Control.PRESET_FULL_RECT)
	bg_tint.color = Color(0.02, 0.04, 0.08, 0.55)
	bg_tint.mouse_filter = Control.MOUSE_FILTER_PASS
	_title_layer.add_child(bg_tint)

	var margin := MarginContainer.new()
	margin.set_anchors_preset(Control.PRESET_FULL_RECT)
	margin.add_theme_constant_override("margin_left", 40)
	margin.add_theme_constant_override("margin_right", 40)
	margin.add_theme_constant_override("margin_top", 24)
	margin.add_theme_constant_override("margin_bottom", 24)
	_title_layer.add_child(margin)

	var hbox := HBoxContainer.new()
	hbox.alignment = BoxContainer.ALIGNMENT_BEGIN
	margin.add_child(hbox)

	var vcenter := VBoxContainer.new()
	vcenter.alignment = BoxContainer.ALIGNMENT_CENTER
	hbox.add_child(vcenter)

	var card := PanelContainer.new()
	card.custom_minimum_size = Vector2(460, 0)
	card.add_theme_stylebox_override("panel", _make_box_style(Color(0.043, 0.059, 0.090, 0.94), Color("#26334D"), 18, 1, 22, 20))
	vcenter.add_child(card)

	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 14)
	card.add_child(vbox)

	# Brand Header Row
	var brand_row := HBoxContainer.new()
	brand_row.add_theme_constant_override("separation", 14)
	vbox.add_child(brand_row)

	var logo_panel := PanelContainer.new()
	logo_panel.custom_minimum_size = Vector2(48, 48)
	logo_panel.add_theme_stylebox_override("panel", _make_box_style(Color("#F59E0B"), Color("#FDE68A"), 12, 1, 8, 8))
	brand_row.add_child(logo_panel)

	var logo_tex := TextureRect.new()
	logo_tex.texture = Catalog.get_building_texture("the_hub")
	logo_tex.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	logo_tex.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	logo_panel.add_child(logo_tex)

	var brand_text_vbox := VBoxContainer.new()
	brand_text_vbox.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	brand_text_vbox.add_theme_constant_override("separation", 2)
	brand_row.add_child(brand_text_vbox)

	var sub_tag := Label.new()
	sub_tag.text = "PIONEER LOGISTICS TERMINAL"
	sub_tag.add_theme_font_size_override("font_size", 10)
	sub_tag.add_theme_color_override("font_color", Color("#F59E0B"))
	brand_text_vbox.add_child(sub_tag)

	var main_title := Label.new()
	main_title.text = "FICSIT Labs"
	main_title.add_theme_font_size_override("font_size", 24)
	main_title.add_theme_color_override("font_color", Color("#F8FAFC"))
	brand_text_vbox.add_child(main_title)

	var ver_pill := PanelContainer.new()
	ver_pill.add_theme_stylebox_override("panel", _make_box_style(Color("#131B2E"), Color("#26334D"), 8, 1, 10, 4))
	brand_row.add_child(ver_pill)

	var ver_lbl := Label.new()
	ver_lbl.text = "v" + Catalog.APP_VERSION
	ver_lbl.add_theme_font_size_override("font_size", 11)
	ver_lbl.add_theme_color_override("font_color", Color("#94A3B8"))
	ver_pill.add_child(ver_lbl)

	# Active Session Telemetry Strip
	var session_strip := PanelContainer.new()
	session_strip.add_theme_stylebox_override("panel", _make_box_style(Color(0.075, 0.106, 0.180, 0.85), Color(0.149, 0.200, 0.302, 0.85), 12, 1, 14, 10))
	vbox.add_child(session_strip)

	var session_hbox := HBoxContainer.new()
	session_strip.add_child(session_hbox)

	var sess_left := VBoxContainer.new()
	sess_left.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	sess_left.add_theme_constant_override("separation", 2)
	session_hbox.add_child(sess_left)

	var sess_cap := Label.new()
	sess_cap.text = "ACTIVE SECTOR SESSION"
	sess_cap.add_theme_font_size_override("font_size", 9)
	sess_cap.add_theme_color_override("font_color", Color("#94A3B8"))
	sess_left.add_child(sess_cap)

	_title_session_lbl = Label.new()
	_title_session_lbl.text = GameState.session_name
	_title_session_lbl.add_theme_font_size_override("font_size", 14)
	_title_session_lbl.add_theme_color_override("font_color", Color("#F8FAFC"))
	sess_left.add_child(_title_session_lbl)

	_title_stats_lbl = Label.new()
	_title_stats_lbl.text = "4 Nodes · 3 Belts"
	_title_stats_lbl.add_theme_font_size_override("font_size", 11)
	_title_stats_lbl.add_theme_color_override("font_color", Color("#38BDF8"))
	session_hbox.add_child(_title_stats_lbl)

	# Primary Action: Continue Session
	_title_continue_btn = Button.new()
	_title_continue_btn.custom_minimum_size = Vector2(0, 54)
	_title_continue_btn.text = "▶   CONTINUE SESSION"
	_style_button(_title_continue_btn, Color("#F59E0B"), Color("#FDE68A"), Color("#090D16"), 12, 15, 16, 12)
	_title_continue_btn.pressed.connect(func() -> void:
		SynthAudio.play_sfx("click")
		if not GameState.save_slots.is_empty():
			GameState.load_slot_into_active(GameState.save_slots[0], true)
		else:
			GameState.app_mode = "playing"
			GameState.state_changed.emit()
	)
	vbox.add_child(_title_continue_btn)

	_title_continue_sub = Label.new()
	_title_continue_sub.text = "Resume Latest Sector Save"
	_title_continue_sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_title_continue_sub.add_theme_font_size_override("font_size", 11)
	_title_continue_sub.add_theme_color_override("font_color", Color("#94A3B8"))
	vbox.add_child(_title_continue_sub)

	# 2x2 Action Grid (New Game, Load/Save, Settings, Reset Demo)
	var action_grid := GridContainer.new()
	action_grid.columns = 2
	action_grid.add_theme_constant_override("h_separation", 10)
	action_grid.add_theme_constant_override("v_separation", 10)
	vbox.add_child(action_grid)

	var new_game_btn := Button.new()
	new_game_btn.text = "＋  New Game"
	new_game_btn.custom_minimum_size = Vector2(198, 46)
	new_game_btn.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_style_button(new_game_btn, Color("#131B2E"), Color("#26334D"), Color("#F8FAFC"), 12, 13)
	new_game_btn.pressed.connect(func() -> void:
		SynthAudio.play_sfx("click")
		_new_game_input.text = "Rocky Desert Sector 01"
		_new_game_backdrop.visible = true
	)
	action_grid.add_child(new_game_btn)

	var load_save_btn := Button.new()
	load_save_btn.text = "💾  Load / Save"
	load_save_btn.custom_minimum_size = Vector2(198, 46)
	load_save_btn.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_style_button(load_save_btn, Color("#131B2E"), Color("#26334D"), Color("#F8FAFC"), 12, 13)
	load_save_btn.pressed.connect(func() -> void:
		SynthAudio.play_sfx("click")
		_open_saveload_modal()
	)
	action_grid.add_child(load_save_btn)

	var settings_menu_btn := Button.new()
	settings_menu_btn.text = "⚙  Settings"
	settings_menu_btn.custom_minimum_size = Vector2(198, 46)
	settings_menu_btn.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_style_button(settings_menu_btn, Color("#131B2E"), Color("#26334D"), Color("#F8FAFC"), 12, 13)
	settings_menu_btn.pressed.connect(func() -> void:
		SynthAudio.play_sfx("click")
		_open_settings_modal()
	)
	action_grid.add_child(settings_menu_btn)

	var enter_canvas_btn := Button.new()
	enter_canvas_btn.text = "🗺  Inspect Sector"
	enter_canvas_btn.custom_minimum_size = Vector2(198, 46)
	enter_canvas_btn.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_style_button(enter_canvas_btn, Color("#131B2E"), Color("#26334D"), Color("#38BDF8"), 12, 13)
	enter_canvas_btn.pressed.connect(func() -> void:
		SynthAudio.play_sfx("click")
		GameState.app_mode = "playing"
		GameState.state_changed.emit()
	)
	action_grid.add_child(enter_canvas_btn)

	# New Game Prompt Dialog
	var ng_pair: Array = _make_modal_backdrop(35)
	_new_game_backdrop = ng_pair[0]
	var ng_center: CenterContainer = ng_pair[1]

	var ng_panel := PanelContainer.new()
	ng_panel.custom_minimum_size = Vector2(420, 0)
	ng_panel.add_theme_stylebox_override("panel", _make_box_style(Color("#0F1523"), Color("#26334D"), 16, 1, 20, 18))
	ng_center.add_child(ng_panel)

	var ng_vbox := VBoxContainer.new()
	ng_vbox.add_theme_constant_override("separation", 12)
	ng_panel.add_child(ng_vbox)

	var ng_title := Label.new()
	ng_title.text = "Deploy New Factory Sector"
	ng_title.add_theme_font_size_override("font_size", 17)
	ng_title.add_theme_color_override("font_color", Color("#F8FAFC"))
	ng_vbox.add_child(ng_title)

	var ng_sub := Label.new()
	ng_sub.text = "Starts a fresh pioneer sector with a starter Iron Deposit, Miner Mk.1, Smelter, Constructor, and HUB."
	ng_sub.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	ng_sub.add_theme_font_size_override("font_size", 12)
	ng_sub.add_theme_color_override("font_color", Color("#94A3B8"))
	ng_vbox.add_child(ng_sub)

	_new_game_input = LineEdit.new()
	_new_game_input.text = "Rocky Desert Sector 01"
	_new_game_input.custom_minimum_size = Vector2(0, 40)
	_new_game_input.add_theme_stylebox_override("normal", _make_box_style(Color("#090D16"), Color("#26334D"), 10, 1, 12, 8))
	ng_vbox.add_child(_new_game_input)

	var ng_btns := HBoxContainer.new()
	ng_btns.alignment = BoxContainer.ALIGNMENT_END
	ng_btns.add_theme_constant_override("separation", 10)
	ng_vbox.add_child(ng_btns)

	var ng_cancel := Button.new()
	ng_cancel.text = "Cancel"
	ng_cancel.custom_minimum_size = Vector2(96, 40)
	_style_button(ng_cancel, Color("#131B2E"), Color("#26334D"), Color("#CBD5E1"), 10, 13)
	ng_cancel.pressed.connect(func() -> void: _new_game_backdrop.visible = false)
	ng_btns.add_child(ng_cancel)

	var ng_launch := Button.new()
	ng_launch.text = "Launch Sector"
	ng_launch.custom_minimum_size = Vector2(140, 40)
	_style_button(ng_launch, Color("#F59E0B"), Color("#FDE68A"), Color("#090D16"), 10, 13)
	ng_launch.pressed.connect(func() -> void:
		SynthAudio.play_sfx("place")
		_new_game_backdrop.visible = false
		GameState.start_new_session(_new_game_input.text, true)
	)
	ng_btns.add_child(ng_launch)

# ============================================================================
# 2. PLAYING HUD OVERLAY (1:1 Port of App.tsx + SatisfactoryToolbar.tsx)
# ============================================================================
func _build_playing_hud() -> void:
	_hud_layer = Control.new()
	_hud_layer.set_anchors_preset(Control.PRESET_FULL_RECT)
	_hud_layer.mouse_filter = Control.MOUSE_FILTER_PASS
	_root.add_child(_hud_layer)

	# --- TOP-LEFT MENU & SETTINGS BAR ---
	var tl_margin := MarginContainer.new()
	tl_margin.set_anchors_preset(Control.PRESET_TOP_LEFT)
	tl_margin.add_theme_constant_override("margin_left", 14)
	tl_margin.add_theme_constant_override("margin_top", 12)
	_hud_layer.add_child(tl_margin)

	var tl_row := HBoxContainer.new()
	tl_row.add_theme_constant_override("separation", 8)
	tl_margin.add_child(tl_row)

	var menu_btn := Button.new()
	menu_btn.text = "☰  Menu"
	menu_btn.custom_minimum_size = Vector2(92, 42)
	_style_button(menu_btn, Color(0.059, 0.082, 0.137, 0.94), Color("#26334D"), Color("#E2E8F0"), 12, 13)
	menu_btn.pressed.connect(func() -> void:
		SynthAudio.play_sfx("click")
		_pause_session_lbl.text = "Session: " + GameState.session_name
		_pause_backdrop.visible = true
	)
	tl_row.add_child(menu_btn)

	var settings_btn := Button.new()
	settings_btn.text = "⚙  Settings"
	settings_btn.custom_minimum_size = Vector2(106, 42)
	_style_button(settings_btn, Color(0.059, 0.082, 0.137, 0.94), Color("#26334D"), Color("#E2E8F0"), 12, 13)
	settings_btn.pressed.connect(func() -> void:
		SynthAudio.play_sfx("click")
		_open_settings_modal()
	)
	tl_row.add_child(settings_btn)

	# --- TOP-CENTER SATISFACTORY TOOLBAR (Edit, Move, Multi-Select, Corner Dot | Undo, Redo) ---
	var tc_wrap := HBoxContainer.new()
	tc_wrap.set_anchors_preset(Control.PRESET_TOP_WIDE)
	tc_wrap.offset_top = 12
	tc_wrap.offset_bottom = 60
	tc_wrap.alignment = BoxContainer.ALIGNMENT_CENTER
	tc_wrap.mouse_filter = Control.MOUSE_FILTER_PASS
	_hud_layer.add_child(tc_wrap)

	var toolbar_panel := PanelContainer.new()
	toolbar_panel.add_theme_stylebox_override("panel", _make_box_style(Color(0.059, 0.082, 0.137, 0.95), Color("#26334D"), 14, 1, 6, 5))
	tc_wrap.add_child(toolbar_panel)

	var tb_hbox := HBoxContainer.new()
	tb_hbox.add_theme_constant_override("separation", 6)
	toolbar_panel.add_child(tb_hbox)

	var tools: Array[Dictionary] = [
		{"id": "edit", "label": "✎ Edit"},
		{"id": "move", "label": "✥ Move"},
		{"id": "select", "label": "⬚ Select"},
		{"id": "waypoint", "label": "◈ Corner"},
	]
	for t in tools:
		var tid: String = str(t["id"])
		var btn := Button.new()
		btn.text = str(t["label"])
		btn.custom_minimum_size = Vector2(82, 36)
		_style_button(btn, Color("#131B2E"), Color("#26334D"), Color("#CBD5E1"), 10, 12, 10, 6)
		btn.pressed.connect(func() -> void:
			SynthAudio.play_sfx("click")
			GameState.active_tool = tid
			GameState.active_build_id = ""
			_sync_ui_state()
		)
		tb_hbox.add_child(btn)
		_tool_buttons[tid] = btn

	var sep := VSeparator.new()
	tb_hbox.add_child(sep)

	_undo_btn = Button.new()
	_undo_btn.text = "↶ Undo"
	_undo_btn.custom_minimum_size = Vector2(72, 36)
	_style_button(_undo_btn, Color("#131B2E"), Color("#26334D"), Color("#CBD5E1"), 10, 12, 10, 6)
	_undo_btn.pressed.connect(func() -> void: GameState.undo())
	tb_hbox.add_child(_undo_btn)

	_redo_btn = Button.new()
	_redo_btn.text = "↷ Redo"
	_redo_btn.custom_minimum_size = Vector2(72, 36)
	_style_button(_redo_btn, Color("#131B2E"), Color("#26334D"), Color("#CBD5E1"), 10, 12, 10, 6)
	_redo_btn.pressed.connect(func() -> void: GameState.redo())
	tb_hbox.add_child(_redo_btn)

	# --- ACTIVE BUILD PLACEMENT FLOATING BANNER (Under Top Toolbar) ---
	var banner_wrap := HBoxContainer.new()
	banner_wrap.set_anchors_preset(Control.PRESET_TOP_WIDE)
	banner_wrap.offset_top = 66
	banner_wrap.offset_bottom = 108
	banner_wrap.alignment = BoxContainer.ALIGNMENT_CENTER
	banner_wrap.mouse_filter = Control.MOUSE_FILTER_PASS
	_hud_layer.add_child(banner_wrap)

	_active_build_banner = PanelContainer.new()
	_active_build_banner.visible = false
	_active_build_banner.add_theme_stylebox_override("panel", _make_box_style(Color(0.059, 0.082, 0.137, 0.95), Color("#F59E0B"), 12, 1, 14, 6))
	banner_wrap.add_child(_active_build_banner)

	var banner_hbox := HBoxContainer.new()
	banner_hbox.add_theme_constant_override("separation", 12)
	_active_build_banner.add_child(banner_hbox)

	_active_build_lbl = Label.new()
	_active_build_lbl.text = "Placing: Miner Mk.1 (Tap canvas to deploy)"
	_active_build_lbl.add_theme_font_size_override("font_size", 12)
	_active_build_lbl.add_theme_color_override("font_color", Color("#FDE68A"))
	banner_hbox.add_child(_active_build_lbl)

	var done_build_btn := Button.new()
	done_build_btn.text = "Done"
	done_build_btn.custom_minimum_size = Vector2(64, 28)
	_style_button(done_build_btn, Color("#1E293B"), Color("#475569"), Color("#F8FAFC"), 8, 11, 8, 4)
	done_build_btn.pressed.connect(func() -> void:
		SynthAudio.play_sfx("click")
		GameState.active_tool = "edit"
		GameState.active_build_id = ""
		_sync_ui_state()
	)
	banner_hbox.add_child(done_build_btn)

	# --- MULTI-SELECT BATCH ACTION BAR (Bottom-Center) ---
	var ms_wrap := HBoxContainer.new()
	ms_wrap.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	ms_wrap.offset_top = -66
	ms_wrap.offset_bottom = -14
	ms_wrap.alignment = BoxContainer.ALIGNMENT_CENTER
	ms_wrap.mouse_filter = Control.MOUSE_FILTER_PASS
	_hud_layer.add_child(ms_wrap)

	_multi_select_bar = PanelContainer.new()
	_multi_select_bar.visible = false
	_multi_select_bar.add_theme_stylebox_override("panel", _make_box_style(Color(0.059, 0.082, 0.137, 0.96), Color("#38BDF8"), 14, 1, 14, 8))
	ms_wrap.add_child(_multi_select_bar)

	var ms_hbox := HBoxContainer.new()
	ms_hbox.add_theme_constant_override("separation", 10)
	_multi_select_bar.add_child(ms_hbox)

	_multi_select_lbl = Label.new()
	_multi_select_lbl.text = "2 Machines Selected"
	_multi_select_lbl.add_theme_font_size_override("font_size", 12)
	_multi_select_lbl.add_theme_color_override("font_color", Color("#38BDF8"))
	ms_hbox.add_child(_multi_select_lbl)

	var ms_del_btn := Button.new()
	ms_del_btn.text = "🗑 Dismantle Selected"
	ms_del_btn.custom_minimum_size = Vector2(148, 34)
	_style_button(ms_del_btn, Color("#7F1D1D"), Color("#EF4444"), Color("#FECACA"), 10, 12)
	ms_del_btn.pressed.connect(func() -> void:
		GameState.dismantle_nodes(GameState.selected_node_ids)
	)
	ms_hbox.add_child(ms_del_btn)

	var ms_clear_btn := Button.new()
	ms_clear_btn.text = "Clear"
	ms_clear_btn.custom_minimum_size = Vector2(68, 34)
	_style_button(ms_clear_btn, Color("#131B2E"), Color("#26334D"), Color("#CBD5E1"), 10, 12)
	ms_clear_btn.pressed.connect(func() -> void: GameState.clear_selection())
	ms_hbox.add_child(ms_clear_btn)

	# --- BOTTOM-LEFT BELT TIER FLYOUT + SNAP TOGGLE (1:1 Port of SatisfactoryToolbar.tsx) ---
	var bl_vbox := VBoxContainer.new()
	bl_vbox.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	bl_vbox.offset_left = 14
	bl_vbox.offset_right = 460
	bl_vbox.offset_top = -128
	bl_vbox.offset_bottom = -14
	bl_vbox.alignment = BoxContainer.ALIGNMENT_END
	bl_vbox.add_theme_constant_override("separation", 8)
	bl_vbox.mouse_filter = Control.MOUSE_FILTER_PASS
	_hud_layer.add_child(bl_vbox)

	_belt_flyout_panel = PanelContainer.new()
	_belt_flyout_panel.visible = false
	_belt_flyout_panel.add_theme_stylebox_override("panel", _make_box_style(Color(0.059, 0.082, 0.137, 0.96), Color("#26334D"), 14, 1, 8, 8))
	bl_vbox.add_child(_belt_flyout_panel)

	var flyout_hbox := HBoxContainer.new()
	flyout_hbox.add_theme_constant_override("separation", 6)
	_belt_flyout_panel.add_child(flyout_hbox)

	for tier_num in range(1, 7):
		var t_def: Dictionary = Catalog.CONVEYOR_BELT_TIERS[tier_num]
		var t_btn := Button.new()
		t_btn.text = "%s\n%d/m" % [str(t_def["shortLabel"]), int(t_def["capacityPerMin"])]
		t_btn.custom_minimum_size = Vector2(62, 46)
		_style_button(t_btn, Color("#131B2E"), Color("#26334D"), Color("#E2E8F0"), 10, 11, 6, 4)
		var captured_t: int = tier_num
		t_btn.pressed.connect(func() -> void:
			SynthAudio.play_sfx("click")
			GameState.active_belt_tier = captured_t
			_belt_flyout_panel.visible = false
			_sync_ui_state()
		)
		flyout_hbox.add_child(t_btn)
		_belt_tier_buttons[tier_num] = t_btn

	var bl_bar := PanelContainer.new()
	bl_bar.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
	bl_bar.add_theme_stylebox_override("panel", _make_box_style(Color(0.059, 0.082, 0.137, 0.94), Color("#26334D"), 14, 1, 8, 6))
	bl_vbox.add_child(bl_bar)

	var bl_row := HBoxContainer.new()
	bl_row.add_theme_constant_override("separation", 8)
	bl_bar.add_child(bl_row)

	_belt_tier_btn = Button.new()
	_belt_tier_btn.text = "Belt: Mk.1 ▴"
	_belt_tier_btn.custom_minimum_size = Vector2(118, 36)
	_style_button(_belt_tier_btn, Color("#131B2E"), Color("#26334D"), Color("#E2E8F0"), 10, 12)
	_belt_tier_btn.pressed.connect(func() -> void:
		SynthAudio.play_sfx("click")
		_belt_flyout_panel.visible = not _belt_flyout_panel.visible
	)
	bl_row.add_child(_belt_tier_btn)

	_snap_btn = Button.new()
	_snap_btn.text = "Snap: ON"
	_snap_btn.custom_minimum_size = Vector2(102, 36)
	_style_button(_snap_btn, Color("#083344"), Color("#38BDF8"), Color("#38BDF8"), 10, 12)
	_snap_btn.pressed.connect(func() -> void:
		SynthAudio.play_sfx("click")
		GameState.settings["snapToGrid"] = not bool(GameState.settings.get("snapToGrid", true))
		GameState.save_settings_to_disk()
		_sync_ui_state()
	)
	bl_row.add_child(_snap_btn)

	# --- BOTTOM-RIGHT BUILD BUTTON ---
	var br_margin := MarginContainer.new()
	br_margin.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	br_margin.offset_left = -140
	br_margin.offset_right = -14
	br_margin.offset_top = -66
	br_margin.offset_bottom = -14
	_hud_layer.add_child(br_margin)

	_build_hud_btn = Button.new()
	_build_hud_btn.text = "⚒  build"
	_build_hud_btn.custom_minimum_size = Vector2(120, 48)
	_style_button(_build_hud_btn, Color("#131B2E"), Color("#F59E0B"), Color("#F59E0B"), 14, 15, 16, 10)
	_build_hud_btn.pressed.connect(func() -> void:
		SynthAudio.play_sfx("click")
		_open_build_menu_modal()
	)
	br_margin.add_child(_build_hud_btn)

# ============================================================================
# 3. PAUSE MENU MODAL (1:1 Port of App.tsx Pause Overlay)
# ============================================================================
func _build_pause_modal() -> void:
	var pair: Array = _make_modal_backdrop(28)
	_pause_backdrop = pair[0]
	var center: CenterContainer = pair[1]

	var panel := PanelContainer.new()
	panel.custom_minimum_size = Vector2(360, 0)
	panel.add_theme_stylebox_override("panel", _make_box_style(Color("#0F1523"), Color("#26334D"), 16, 1, 22, 20))
	center.add_child(panel)

	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 10)
	panel.add_child(vbox)

	var cap := Label.new()
	cap.text = "PAUSED"
	cap.add_theme_font_size_override("font_size", 10)
	cap.add_theme_color_override("font_color", Color("#F59E0B"))
	vbox.add_child(cap)

	var title := Label.new()
	title.text = "FICSIT Command Menu"
	title.add_theme_font_size_override("font_size", 18)
	title.add_theme_color_override("font_color", Color("#F8FAFC"))
	vbox.add_child(title)

	_pause_session_lbl = Label.new()
	_pause_session_lbl.text = "Session: Rocky Desert Sector 01"
	_pause_session_lbl.add_theme_font_size_override("font_size", 12)
	_pause_session_lbl.add_theme_color_override("font_color", Color("#94A3B8"))
	vbox.add_child(_pause_session_lbl)

	var resume_btn := Button.new()
	resume_btn.text = "Resume Factory"
	resume_btn.custom_minimum_size = Vector2(0, 44)
	_style_button(resume_btn, Color("#F59E0B"), Color("#FDE68A"), Color("#090D16"), 12, 14)
	resume_btn.pressed.connect(func() -> void:
		SynthAudio.play_sfx("click")
		_pause_backdrop.visible = false
	)
	vbox.add_child(resume_btn)

	var sl_btn := Button.new()
	sl_btn.text = "Save / Load Session"
	sl_btn.custom_minimum_size = Vector2(0, 42)
	_style_button(sl_btn, Color("#131B2E"), Color("#26334D"), Color("#E2E8F0"), 12, 13)
	sl_btn.pressed.connect(func() -> void:
		SynthAudio.play_sfx("click")
		_pause_backdrop.visible = false
		_open_saveload_modal()
	)
	vbox.add_child(sl_btn)

	var set_btn := Button.new()
	set_btn.text = "Settings"
	set_btn.custom_minimum_size = Vector2(0, 42)
	_style_button(set_btn, Color("#131B2E"), Color("#26334D"), Color("#E2E8F0"), 12, 13)
	set_btn.pressed.connect(func() -> void:
		SynthAudio.play_sfx("click")
		_pause_backdrop.visible = false
		_open_settings_modal()
	)
	vbox.add_child(set_btn)

	var exit_btn := Button.new()
	exit_btn.text = "Save & Exit to Main Menu"
	exit_btn.custom_minimum_size = Vector2(0, 42)
	_style_button(exit_btn, Color("#1E1B2E"), Color("#F59E0B"), Color("#FDE68A"), 12, 13)
	exit_btn.pressed.connect(func() -> void:
		SynthAudio.play_sfx("save")
		GameState.upsert_autosave()
		_pause_backdrop.visible = false
		GameState.app_mode = "title"
		GameState.state_changed.emit()
	)
	vbox.add_child(exit_btn)

# ============================================================================
# 4. 12-COLUMN SATISFACTORY BUILD MENU MODAL (1:1 Port of BuildMenuModal.tsx)
# ============================================================================
func _build_build_menu_modal() -> void:
	var pair: Array = _make_modal_backdrop(24)
	_build_backdrop = pair[0]
	var center: CenterContainer = pair[1]

	var modal := PanelContainer.new()
	modal.custom_minimum_size = Vector2(880, 500)
	modal.add_theme_stylebox_override("panel", _make_box_style(Color("#0F1523"), Color("#26334D"), 16, 1, 0, 0))
	center.add_child(modal)

	var outer_vbox := VBoxContainer.new()
	outer_vbox.add_theme_constant_override("separation", 0)
	modal.add_child(outer_vbox)

	# Top Category Bar
	var top_bar := PanelContainer.new()
	top_bar.add_theme_stylebox_override("panel", _make_box_style(Color("#131B2E"), Color("#26334D"), 0, 1, 16, 10))
	outer_vbox.add_child(top_bar)

	var top_hbox := HBoxContainer.new()
	top_hbox.add_theme_constant_override("separation", 8)
	top_bar.add_child(top_hbox)

	for cat in Catalog.BUILD_CATEGORIES:
		var cid: String = str(cat["id"])
		var cbtn := Button.new()
		cbtn.text = str(cat["label"]).to_upper()
		cbtn.custom_minimum_size = Vector2(118, 36)
		var captured_cid: String = cid
		cbtn.pressed.connect(func() -> void:
			SynthAudio.play_sfx("click")
			_build_active_cat = captured_cid
			_refresh_build_menu_contents()
		)
		top_hbox.add_child(cbtn)
		_build_cat_buttons[cid] = cbtn

	var spacer := Control.new()
	spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	top_hbox.add_child(spacer)

	var close_btn := Button.new()
	close_btn.text = "✕"
	close_btn.custom_minimum_size = Vector2(40, 36)
	_style_button(close_btn, Color("#1C2742"), Color("#2E3E5C"), Color("#CBD5E1"), 8, 14)
	close_btn.pressed.connect(func() -> void:
		SynthAudio.play_sfx("click")
		_build_backdrop.visible = false
	)
	top_hbox.add_child(close_btn)

	# Body Split: Left Catalog Scroll + Right Blueprint Inspector
	var body_hbox := HBoxContainer.new()
	body_hbox.size_flags_vertical = Control.SIZE_EXPAND_FILL
	body_hbox.add_theme_constant_override("separation", 0)
	outer_vbox.add_child(body_hbox)

	var left_scroll := ScrollContainer.new()
	left_scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	left_scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	body_hbox.add_child(left_scroll)

	var left_pad := MarginContainer.new()
	left_pad.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	left_pad.add_theme_constant_override("margin_left", 16)
	left_pad.add_theme_constant_override("margin_right", 16)
	left_pad.add_theme_constant_override("margin_top", 14)
	left_pad.add_theme_constant_override("margin_bottom", 14)
	left_scroll.add_child(left_pad)

	_build_cards_vbox = VBoxContainer.new()
	_build_cards_vbox.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_build_cards_vbox.add_theme_constant_override("separation", 10)
	left_pad.add_child(_build_cards_vbox)

	# Right Blueprint Inspector Sidebar (300px)
	var right_panel := PanelContainer.new()
	right_panel.custom_minimum_size = Vector2(300, 0)
	right_panel.add_theme_stylebox_override("panel", _make_box_style(Color("#0B0F19"), Color("#26334D"), 0, 1, 18, 18))
	body_hbox.add_child(right_panel)

	var right_vbox := VBoxContainer.new()
	right_vbox.add_theme_constant_override("separation", 12)
	right_panel.add_child(right_vbox)

	var insp_top := HBoxContainer.new()
	insp_top.add_theme_constant_override("separation", 12)
	right_vbox.add_child(insp_top)

	_build_insp_icon = TextureRect.new()
	_build_insp_icon.custom_minimum_size = Vector2(56, 56)
	_build_insp_icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_build_insp_icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	insp_top.add_child(_build_insp_icon)

	var insp_titles := VBoxContainer.new()
	insp_titles.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	insp_top.add_child(insp_titles)

	_build_insp_sub = Label.new()
	_build_insp_sub.text = "EXTRACTORS"
	_build_insp_sub.add_theme_font_size_override("font_size", 10)
	_build_insp_sub.add_theme_color_override("font_color", Color("#F59E0B"))
	insp_titles.add_child(_build_insp_sub)

	_build_insp_title = Label.new()
	_build_insp_title.text = "Miner Mk.1"
	_build_insp_title.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_build_insp_title.add_theme_font_size_override("font_size", 16)
	_build_insp_title.add_theme_color_override("font_color", Color("#F8FAFC"))
	insp_titles.add_child(_build_insp_title)

	_build_insp_desc = Label.new()
	_build_insp_desc.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_build_insp_desc.add_theme_font_size_override("font_size", 12)
	_build_insp_desc.add_theme_color_override("font_color", Color("#94A3B8"))
	right_vbox.add_child(_build_insp_desc)

	var metrics_box := PanelContainer.new()
	metrics_box.add_theme_stylebox_override("panel", _make_box_style(Color("#131B2E"), Color("#1E293B"), 10, 1, 12, 10))
	right_vbox.add_child(metrics_box)

	_build_insp_metrics = Label.new()
	_build_insp_metrics.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_build_insp_metrics.add_theme_font_size_override("font_size", 12)
	_build_insp_metrics.add_theme_color_override("font_color", Color("#38BDF8"))
	metrics_box.add_child(_build_insp_metrics)

	var r_spacer := Control.new()
	r_spacer.size_flags_vertical = Control.SIZE_EXPAND_FILL
	right_vbox.add_child(r_spacer)

	_build_deploy_btn = Button.new()
	_build_deploy_btn.text = "Select Blueprint"
	_build_deploy_btn.custom_minimum_size = Vector2(0, 46)
	_style_button(_build_deploy_btn, Color("#F59E0B"), Color("#FDE68A"), Color("#090D16"), 12, 14)
	_build_deploy_btn.pressed.connect(_on_confirm_build_selection)
	right_vbox.add_child(_build_deploy_btn)

func _open_build_menu_modal() -> void:
	_refresh_build_menu_contents()
	_build_backdrop.visible = true

func _refresh_build_menu_contents() -> void:
	for cid in _build_cat_buttons.keys():
		var btn: Button = _build_cat_buttons[cid]
		if cid == _build_active_cat:
			_style_button(btn, Color("#F59E0B"), Color("#FDE68A"), Color("#090D16"), 10, 12)
		else:
			_style_button(btn, Color("#1C2742"), Color("#2E3E5C"), Color("#CBD5E1"), 10, 12)

	for child in _build_cards_vbox.get_children():
		child.queue_free()

	var grid := GridContainer.new()
	grid.columns = 2
	grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	grid.add_theme_constant_override("h_separation", 10)
	grid.add_theme_constant_override("v_separation", 10)
	_build_cards_vbox.add_child(grid)

	# Conveyor Belt Tiers in Logistics tab
	if _build_active_cat == "logistics":
		for tier_num in range(1, 7):
			var t_def: Dictionary = Catalog.CONVEYOR_BELT_TIERS[tier_num]
			var tid: String = "belt_tier_%d" % tier_num
			var is_sel: bool = (_build_selected_id == tid)
			var btn := Button.new()
			btn.text = "%s\n%d items/min" % [str(t_def["name"]), int(t_def["capacityPerMin"])]
			btn.icon = Catalog.get_cached_texture(str(t_def["iconPath"]))
			btn.expand_icon = true
			btn.custom_minimum_size = Vector2(250, 68)
			btn.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			_style_button(btn, Color("#1C2742") if is_sel else Color("#131B2E"), Color("#F59E0B") if is_sel else Color("#26334D"), Color("#F8FAFC"), 12, 12)
			var captured_tid: String = tid
			btn.pressed.connect(func() -> void:
				SynthAudio.play_sfx("click")
				_build_selected_id = captured_tid
				_refresh_build_menu_contents()
			)
			grid.add_child(btn)

	for b_id in Catalog.BUILDINGS.keys():
		var b_def: Dictionary = Catalog.BUILDINGS[b_id]
		if not bool(b_def.get("buildable", true)):
			continue
		if str(b_def.get("category", "")) != _build_active_cat:
			continue
		var is_sel: bool = (_build_selected_id == str(b_id))
		var btn := Button.new()
		btn.text = "%s\n%s" % [str(b_def["name"]), str(b_def.get("subcategory", ""))]
		btn.icon = Catalog.get_building_texture(str(b_id))
		btn.expand_icon = true
		btn.custom_minimum_size = Vector2(250, 68)
		btn.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		_style_button(btn, Color("#1C2742") if is_sel else Color("#131B2E"), Color("#F59E0B") if is_sel else Color("#26334D"), Color("#F8FAFC"), 12, 12)
		var captured_bid: String = str(b_id)
		btn.pressed.connect(func() -> void:
			SynthAudio.play_sfx("click")
			_build_selected_id = captured_bid
			_refresh_build_menu_contents()
		)
		grid.add_child(btn)

	# Update Right Blueprint Inspector
	if _build_selected_id.begins_with("belt_tier_"):
		var t_num: int = int(_build_selected_id.replace("belt_tier_", ""))
		var t_def: Dictionary = Catalog.CONVEYOR_BELT_TIERS.get(t_num, Catalog.CONVEYOR_BELT_TIERS[1])
		_build_insp_icon.texture = Catalog.get_cached_texture(str(t_def["iconPath"]))
		_build_insp_sub.text = "CONVEYOR BELTS"
		_build_insp_title.text = str(t_def["name"])
		_build_insp_desc.text = "Transports up to %d items/min between machine ports. Standard Part: %s." % [int(t_def["capacityPerMin"]), str(t_def["ingredientName"])]
		_build_insp_metrics.text = "Max Throughput: %d / min\nBelt Speed: %.1f m/s" % [int(t_def["capacityPerMin"]), float(t_def["speedMetersPerSec"])]
		_build_deploy_btn.text = "Equip %s" % str(t_def["shortLabel"])
	else:
		var b_def: Dictionary = Catalog.BUILDINGS.get(_build_selected_id, Catalog.BUILDINGS["miner_mk1"])
		_build_insp_icon.texture = Catalog.get_building_texture(str(b_def["id"]))
		_build_insp_sub.text = str(b_def.get("subcategory", "PRODUCTION")).to_upper()
		_build_insp_title.text = str(b_def.get("name", "Machine"))
		_build_insp_desc.text = str(b_def.get("description", ""))
		_build_insp_metrics.text = "Power Draw: %.1f MW\nPorts: %d In → %d Out" % [float(b_def.get("powerMw", 0.0)), int(b_def.get("inputPortCount", 0)), int(b_def.get("outputPortCount", 0))]
		_build_deploy_btn.text = "Deploy " + str(b_def.get("name", "Machine"))

func _on_confirm_build_selection() -> void:
	SynthAudio.play_sfx("click")
	if _build_selected_id.begins_with("belt_tier_"):
		var t_num: int = int(_build_selected_id.replace("belt_tier_", ""))
		GameState.active_belt_tier = clampi(t_num, 1, 6)
		GameState.active_tool = "edit"
		GameState.active_build_id = ""
	else:
		GameState.active_tool = "build"
		GameState.active_build_id = _build_selected_id
	_build_backdrop.visible = false
	_sync_ui_state()

# ============================================================================
# 5. AUTHENTIC SATISFACTORY DUAL-PANEL MACHINE INSPECTOR + PIONEER INVENTORY
#    (1:1 Port of NodeInspectorPanel.tsx, MachineOverclockSection.tsx, PioneerInventoryPanel.tsx)
# ============================================================================
func _build_machine_inspector_modal() -> void:
	var pair: Array = _make_modal_backdrop(26)
	_inspector_backdrop = pair[0]
	var center: CenterContainer = pair[1]

	var modal := PanelContainer.new()
	modal.custom_minimum_size = Vector2(920, 560)
	modal.add_theme_stylebox_override("panel", _make_box_style(Color(0.08, 0.09, 0.11, 0.92), Color("#3D424B"), 8, 1, 10, 10))
	center.add_child(modal)

	var hsplit := HBoxContainer.new()
	hsplit.add_theme_constant_override("separation", 10)
	modal.add_child(hsplit)

	# ========================================================================
	# LEFT COLUMN: MACHINE INSPECTOR WINDOW (530px wide)
	# ========================================================================
	var left_win := PanelContainer.new()
	left_win.custom_minimum_size = Vector2(530, 540)
	left_win.add_theme_stylebox_override("panel", _make_box_style(Color("#202125"), Color("#3E4046"), 4, 1, 0, 0))
	hsplit.add_child(left_win)

	var left_vbox := VBoxContainer.new()
	left_vbox.add_theme_constant_override("separation", 0)
	left_win.add_child(left_vbox)

	# Top Title Bar + Tabs + Dismantle + Close 'X'
	var title_bar := PanelContainer.new()
	title_bar.add_theme_stylebox_override("panel", _make_box_style(Color("#1A1B1E"), Color("#DF8A2E"), 0, 1, 12, 6))
	left_vbox.add_child(title_bar)

	var thbox := HBoxContainer.new()
	thbox.add_theme_constant_override("separation", 8)
	title_bar.add_child(thbox)

	_insp_title_lbl = Label.new()
	_insp_title_lbl.text = "Miner Mk.1"
	_insp_title_lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_insp_title_lbl.add_theme_font_size_override("font_size", 15)
	_insp_title_lbl.add_theme_color_override("font_color", Color("#FFFFFF"))
	thbox.add_child(_insp_title_lbl)

	_insp_tab_prod_btn = Button.new()
	_insp_tab_prod_btn.text = "Production"
	_insp_tab_prod_btn.custom_minimum_size = Vector2(88, 28)
	_insp_tab_prod_btn.pressed.connect(func() -> void:
		SynthAudio.play_sfx("click")
		_insp_active_tab = "production"
		_refresh_live_inspector_telemetry()
	)
	thbox.add_child(_insp_tab_prod_btn)

	_insp_tab_rec_btn = Button.new()
	_insp_tab_rec_btn.text = "Select Recipe"
	_insp_tab_rec_btn.custom_minimum_size = Vector2(104, 28)
	_insp_tab_rec_btn.pressed.connect(func() -> void:
		SynthAudio.play_sfx("click")
		_insp_active_tab = "recipe"
		_refresh_live_inspector_telemetry()
	)
	thbox.add_child(_insp_tab_rec_btn)

	var dis_btn := Button.new()
	dis_btn.text = "🗑"
	dis_btn.tooltip_text = "Dismantle Machine"
	dis_btn.custom_minimum_size = Vector2(34, 28)
	_style_button(dis_btn, Color("#3F1D24"), Color("#EF4444"), Color("#FCA5A5"), 4, 13, 6, 2)
	dis_btn.pressed.connect(func() -> void:
		if not GameState.selected_node_id.is_empty():
			GameState.dismantle_nodes([GameState.selected_node_id])
			_inspector_backdrop.visible = false
	)
	thbox.add_child(dis_btn)

	var close_btn := Button.new()
	close_btn.text = "✕"
	close_btn.custom_minimum_size = Vector2(34, 28)
	_style_button(close_btn, Color("#2A2C32"), Color("#DF8A2E"), Color("#FFFFFF"), 4, 13, 6, 2)
	close_btn.pressed.connect(func() -> void:
		SynthAudio.play_sfx("click")
		_inspector_backdrop.visible = false
	)
	thbox.add_child(close_btn)

	# Recipe Browser View (When "Select Recipe" tab is active)
	_insp_recipe_scroll = ScrollContainer.new()
	_insp_recipe_scroll.visible = false
	_insp_recipe_scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	left_vbox.add_child(_insp_recipe_scroll)

	var rec_pad := MarginContainer.new()
	rec_pad.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	rec_pad.add_theme_constant_override("margin_left", 16)
	rec_pad.add_theme_constant_override("margin_right", 16)
	rec_pad.add_theme_constant_override("margin_top", 14)
	rec_pad.add_theme_constant_override("margin_bottom", 14)
	_insp_recipe_scroll.add_child(rec_pad)

	_insp_recipe_list = VBoxContainer.new()
	_insp_recipe_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_insp_recipe_list.add_theme_constant_override("separation", 8)
	rec_pad.add_child(_insp_recipe_list)

	# Production View: Top Bay Plate (530x310) + Lower Overclock Plate (530x185)
	_insp_prod_view = VBoxContainer.new()
	_insp_prod_view.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_insp_prod_view.add_theme_constant_override("separation", 0)
	left_vbox.add_child(_insp_prod_view)

	_insp_top_plate = TextureRect.new()
	_insp_top_plate.custom_minimum_size = Vector2(530, 310)
	_insp_top_plate.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_insp_top_plate.stretch_mode = TextureRect.STRETCH_SCALE
	_insp_prod_view.add_child(_insp_top_plate)

	# --- MINER TOP BAY OVERLAY (Matches NodeInspectorPanel.tsx lines 455-559) ---
	_insp_miner_overlay = Control.new()
	_insp_miner_overlay.set_anchors_preset(Control.PRESET_FULL_RECT)
	_insp_top_plate.add_child(_insp_miner_overlay)

	# Miner Ore Icon Slot (left=44.6%, top=18.2%, w=10.8%, h=15.6%)
	var m_slot := Panel.new()
	m_slot.anchor_left = 0.446
	m_slot.anchor_top = 0.182
	m_slot.anchor_right = 0.554
	m_slot.anchor_bottom = 0.338
	m_slot.add_theme_stylebox_override("panel", _make_box_style(Color("#3C3E44"), Color("#787A80"), 2, 1, 2, 2))
	_insp_miner_overlay.add_child(m_slot)

	_insp_miner_ore_icon = TextureRect.new()
	_insp_miner_ore_icon.set_anchors_preset(Control.PRESET_FULL_RECT)
	_insp_miner_ore_icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_insp_miner_ore_icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	m_slot.add_child(_insp_miner_ore_icon)

	_insp_miner_ore_badge = Label.new()
	_insp_miner_ore_badge.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	_insp_miner_ore_badge.offset_left = -24
	_insp_miner_ore_badge.offset_top = -14
	_insp_miner_ore_badge.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	_insp_miner_ore_badge.add_theme_font_size_override("font_size", 10)
	_insp_miner_ore_badge.add_theme_color_override("font_color", Color("#DF8A2E"))
	m_slot.add_child(_insp_miner_ore_badge)

	_insp_miner_ore_title = Label.new()
	_insp_miner_ore_title.anchor_left = 0.25
	_insp_miner_ore_title.anchor_top = 0.35
	_insp_miner_ore_title.anchor_right = 0.75
	_insp_miner_ore_title.anchor_bottom = 0.42
	_insp_miner_ore_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_insp_miner_ore_title.add_theme_font_size_override("font_size", 11)
	_insp_miner_ore_title.add_theme_color_override("font_color", Color("#FFFFFF"))
	_insp_miner_overlay.add_child(_insp_miner_ore_title)

	_insp_miner_ore_rate = Label.new()
	_insp_miner_ore_rate.anchor_left = 0.25
	_insp_miner_ore_rate.anchor_top = 0.41
	_insp_miner_ore_rate.anchor_right = 0.75
	_insp_miner_ore_rate.anchor_bottom = 0.48
	_insp_miner_ore_rate.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_insp_miner_ore_rate.add_theme_font_size_override("font_size", 10)
	_insp_miner_ore_rate.add_theme_color_override("font_color", Color("#DF8A2E"))
	_insp_miner_overlay.add_child(_insp_miner_ore_rate)

	var m_prog_bg := ColorRect.new()
	m_prog_bg.anchor_left = 0.33
	m_prog_bg.anchor_top = 0.50
	m_prog_bg.anchor_right = 0.67
	m_prog_bg.anchor_bottom = 0.535
	m_prog_bg.color = Color("#73757A")
	_insp_miner_overlay.add_child(m_prog_bg)

	_insp_miner_prog_bar = ColorRect.new()
	_insp_miner_prog_bar.anchor_left = 0.0
	_insp_miner_prog_bar.anchor_top = 0.0
	_insp_miner_prog_bar.anchor_right = 0.5
	_insp_miner_prog_bar.anchor_bottom = 1.0
	_insp_miner_prog_bar.color = Color("#DF8A2E")
	m_prog_bg.add_child(_insp_miner_prog_bar)

	_insp_miner_status_lbl = Label.new()
	_insp_miner_status_lbl.anchor_left = 0.30
	_insp_miner_status_lbl.anchor_top = 0.545
	_insp_miner_status_lbl.anchor_right = 0.70
	_insp_miner_status_lbl.anchor_bottom = 0.61
	_insp_miner_status_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_insp_miner_status_lbl.add_theme_font_size_override("font_size", 10)
	_insp_miner_status_lbl.add_theme_color_override("font_color", Color("#D4D5D8"))
	_insp_miner_overlay.add_child(_insp_miner_status_lbl)

	var m_stats_row := HBoxContainer.new()
	m_stats_row.anchor_left = 0.32
	m_stats_row.anchor_top = 0.63
	m_stats_row.anchor_right = 0.68
	m_stats_row.anchor_bottom = 0.72
	m_stats_row.alignment = BoxContainer.ALIGNMENT_CENTER
	m_stats_row.add_theme_constant_override("separation", 14)
	_insp_miner_overlay.add_child(m_stats_row)

	_insp_miner_mw_lbl = Label.new()
	_insp_miner_mw_lbl.add_theme_font_size_override("font_size", 10)
	_insp_miner_mw_lbl.add_theme_color_override("font_color", Color("#DF8A2E"))
	m_stats_row.add_child(_insp_miner_mw_lbl)

	_insp_miner_sec_lbl = Label.new()
	_insp_miner_sec_lbl.add_theme_font_size_override("font_size", 10)
	_insp_miner_sec_lbl.add_theme_color_override("font_color", Color("#DF8A2E"))
	m_stats_row.add_child(_insp_miner_sec_lbl)

	_insp_miner_eff_lbl = Label.new()
	_insp_miner_eff_lbl.add_theme_font_size_override("font_size", 10)
	_insp_miner_eff_lbl.add_theme_color_override("font_color", Color("#DF8A2E"))
	m_stats_row.add_child(_insp_miner_eff_lbl)

	# --- PROCESSOR TOP BAY OVERLAY (Matches NodeInspectorPanel.tsx lines 564-759) ---
	_insp_proc_overlay = Control.new()
	_insp_proc_overlay.set_anchors_preset(Control.PRESET_FULL_RECT)
	_insp_top_plate.add_child(_insp_proc_overlay)

	_insp_proc_recipe_btn = Button.new()
	_insp_proc_recipe_btn.anchor_left = 0.018
	_insp_proc_recipe_btn.anchor_top = 0.022
	_insp_proc_recipe_btn.anchor_right = 0.982
	_insp_proc_recipe_btn.anchor_bottom = 0.128
	_insp_proc_recipe_btn.flat = true
	_insp_proc_recipe_btn.add_theme_font_size_override("font_size", 13)
	_insp_proc_recipe_btn.add_theme_color_override("font_color", Color("#FFFFFF"))
	_insp_proc_recipe_btn.pressed.connect(func() -> void:
		SynthAudio.play_sfx("click")
		_insp_active_tab = "recipe"
		_refresh_live_inspector_telemetry()
	)
	_insp_proc_overlay.add_child(_insp_proc_recipe_btn)

	# Left White INPUT Card Interior (left=2.6%, top=17.5%, w=35.5%, h=71.8%)
	_insp_proc_inputs_vbox = VBoxContainer.new()
	_insp_proc_inputs_vbox.anchor_left = 0.035
	_insp_proc_inputs_vbox.anchor_top = 0.20
	_insp_proc_inputs_vbox.anchor_right = 0.375
	_insp_proc_inputs_vbox.anchor_bottom = 0.88
	_insp_proc_inputs_vbox.alignment = BoxContainer.ALIGNMENT_CENTER
	_insp_proc_inputs_vbox.add_theme_constant_override("separation", 10)
	_insp_proc_overlay.add_child(_insp_proc_inputs_vbox)

	# Center Monitor Screen Interior (left=43.0%, top=23.5%, w=14.6%, h=57.5%)
	var p_mon := VBoxContainer.new()
	p_mon.anchor_left = 0.430
	p_mon.anchor_top = 0.235
	p_mon.anchor_right = 0.576
	p_mon.anchor_bottom = 0.810
	p_mon.alignment = BoxContainer.ALIGNMENT_CENTER
	p_mon.add_theme_constant_override("separation", 6)
	_insp_proc_overlay.add_child(p_mon)

	_insp_proc_out_icon = TextureRect.new()
	_insp_proc_out_icon.custom_minimum_size = Vector2(38, 38)
	_insp_proc_out_icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_insp_proc_out_icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	p_mon.add_child(_insp_proc_out_icon)

	var p_prog_bg := ColorRect.new()
	p_prog_bg.custom_minimum_size = Vector2(0, 10)
	p_prog_bg.color = Color("#73757A")
	p_mon.add_child(p_prog_bg)

	_insp_proc_prog_bar = ColorRect.new()
	_insp_proc_prog_bar.set_anchors_preset(Control.PRESET_LEFT_WIDE)
	_insp_proc_prog_bar.anchor_right = 0.5
	_insp_proc_prog_bar.color = Color("#DF8A2E")
	p_prog_bg.add_child(_insp_proc_prog_bar)

	_insp_proc_status_lbl = Label.new()
	_insp_proc_status_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_insp_proc_status_lbl.add_theme_font_size_override("font_size", 9)
	_insp_proc_status_lbl.add_theme_color_override("font_color", Color("#D4D5D8"))
	p_mon.add_child(_insp_proc_status_lbl)

	_insp_proc_mw_lbl = Label.new()
	_insp_proc_mw_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_insp_proc_mw_lbl.add_theme_font_size_override("font_size", 10)
	_insp_proc_mw_lbl.add_theme_color_override("font_color", Color("#DF8A2E"))
	p_mon.add_child(_insp_proc_mw_lbl)

	_insp_proc_sec_lbl = Label.new()
	_insp_proc_sec_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_insp_proc_sec_lbl.add_theme_font_size_override("font_size", 10)
	_insp_proc_sec_lbl.add_theme_color_override("font_color", Color("#DF8A2E"))
	p_mon.add_child(_insp_proc_sec_lbl)

	# Right White OUTPUT Card Interior (left=62.4%, top=17.5%, w=35.5%, h=71.8%)
	var p_out_box := HBoxContainer.new()
	p_out_box.anchor_left = 0.635
	p_out_box.anchor_top = 0.36
	p_out_box.anchor_right = 0.970
	p_out_box.anchor_bottom = 0.68
	p_out_box.alignment = BoxContainer.ALIGNMENT_BEGIN
	p_out_box.add_theme_constant_override("separation", 8)
	_insp_proc_overlay.add_child(p_out_box)

	var out_slot_panel := Panel.new()
	out_slot_panel.custom_minimum_size = Vector2(44, 44)
	out_slot_panel.add_theme_stylebox_override("panel", _make_box_style(Color("#D5D6D9"), Color("#B8BAC0"), 2, 1, 2, 2))
	p_out_box.add_child(out_slot_panel)

	_insp_proc_out_slot_icon = TextureRect.new()
	_insp_proc_out_slot_icon.set_anchors_preset(Control.PRESET_FULL_RECT)
	_insp_proc_out_slot_icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_insp_proc_out_slot_icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	out_slot_panel.add_child(_insp_proc_out_slot_icon)

	_insp_proc_out_slot_badge = Label.new()
	_insp_proc_out_slot_badge.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	_insp_proc_out_slot_badge.offset_left = -24
	_insp_proc_out_slot_badge.offset_top = -14
	_insp_proc_out_slot_badge.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	_insp_proc_out_slot_badge.add_theme_font_size_override("font_size", 10)
	_insp_proc_out_slot_badge.add_theme_color_override("font_color", Color("#DF8A2E"))
	out_slot_panel.add_child(_insp_proc_out_slot_badge)

	var out_txt_vbox := VBoxContainer.new()
	out_txt_vbox.alignment = BoxContainer.ALIGNMENT_CENTER
	p_out_box.add_child(out_txt_vbox)

	_insp_proc_out_title = Label.new()
	_insp_proc_out_title.add_theme_font_size_override("font_size", 11)
	_insp_proc_out_title.add_theme_color_override("font_color", Color("#333538"))
	out_txt_vbox.add_child(_insp_proc_out_title)

	_insp_proc_out_rate = Label.new()
	_insp_proc_out_rate.add_theme_font_size_override("font_size", 10)
	_insp_proc_out_rate.add_theme_color_override("font_color", Color("#DF8A2E"))
	out_txt_vbox.add_child(_insp_proc_out_rate)

	# --- LOWER BAY PLATE (machine_lower_bay_clean.png, 530x190) ---
	_insp_lower_plate = TextureRect.new()
	_insp_lower_plate.custom_minimum_size = Vector2(530, 190)
	_insp_lower_plate.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_insp_lower_plate.stretch_mode = TextureRect.STRETCH_SCALE
	_insp_lower_plate.texture = Catalog.get_cached_texture("res://assets/icons/buildings/machine_lower_bay_clean.png")
	_insp_prod_view.add_child(_insp_lower_plate)

	# Stepped White Overclocking Box Interior (left=5.4%, top=8.5%, w=56.2%, h=46.6%)
	var oc_box := VBoxContainer.new()
	oc_box.anchor_left = 0.054
	oc_box.anchor_top = 0.085
	oc_box.anchor_right = 0.616
	oc_box.anchor_bottom = 0.551
	oc_box.alignment = BoxContainer.ALIGNMENT_BEGIN
	_insp_lower_plate.add_child(oc_box)

	var top_oc_row := HBoxContainer.new()
	top_oc_row.add_theme_constant_override("separation", 4)
	oc_box.add_child(top_oc_row)

	var col_40 := VBoxContainer.new()
	col_40.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	col_40.add_theme_constant_override("separation", 2)
	top_oc_row.add_child(col_40)

	var clk_row := HBoxContainer.new()
	col_40.add_child(clk_row)
	var clk_lbl := Label.new()
	clk_lbl.text = "Clock Speed:"
	clk_lbl.add_theme_font_size_override("font_size", 9)
	clk_lbl.add_theme_color_override("font_color", Color("#333538"))
	clk_row.add_child(clk_lbl)

	_insp_clock_input = LineEdit.new()
	_insp_clock_input.custom_minimum_size = Vector2(56, 20)
	_insp_clock_input.add_theme_font_size_override("font_size", 9)
	_insp_clock_input.add_theme_color_override("font_color", Color("#DF8A2E"))
	_insp_clock_input.add_theme_stylebox_override("normal", _make_box_style(Color("#ECECEE"), Color("#C5C7CB"), 2, 1, 4, 1))
	_insp_clock_input.text_submitted.connect(_on_manual_clock_submitted)
	clk_row.add_child(_insp_clock_input)

	var tr_row := HBoxContainer.new()
	col_40.add_child(tr_row)
	var tr_lbl := Label.new()
	tr_lbl.text = "Target rate:"
	tr_lbl.add_theme_font_size_override("font_size", 9)
	tr_lbl.add_theme_color_override("font_color", Color("#333538"))
	tr_row.add_child(tr_lbl)

	_insp_rate_input = LineEdit.new()
	_insp_rate_input.custom_minimum_size = Vector2(56, 20)
	_insp_rate_input.add_theme_font_size_override("font_size", 9)
	_insp_rate_input.add_theme_color_override("font_color", Color("#DF8A2E"))
	_insp_rate_input.add_theme_stylebox_override("normal", _make_box_style(Color("#ECECEE"), Color("#C5C7CB"), 2, 1, 4, 1))
	_insp_rate_input.text_submitted.connect(_on_manual_rate_submitted)
	tr_row.add_child(_insp_rate_input)

	# 3 Interactive Power Shard Slots
	_insp_shard_slots.clear()
	for s_i in range(3):
		var s_btn := Button.new()
		s_btn.custom_minimum_size = Vector2(36, 36)
		s_btn.icon = Catalog.get_item_texture("power_shard")
		s_btn.expand_icon = true
		var captured_slot: int = s_i
		s_btn.pressed.connect(func() -> void: _on_toggle_power_shard_slot(captured_slot))
		top_oc_row.add_child(s_btn)
		_insp_shard_slots.append(s_btn)

	# 5-Segment Slider Bar (0% — 250%)
	var seg_container := Control.new()
	seg_container.custom_minimum_size = Vector2(0, 18)
	oc_box.add_child(seg_container)

	var seg_hbox := HBoxContainer.new()
	seg_hbox.set_anchors_preset(Control.PRESET_FULL_RECT)
	seg_hbox.add_theme_constant_override("separation", 2)
	seg_container.add_child(seg_hbox)

	_insp_seg_bgs.clear()
	_insp_seg_fills.clear()
	for seg_i in range(5):
		var bg := ColorRect.new()
		bg.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		bg.size_flags_vertical = Control.SIZE_EXPAND_FILL
		bg.color = Color("#73757A")
		seg_hbox.add_child(bg)
		_insp_seg_bgs.append(bg)

		var fill := ColorRect.new()
		fill.set_anchors_preset(Control.PRESET_LEFT_WIDE)
		fill.anchor_right = 1.0
		fill.color = Color("#DF8A2E")
		bg.add_child(fill)
		_insp_seg_fills.append(fill)

	_insp_clock_slider = HSlider.new()
	_insp_clock_slider.set_anchors_preset(Control.PRESET_FULL_RECT)
	_insp_clock_slider.min_value = 1.0
	_insp_clock_slider.max_value = 100.0
	_insp_clock_slider.step = 1.0
	_insp_clock_slider.modulate = Color(1, 1, 1, 0.25)
	_insp_clock_slider.value_changed.connect(_on_clock_slider_changed)
	seg_container.add_child(_insp_clock_slider)

	# Copy & Paste Settings Invisible/Subtle Hotspots on Left Footer
	var copy_btn := Button.new()
	copy_btn.anchor_left = 0.022
	copy_btn.anchor_top = 0.643
	copy_btn.anchor_right = 0.334
	copy_btn.anchor_bottom = 0.751
	copy_btn.flat = true
	copy_btn.tooltip_text = "Copy Machine Settings"
	copy_btn.pressed.connect(_on_copy_machine_settings)
	_insp_lower_plate.add_child(copy_btn)

	_insp_paste_btn = Button.new()
	_insp_paste_btn.anchor_left = 0.022
	_insp_paste_btn.anchor_top = 0.762
	_insp_paste_btn.anchor_right = 0.334
	_insp_paste_btn.anchor_bottom = 0.870
	_insp_paste_btn.flat = true
	_insp_paste_btn.tooltip_text = "Paste Machine Settings"
	_insp_paste_btn.pressed.connect(_on_paste_machine_settings)
	_insp_lower_plate.add_child(_insp_paste_btn)

	# Illuminated Symmetrical I / O Standby Rocker Switch (left=86.6%, top=64.8%, w=8.7%, h=19.3%)
	var rocker_btn := Button.new()
	rocker_btn.anchor_left = 0.866
	rocker_btn.anchor_top = 0.648
	rocker_btn.anchor_right = 0.953
	rocker_btn.anchor_bottom = 0.841
	rocker_btn.flat = true
	rocker_btn.pressed.connect(_on_toggle_inspector_standby)
	_insp_lower_plate.add_child(rocker_btn)

	var rkr_vbox := VBoxContainer.new()
	rkr_vbox.set_anchors_preset(Control.PRESET_FULL_RECT)
	rkr_vbox.add_theme_constant_override("separation", 1)
	rkr_vbox.mouse_filter = Control.MOUSE_FILTER_IGNORE
	rocker_btn.add_child(rkr_vbox)

	_insp_rocker_on_bg = ColorRect.new()
	_insp_rocker_on_bg.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_insp_rocker_on_bg.color = Color("#FF981A")
	_insp_rocker_on_bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	rkr_vbox.add_child(_insp_rocker_on_bg)

	var rkr_i_lbl := Label.new()
	rkr_i_lbl.set_anchors_preset(Control.PRESET_FULL_RECT)
	rkr_i_lbl.text = "I"
	rkr_i_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	rkr_i_lbl.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	rkr_i_lbl.add_theme_font_size_override("font_size", 9)
	rkr_i_lbl.add_theme_color_override("font_color", Color("#FFFFFF"))
	_insp_rocker_on_bg.add_child(rkr_i_lbl)

	_insp_rocker_off_bg = ColorRect.new()
	_insp_rocker_off_bg.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_insp_rocker_off_bg.color = Color("#383B42")
	_insp_rocker_off_bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	rkr_vbox.add_child(_insp_rocker_off_bg)

	var rkr_o_lbl := Label.new()
	rkr_o_lbl.set_anchors_preset(Control.PRESET_FULL_RECT)
	rkr_o_lbl.text = "O"
	rkr_o_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	rkr_o_lbl.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	rkr_o_lbl.add_theme_font_size_override("font_size", 9)
	rkr_o_lbl.add_theme_color_override("font_color", Color("#FFFFFF"))
	_insp_rocker_off_bg.add_child(rkr_o_lbl)

	# ========================================================================
	# RIGHT COLUMN: PIONEER INVENTORY SIDEBAR (360px wide, 9x5 Grid + Sort/Trash)
	# ========================================================================
	var right_inv := PanelContainer.new()
	right_inv.custom_minimum_size = Vector2(360, 540)
	right_inv.add_theme_stylebox_override("panel", _make_box_style(Color(0.07, 0.08, 0.09, 0.78), Color("#2E323B"), 4, 1, 10, 10))
	hsplit.add_child(right_inv)

	var inv_vbox := VBoxContainer.new()
	inv_vbox.add_theme_constant_override("separation", 8)
	right_inv.add_child(inv_vbox)

	var rel_lbl := Label.new()
	rel_lbl.text = "Relevant Items:"
	rel_lbl.add_theme_font_size_override("font_size", 12)
	rel_lbl.add_theme_color_override("font_color", Color("#E8E8E8"))
	inv_vbox.add_child(rel_lbl)

	_inv_relevant_hbox = HBoxContainer.new()
	_inv_relevant_hbox.custom_minimum_size = Vector2(0, 48)
	_inv_relevant_hbox.add_theme_constant_override("separation", 6)
	inv_vbox.add_child(_inv_relevant_hbox)

	var all_lbl := Label.new()
	all_lbl.text = "All Items:"
	all_lbl.add_theme_font_size_override("font_size", 12)
	all_lbl.add_theme_color_override("font_color", Color("#E8E8E8"))
	inv_vbox.add_child(all_lbl)

	_inv_grid = GridContainer.new()
	_inv_grid.columns = 9
	_inv_grid.add_theme_constant_override("h_separation", 3)
	_inv_grid.add_theme_constant_override("v_separation", 3)
	inv_vbox.add_child(_inv_grid)

	var inv_spacer := Control.new()
	inv_spacer.size_flags_vertical = Control.SIZE_EXPAND_FILL
	inv_vbox.add_child(inv_spacer)

	var inv_footer := HBoxContainer.new()
	inv_footer.custom_minimum_size = Vector2(0, 44)
	inv_vbox.add_child(inv_footer)

	_inv_sort_btn = Button.new()
	_inv_sort_btn.text = "↓≡  Sort"
	_inv_sort_btn.custom_minimum_size = Vector2(120, 42)
	_style_button(_inv_sort_btn, Color("#686868"), Color("#18191C"), Color("#EAEAEA"), 2, 13)
	_inv_sort_btn.pressed.connect(func() -> void: GameState.sort_pioneer_inventory())
	inv_footer.add_child(_inv_sort_btn)

	var f_spacer := Control.new()
	f_spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	inv_footer.add_child(f_spacer)

	var trash_btn := Button.new()
	trash_btn.text = "🗑"
	trash_btn.tooltip_text = "Trash Selected Pioneer Slot / Flush Machine Buffers"
	trash_btn.custom_minimum_size = Vector2(54, 42)
	_style_button(trash_btn, Color("#686868"), Color("#18191C"), Color("#FFFFFF"), 2, 16)
	trash_btn.pressed.connect(func() -> void:
		GameState.trash_pioneer_slot(_selected_inv_slot)
		var cur_n: Dictionary = GameState.get_selected_node()
		if not cur_n.is_empty():
			cur_n["storage"] = 0
			cur_n["inputStorage2"] = 0
			cur_n["outputStorage"] = 0
			FactorySim.step_simulation(GameState.nodes, GameState.connections, 0.0)
			_refresh_live_inspector_telemetry()
			GameState.state_changed.emit()
	)
	inv_footer.add_child(trash_btn)

func _open_node_inspector(node_id: String) -> void:
	GameState.select_node(node_id)
	var node: Dictionary = GameState.get_selected_node()
	if node.is_empty() or str(node.get("buildingId", "")) == "resource_deposit":
		return
	_insp_active_tab = "production"
	_populate_inspector_recipe_list(node)
	_refresh_pioneer_inventory()
	_refresh_live_inspector_telemetry()
	_inspector_backdrop.visible = true

func _populate_inspector_recipe_list(node: Dictionary) -> void:
	for child in _insp_recipe_list.get_children():
		child.queue_free()
	var b_id: String = str(node.get("buildingId", ""))
	var b_def: Dictionary = Catalog.BUILDINGS.get(b_id, {})
	var avail: Array = b_def.get("availableRecipeIds", [])
	_insp_tab_rec_btn.visible = (b_id != "miner_mk1" and avail.size() > 0)

	for r_id in avail:
		var r_def: Dictionary = Catalog.RECIPES.get(str(r_id), {})
		if r_def.is_empty():
			continue
		var r_outs: Array = r_def.get("outputs", [])
		var out_name: String = str(r_outs[0].get("itemName", "Output")) if r_outs.size() > 0 else "Output"
		var out_rate: float = float(r_outs[0].get("ratePerMin", 30.0)) if r_outs.size() > 0 else 30.0
		var btn := Button.new()
		btn.text = "%s  (%d/min · %.1fs cycle)" % [str(r_def.get("name", r_id)), int(out_rate), float(r_def.get("cycleTimeSec", 2.0))]
		btn.icon = Catalog.get_item_texture(out_name)
		btn.expand_icon = true
		btn.custom_minimum_size = Vector2(0, 48)
		_style_button(btn, Color("#2E3036"), Color("#DF8A2E") if str(node.get("recipeId", "")) == str(r_id) else Color("#454850"), Color("#FFFFFF"), 6, 13)
		var captured_rid: String = str(r_id)
		btn.pressed.connect(func() -> void:
			var cur_n: Dictionary = GameState.get_selected_node()
			if not cur_n.is_empty():
				GameState.push_snapshot("Change Recipe")
				FactorySim.change_node_recipe(cur_n, captured_rid)
				FactorySim.step_simulation(GameState.nodes, GameState.connections, 0.0)
				SynthAudio.play_sfx("click")
				_insp_active_tab = "production"
				_populate_inspector_recipe_list(cur_n)
				_refresh_pioneer_inventory()
				_refresh_live_inspector_telemetry()
				GameState.state_changed.emit()
		)
		_insp_recipe_list.add_child(btn)

func _refresh_live_inspector_telemetry() -> void:
	var node: Dictionary = GameState.get_selected_node()
	if node.is_empty():
		_inspector_backdrop.visible = false
		return

	var b_id: String = str(node.get("buildingId", ""))
	var is_miner: bool = (b_id == "miner_mk1")
	_insp_title_lbl.text = str(node.get("title", "Machine"))

	var show_rec: bool = (_insp_active_tab == "recipe" and not is_miner)
	_insp_recipe_scroll.visible = show_rec
	_insp_prod_view.visible = not show_rec
	_style_button(_insp_tab_prod_btn, Color("#2E3036") if not show_rec else Color("#1D1E22"), Color("#DF8A2E") if not show_rec else Color("#3E4046"), Color("#FFFFFF"), 4, 11, 8, 2)
	_style_button(_insp_tab_rec_btn, Color("#2E3036") if show_rec else Color("#1D1E22"), Color("#DF8A2E") if show_rec else Color("#3E4046"), Color("#FFFFFF"), 4, 11, 8, 2)

	if is_miner:
		_insp_top_plate.texture = Catalog.get_cached_texture("res://assets/icons/buildings/miner_top_bay_clean.png")
		_insp_miner_overlay.visible = true
		_insp_proc_overlay.visible = false
	else:
		_insp_top_plate.texture = Catalog.get_cached_texture("res://assets/icons/buildings/processor_top_bay_clean.png")
		_insp_miner_overlay.visible = false
		_insp_proc_overlay.visible = true

	var shards: int = clampi(int(node.get("powerShards", 0)), 0, 3)
	var max_clock: float = Catalog.get_max_clock_speed_pct(shards)
	var clock_pct: float = Catalog.clamp_clock_speed_pct(float(node.get("overclock", 100.0)), shards)
	var is_stby: bool = bool(node.get("standby", false))
	var mw_val: float = Catalog.get_building_power_mw(b_id, clock_pct, is_stby)
	var eff_val: int = int(roundf(float(node.get("efficiency", 0.0))))
	var cyc_prog: float = 0.0 if is_stby else clampf(float(node.get("cycleProgress", 0.0)), 0.0, 1.0)
	var prog_pct: int = int(roundf(cyc_prog * 100.0))

	var recipe_id: String = str(node.get("recipeId", ""))
	var recipe: Dictionary = Catalog.RECIPES.get(recipe_id, {})
	var base_cycle: float = float(recipe.get("cycleTimeSec", 2.0))
	var scaled_cycle: float = Catalog.get_scaled_cycle_time_sec(base_cycle, clock_pct)

	var outs: Array = node.get("outputs", [])
	var out_name: String = str(outs[0].get("itemName", "Iron Ore")) if outs.size() > 0 else "Iron Ore"
	var out_rate: float = float(outs[0].get("ratePerMin", 60.0)) if outs.size() > 0 else 60.0
	var out_stored: int = int(node.get("outputStorage", 0))
	var is_compact: bool = str(GameState.settings.get("rateDisplayFormat", "per_minute")) == "compact"
	var unit_suffix: String = "/m" if is_compact else " per minute"

	if is_miner:
		_insp_miner_ore_icon.texture = Catalog.get_item_texture(out_name)
		_insp_miner_ore_badge.text = str(out_stored)
		_insp_miner_ore_title.text = "1 " + out_name
		_insp_miner_ore_rate.text = "%.1f%s" % [out_rate, unit_suffix]
		_insp_miner_prog_bar.anchor_right = cyc_prog
		_insp_miner_status_lbl.text = "%s - %d%%" % ["Standby" if is_stby else "Mining", prog_pct]
		_insp_miner_mw_lbl.text = "⚡ %.1f MW" % mw_val
		_insp_miner_sec_lbl.text = "⏱ %.1f sec" % (60.0 / maxf(1.0, out_rate))
		_insp_miner_eff_lbl.text = "📊 %d%%" % (0 if is_stby else eff_val)
	else:
		_insp_proc_recipe_btn.text = str(recipe.get("name", node.get("title", "Machine")))
		_insp_proc_out_icon.texture = Catalog.get_item_texture(out_name)
		_insp_proc_prog_bar.anchor_right = cyc_prog
		_insp_proc_status_lbl.text = "%s - %d%%" % ["Standby" if is_stby else "Constructing", prog_pct]
		_insp_proc_mw_lbl.text = "⚡ %.1f MW" % mw_val
		_insp_proc_sec_lbl.text = "⏱ %.2f sec" % scaled_cycle
		_insp_proc_out_slot_icon.texture = Catalog.get_item_texture(out_name)
		_insp_proc_out_slot_badge.text = str(out_stored)
		_insp_proc_out_title.text = "1 " + out_name
		_insp_proc_out_rate.text = "%.1f%s" % [out_rate, unit_suffix]

		# Sync Processor Input Slots
		var r_ins: Array = recipe.get("inputs", [])
		for child in _insp_proc_inputs_vbox.get_children():
			child.queue_free()
		if r_ins.is_empty():
			var none_lbl := Label.new()
			none_lbl.text = "Pass-Through Buffer: %d" % int(node.get("storage", 0))
			none_lbl.add_theme_font_size_override("font_size", 11)
			none_lbl.add_theme_color_override("font_color", Color("#333538"))
			_insp_proc_inputs_vbox.add_child(none_lbl)
		else:
			for idx in range(r_ins.size()):
				var rin: Dictionary = r_ins[idx]
				var in_name: String = str(rin.get("itemName", "Input"))
				var req_cnt: int = maxi(1, int(roundf(float(rin.get("ratePerMin", 30.0)) * base_cycle / 60.0)))
				var sc_in_rate: float = Catalog.get_scaled_rate_per_min(float(rin.get("ratePerMin", 30.0)), clock_pct)
				var cur_buf: int = int(node.get("storage", 0)) if idx == 0 else int(node.get("inputStorage2", 0))

				var row := HBoxContainer.new()
				row.add_theme_constant_override("separation", 8)
				_insp_proc_inputs_vbox.add_child(row)

				var slot_btn := Button.new()
				slot_btn.custom_minimum_size = Vector2(42, 42)
				slot_btn.icon = Catalog.get_item_texture(in_name)
				slot_btn.expand_icon = true
				slot_btn.text = "%d/%d" % [cur_buf, req_cnt]
				_style_button(slot_btn, Color("#D5D6D9"), Color("#B8BAC0"), Color("#DF8A2E"), 2, 9, 2, 2)
				slot_btn.pressed.connect(_on_fill_machine_input_buffer)
				row.add_child(slot_btn)

				var tv := VBoxContainer.new()
				row.add_child(tv)
				var nl := Label.new()
				nl.text = "%d %s" % [req_cnt, in_name]
				nl.add_theme_font_size_override("font_size", 10)
				nl.add_theme_color_override("font_color", Color("#333538"))
				tv.add_child(nl)
				var rl := Label.new()
				rl.text = "%.1f%s" % [sc_in_rate, unit_suffix]
				rl.add_theme_font_size_override("font_size", 9)
				rl.add_theme_color_override("font_color", Color("#DF8A2E"))
				tv.add_child(rl)

	# Sync Lower Overclock Controls
	_insp_clock_slider.max_value = max_clock
	_insp_clock_slider.set_value_no_signal(clock_pct)
	if not _insp_clock_input.has_focus():
		_insp_clock_input.text = "%.1f%%" % clock_pct
	if not _insp_rate_input.has_focus():
		_insp_rate_input.text = "%.1f" % out_rate

	for s_i in range(3):
		var installed: bool = (s_i < shards)
		var btn: Button = _insp_shard_slots[s_i]
		btn.text = "1/1" if installed else "0/1"
		_style_button(btn, Color("#D8D9DC"), Color("#DF8A2E") if installed else Color("#9CA3AF"), Color("#DF8A2E") if installed else Color("#686B70"), 3, 8, 2, 2)

	for seg_i in range(5):
		var s_start: float = float(seg_i * 50)
		var s_end: float = float((seg_i + 1) * 50)
		_insp_seg_bgs[seg_i].color = Color("#73757A") if s_end <= max_clock else Color("#CFCFD3")
		var fill_ratio: float = clampf((minf(s_end, clock_pct) - s_start) / 50.0, 0.0, 1.0)
		_insp_seg_fills[seg_i].anchor_right = fill_ratio

	_insp_rocker_on_bg.color = Color("#FF981A") if not is_stby else Color("#383B42")
	_insp_rocker_off_bg.color = Color("#EF4444") if is_stby else Color("#383B42")

func _on_toggle_power_shard_slot(slot_idx: int) -> void:
	var node: Dictionary = GameState.get_selected_node()
	if node.is_empty():
		return
	var cur_shards: int = clampi(int(node.get("powerShards", 0)), 0, 3)
	if slot_idx < cur_shards:
		# Remove shard back to Pioneer Inventory
		node["powerShards"] = cur_shards - 1
		node["overclock"] = Catalog.clamp_clock_speed_pct(float(node.get("overclock", 100.0)), cur_shards - 1)
		GameState.add_item_to_pioneer_inventory("power_shard", "Power Shard", 1)
		FactorySim.step_simulation(GameState.nodes, GameState.connections, 0.0)
		SynthAudio.play_sfx("click")
		_refresh_live_inspector_telemetry()
		GameState.state_changed.emit()
	else:
		# Install shard from Pioneer Inventory
		if GameState.take_item_from_pioneer_inventory("power_shard", 1) > 0:
			node["powerShards"] = cur_shards + 1
			SynthAudio.play_sfx("click")
			_refresh_live_inspector_telemetry()
			GameState.state_changed.emit()
		else:
			SynthAudio.play_sfx("error")

func _on_fill_machine_input_buffer() -> void:
	var node: Dictionary = GameState.get_selected_node()
	if node.is_empty():
		return
	node["storage"] = mini(100, int(node.get("storage", 0)) + 25)
	if (node.get("inputs", []) as Array).size() > 1:
		node["inputStorage2"] = mini(100, int(node.get("inputStorage2", 0)) + 25)
	FactorySim.step_simulation(GameState.nodes, GameState.connections, 0.0)
	SynthAudio.play_sfx("click")
	_refresh_live_inspector_telemetry()
	GameState.state_changed.emit()

func _on_clock_slider_changed(val: float) -> void:
	var node: Dictionary = GameState.get_selected_node()
	if node.is_empty():
		return
	var shards: int = int(node.get("powerShards", 0))
	node["overclock"] = Catalog.clamp_clock_speed_pct(val, shards)
	FactorySim.step_simulation(GameState.nodes, GameState.connections, 0.0)
	_refresh_live_inspector_telemetry()
	GameState.state_changed.emit()

func _on_manual_clock_submitted(text: String) -> void:
	var node: Dictionary = GameState.get_selected_node()
	if node.is_empty():
		return
	var cleaned: String = text.replace("%", "").strip_edges()
	var parsed: float = cleaned.to_float()
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

func _on_toggle_inspector_standby() -> void:
	var node: Dictionary = GameState.get_selected_node()
	if node.is_empty():
		return
	node["standby"] = not bool(node.get("standby", false))
	FactorySim.step_simulation(GameState.nodes, GameState.connections, 0.0)
	SynthAudio.play_sfx("click")
	_refresh_live_inspector_telemetry()
	GameState.state_changed.emit()

func _on_copy_machine_settings() -> void:
	var node: Dictionary = GameState.get_selected_node()
	if node.is_empty():
		return
	_copied_machine_settings = {
		"buildingId": str(node.get("buildingId", "")),
		"recipeId": str(node.get("recipeId", "")),
		"overclock": float(node.get("overclock", 100.0)),
		"standby": bool(node.get("standby", false)),
	}
	SynthAudio.play_sfx("click")

func _on_paste_machine_settings() -> void:
	if _copied_machine_settings.is_empty():
		return
	var node: Dictionary = GameState.get_selected_node()
	if node.is_empty():
		return
	GameState.push_snapshot("Paste Machine Settings")
	if str(node.get("buildingId", "")) == str(_copied_machine_settings.get("buildingId", "")):
		var target_rec: String = str(_copied_machine_settings.get("recipeId", ""))
		if not target_rec.is_empty():
			FactorySim.change_node_recipe(node, target_rec)
	var shards: int = int(node.get("powerShards", 0))
	node["overclock"] = Catalog.clamp_clock_speed_pct(float(_copied_machine_settings.get("overclock", 100.0)), shards)
	node["standby"] = bool(_copied_machine_settings.get("standby", false))
	FactorySim.step_simulation(GameState.nodes, GameState.connections, 0.0)
	SynthAudio.play_sfx("place")
	_refresh_live_inspector_telemetry()
	GameState.state_changed.emit()

func _refresh_pioneer_inventory() -> void:
	if _inv_grid == null or _inv_relevant_hbox == null:
		return
	for child in _inv_relevant_hbox.get_children():
		child.queue_free()
	for child in _inv_grid.get_children():
		child.queue_free()

	var node: Dictionary = GameState.get_selected_node()
	var rel_names: Dictionary = {}
	if not node.is_empty():
		for inp in node.get("inputs", []):
			rel_names[str(inp.get("itemName", "")).to_lower()] = true
		for outp in node.get("outputs", []):
			rel_names[str(outp.get("itemName", "")).to_lower()] = true

	var shown_rel: int = 0
	for i in range(GameState.pioneer_inventory.size()):
		var slot: Dictionary = GameState.pioneer_inventory[i]
		var count: int = int(slot.get("count", 0))
		var item_id: String = str(slot.get("itemId", ""))
		var item_name: String = str(slot.get("itemName", item_id))

		if count > 0 and shown_rel < 5 and rel_names.has(item_name.to_lower()):
			shown_rel += 1
			var rbtn := Button.new()
			rbtn.custom_minimum_size = Vector2(46, 46)
			rbtn.text = str(count)
			rbtn.icon = Catalog.get_item_texture(item_id)
			rbtn.expand_icon = true
			_style_button(rbtn, Color("#D0D0D0"), Color("#E59334"), Color("#18191C"), 3, 10, 2, 2)
			rbtn.pressed.connect(_on_fill_machine_input_buffer)
			_inv_relevant_hbox.add_child(rbtn)

		var btn := Button.new()
		btn.custom_minimum_size = Vector2(35, 35)
		var is_sel_slot: bool = (i == _selected_inv_slot)
		if count > 0 and not item_id.is_empty():
			btn.text = str(count)
			btn.icon = Catalog.get_item_texture(item_id)
			btn.expand_icon = true
			_style_button(btn, Color("#D0D0D0"), Color("#E59334") if (is_sel_slot or item_id == "power_shard") else Color("#9CA3AF"), Color("#18191C"), 2, 9, 2, 2)
		else:
			btn.text = ""
			_style_button(btn, Color(0.33, 0.33, 0.33, 0.55), Color("#E59334") if is_sel_slot else Color.TRANSPARENT, Color("#FFFFFF"), 2, 9, 2, 2)

		var idx: int = i
		var captured_item_id: String = item_id
		btn.pressed.connect(func() -> void:
			_selected_inv_slot = idx
			if captured_item_id == "power_shard":
				var cur_n: Dictionary = GameState.get_selected_node()
				if not cur_n.is_empty() and int(cur_n.get("powerShards", 0)) < 3:
					_on_toggle_power_shard_slot(int(cur_n.get("powerShards", 0)))
					return
			SynthAudio.play_sfx("click")
			_refresh_pioneer_inventory()
		)
		_inv_grid.add_child(btn)

# ============================================================================
# 6. CONVEYOR BELT INSPECTOR MODAL (1:1 Port of App.tsx Belt Modal)
# ============================================================================
func _build_belt_inspector_modal() -> void:
	var pair: Array = _make_modal_backdrop(25)
	_belt_backdrop = pair[0]
	var center: CenterContainer = pair[1]

	var panel := PanelContainer.new()
	panel.custom_minimum_size = Vector2(460, 0)
	panel.add_theme_stylebox_override("panel", _make_box_style(Color("#0F1523"), Color("#26334D"), 16, 1, 20, 18))
	center.add_child(panel)

	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 12)
	panel.add_child(vbox)

	var header := HBoxContainer.new()
	vbox.add_child(header)

	_belt_title_lbl = Label.new()
	_belt_title_lbl.text = "Conveyor Belt Mk.1"
	_belt_title_lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_belt_title_lbl.add_theme_font_size_override("font_size", 17)
	_belt_title_lbl.add_theme_color_override("font_color", Color("#F8FAFC"))
	header.add_child(_belt_title_lbl)

	var close_btn := Button.new()
	close_btn.text = "✕"
	close_btn.custom_minimum_size = Vector2(38, 34)
	_style_button(close_btn, Color("#1C2742"), Color("#2E3E5C"), Color("#CBD5E1"), 8, 13)
	close_btn.pressed.connect(func() -> void: _belt_backdrop.visible = false)
	header.add_child(close_btn)

	_belt_metrics_lbl = Label.new()
	_belt_metrics_lbl.text = "Carrying: Iron Ore · 60 / 60 per minute"
	_belt_metrics_lbl.add_theme_font_size_override("font_size", 13)
	_belt_metrics_lbl.add_theme_color_override("font_color", Color("#38BDF8"))
	vbox.add_child(_belt_metrics_lbl)

	var grid := GridContainer.new()
	grid.columns = 3
	grid.add_theme_constant_override("h_separation", 8)
	grid.add_theme_constant_override("v_separation", 8)
	vbox.add_child(grid)

	for tier_num in range(1, 7):
		var t_def: Dictionary = Catalog.CONVEYOR_BELT_TIERS[tier_num]
		var btn := Button.new()
		btn.text = "%s\n%d/m" % [str(t_def["shortLabel"]), int(t_def["capacityPerMin"])]
		btn.custom_minimum_size = Vector2(132, 48)
		var captured_tier: int = tier_num
		btn.pressed.connect(func() -> void:
			var conn: Dictionary = GameState.get_selected_connection()
			if not conn.is_empty():
				GameState.push_snapshot("Upgrade Belt Tier")
				conn["beltTier"] = captured_tier
				FactorySim.step_simulation(GameState.nodes, GameState.connections, 0.0)
				SynthAudio.play_sfx("connect")
				_open_belt_inspector(str(conn["id"]))
				GameState.state_changed.emit()
		)
		grid.add_child(btn)
		_belt_tier_modal_btns[tier_num] = btn

	var actions_row := HBoxContainer.new()
	actions_row.add_theme_constant_override("separation", 10)
	vbox.add_child(actions_row)

	var clear_wp_btn := Button.new()
	clear_wp_btn.text = "Clear 90° Corners"
	clear_wp_btn.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	clear_wp_btn.custom_minimum_size = Vector2(0, 42)
	_style_button(clear_wp_btn, Color("#131B2E"), Color("#26334D"), Color("#CBD5E1"), 10, 12)
	clear_wp_btn.pressed.connect(func() -> void:
		var conn: Dictionary = GameState.get_selected_connection()
		if not conn.is_empty():
			GameState.push_snapshot("Clear Belt Corners")
			conn["waypoints"] = []
			FactorySim.step_simulation(GameState.nodes, GameState.connections, 0.0)
			SynthAudio.play_sfx("click")
			GameState.state_changed.emit()
	)
	actions_row.add_child(clear_wp_btn)

	var dis_btn := Button.new()
	dis_btn.text = "🗑 Dismantle Belt"
	dis_btn.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	dis_btn.custom_minimum_size = Vector2(0, 42)
	_style_button(dis_btn, Color("#7F1D1D"), Color("#EF4444"), Color("#FECACA"), 10, 12)
	dis_btn.pressed.connect(func() -> void:
		if not GameState.selected_connection_id.is_empty():
			GameState.dismantle_connection(GameState.selected_connection_id)
			_belt_backdrop.visible = false
	)
	actions_row.add_child(dis_btn)

func _open_belt_inspector(_conn_id: String) -> void:
	var conn: Dictionary = GameState.get_selected_connection()
	if conn.is_empty():
		return
	var tier_num: int = clampi(int(conn.get("beltTier", 1)), 1, 6)
	var t_def: Dictionary = Catalog.CONVEYOR_BELT_TIERS[tier_num]
	_belt_title_lbl.text = str(t_def["name"])
	_belt_metrics_lbl.text = "Item: %s   ·   Flow: %d / %d per min" % [str(conn.get("itemName", "Iron Ore")), int(roundf(float(conn.get("ratePerMin", 0.0)))), int(t_def["capacityPerMin"])]
	for t_i in _belt_tier_modal_btns.keys():
		var btn: Button = _belt_tier_modal_btns[t_i]
		var active: bool = (t_i == tier_num)
		_style_button(btn, Color("#1C2742") if active else Color("#131B2E"), Color("#38BDF8") if active else Color("#26334D"), Color("#FFFFFF"), 10, 12)
	_belt_backdrop.visible = true

# ============================================================================
# 7. SAVE / LOAD MANAGER MODAL (1:1 Port of SaveLoadModal.tsx)
# ============================================================================
func _build_saveload_modal() -> void:
	var pair: Array = _make_modal_backdrop(30)
	_saveload_backdrop = pair[0]
	var center: CenterContainer = pair[1]

	var panel := PanelContainer.new()
	panel.custom_minimum_size = Vector2(620, 460)
	panel.add_theme_stylebox_override("panel", _make_box_style(Color("#0F1523"), Color("#26334D"), 16, 1, 20, 18))
	center.add_child(panel)

	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 12)
	panel.add_child(vbox)

	var header := HBoxContainer.new()
	vbox.add_child(header)

	_saveload_title_lbl = Label.new()
	_saveload_title_lbl.text = "SAVE / LOAD SECTOR ARCHIVES"
	_saveload_title_lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_saveload_title_lbl.add_theme_font_size_override("font_size", 16)
	_saveload_title_lbl.add_theme_color_override("font_color", Color("#F59E0B"))
	header.add_child(_saveload_title_lbl)

	var close_btn := Button.new()
	close_btn.text = "✕"
	close_btn.custom_minimum_size = Vector2(38, 34)
	_style_button(close_btn, Color("#1C2742"), Color("#2E3E5C"), Color("#CBD5E1"), 8, 13)
	close_btn.pressed.connect(func() -> void: _saveload_backdrop.visible = false)
	header.add_child(close_btn)

	# Create Manual Save Row
	var save_row := HBoxContainer.new()
	save_row.add_theme_constant_override("separation", 8)
	vbox.add_child(save_row)

	_saveload_name_input = LineEdit.new()
	_saveload_name_input.placeholder_text = "Enter manual save slot name..."
	_saveload_name_input.text = GameState.session_name + " Checkpoint"
	_saveload_name_input.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_saveload_name_input.custom_minimum_size = Vector2(0, 38)
	_saveload_name_input.add_theme_stylebox_override("normal", _make_box_style(Color("#090D16"), Color("#26334D"), 10, 1, 10, 6))
	save_row.add_child(_saveload_name_input)

	var create_save_btn := Button.new()
	create_save_btn.text = "💾 Save Slot"
	create_save_btn.custom_minimum_size = Vector2(120, 38)
	_style_button(create_save_btn, Color("#F59E0B"), Color("#FDE68A"), Color("#090D16"), 10, 13)
	create_save_btn.pressed.connect(func() -> void:
		GameState.create_manual_save(_saveload_name_input.text)
		_saveload_status_lbl.text = "Saved checkpoint: " + _saveload_name_input.text
		_refresh_saveload_list()
	)
	save_row.add_child(create_save_btn)

	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	vbox.add_child(scroll)

	_saveload_slots_vbox = VBoxContainer.new()
	_saveload_slots_vbox.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_saveload_slots_vbox.add_theme_constant_override("separation", 8)
	scroll.add_child(_saveload_slots_vbox)

	# Cross-Platform JSON Clipboard Import / Export
	var clip_row := HBoxContainer.new()
	clip_row.add_theme_constant_override("separation", 10)
	vbox.add_child(clip_row)

	var exp_btn := Button.new()
	exp_btn.text = "📋 Copy Save JSON to Clipboard"
	exp_btn.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	exp_btn.custom_minimum_size = Vector2(0, 38)
	_style_button(exp_btn, Color("#131B2E"), Color("#26334D"), Color("#38BDF8"), 10, 12)
	exp_btn.pressed.connect(func() -> void:
		DisplayServer.clipboard_set(GameState.export_current_save_json())
		SynthAudio.play_sfx("save")
		_saveload_status_lbl.text = "Save JSON copied to clipboard (compatible with Web & Android)."
	)
	clip_row.add_child(exp_btn)

	var imp_btn := Button.new()
	imp_btn.text = "📥 Import JSON from Clipboard"
	imp_btn.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	imp_btn.custom_minimum_size = Vector2(0, 38)
	_style_button(imp_btn, Color("#131B2E"), Color("#26334D"), Color("#10B981"), 10, 12)
	imp_btn.pressed.connect(func() -> void:
		var res: Dictionary = GameState.import_save_json(DisplayServer.clipboard_get())
		if bool(res.get("ok", false)):
			_saveload_status_lbl.text = "Imported save successfully!"
			_saveload_backdrop.visible = false
		else:
			SynthAudio.play_sfx("error")
			_saveload_status_lbl.text = str(res.get("message", "Clipboard does not contain valid FICSIT JSON."))
	)
	clip_row.add_child(imp_btn)

	_saveload_status_lbl = Label.new()
	_saveload_status_lbl.text = ""
	_saveload_status_lbl.add_theme_font_size_override("font_size", 11)
	_saveload_status_lbl.add_theme_color_override("font_color", Color("#94A3B8"))
	vbox.add_child(_saveload_status_lbl)

func _open_saveload_modal() -> void:
	_saveload_name_input.text = GameState.session_name + " Checkpoint"
	_saveload_status_lbl.text = ""
	_refresh_saveload_list()
	_saveload_backdrop.visible = true

func _refresh_saveload_list() -> void:
	for child in _saveload_slots_vbox.get_children():
		child.queue_free()

	for slot in GameState.save_slots:
		var row_panel := PanelContainer.new()
		row_panel.add_theme_stylebox_override("panel", _make_box_style(Color("#131B2E"), Color("#26334D"), 10, 1, 12, 8))
		_saveload_slots_vbox.add_child(row_panel)

		var rhbox := HBoxContainer.new()
		rhbox.add_theme_constant_override("separation", 10)
		row_panel.add_child(rhbox)

		var info_v := VBoxContainer.new()
		info_v.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		rhbox.add_child(info_v)

		var s_title := Label.new()
		s_title.text = "%s  [%s]" % [str(slot.get("slotName", "Save")), str(slot.get("kind", "auto")).to_upper()]
		s_title.add_theme_font_size_override("font_size", 13)
		s_title.add_theme_color_override("font_color", Color("#F8FAFC"))
		info_v.add_child(s_title)

		var n_cnt: int = (slot.get("nodes", []) as Array).size()
		var c_cnt: int = (slot.get("connections", []) as Array).size()
		var s_sub := Label.new()
		s_sub.text = "Sector: %s  ·  %d Nodes  ·  %d Belts" % [str(slot.get("sessionName", "Sector 01")), n_cnt, c_cnt]
		s_sub.add_theme_font_size_override("font_size", 11)
		s_sub.add_theme_color_override("font_color", Color("#94A3B8"))
		info_v.add_child(s_sub)

		var load_btn := Button.new()
		load_btn.text = "Load"
		load_btn.custom_minimum_size = Vector2(78, 34)
		_style_button(load_btn, Color("#083344"), Color("#38BDF8"), Color("#38BDF8"), 8, 12)
		var captured_slot: Dictionary = slot
		load_btn.pressed.connect(func() -> void:
			SynthAudio.play_sfx("click")
			GameState.load_slot_into_active(captured_slot, true)
			_saveload_backdrop.visible = false
		)
		rhbox.add_child(load_btn)

# ============================================================================
# 8. SETTINGS MODAL (1:1 Port of SettingsModal.tsx)
# ============================================================================
func _build_settings_modal() -> void:
	var pair: Array = _make_modal_backdrop(32)
	_settings_backdrop = pair[0]
	var center: CenterContainer = pair[1]

	var panel := PanelContainer.new()
	panel.custom_minimum_size = Vector2(500, 0)
	panel.add_theme_stylebox_override("panel", _make_box_style(Color("#0F1523"), Color("#26334D"), 16, 1, 20, 18))
	center.add_child(panel)

	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 12)
	panel.add_child(vbox)

	var header := HBoxContainer.new()
	vbox.add_child(header)

	var lbl := Label.new()
	lbl.text = "TERMINAL & SIMULATION SETTINGS"
	lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	lbl.add_theme_font_size_override("font_size", 16)
	lbl.add_theme_color_override("font_color", Color("#F59E0B"))
	header.add_child(lbl)

	var close_btn := Button.new()
	close_btn.text = "✕"
	close_btn.custom_minimum_size = Vector2(38, 34)
	_style_button(close_btn, Color("#1C2742"), Color("#2E3E5C"), Color("#CBD5E1"), 8, 13)
	close_btn.pressed.connect(func() -> void: _settings_backdrop.visible = false)
	header.add_child(close_btn)

	_set_snap_btn = Button.new()
	_set_snap_btn.custom_minimum_size = Vector2(0, 44)
	_set_snap_btn.pressed.connect(func() -> void:
		GameState.settings["snapToGrid"] = not bool(GameState.settings.get("snapToGrid", true))
		GameState.save_settings_to_disk()
		SynthAudio.play_sfx("click")
		_sync_ui_state()
	)
	vbox.add_child(_set_snap_btn)

	_set_perf_btn = Button.new()
	_set_perf_btn.custom_minimum_size = Vector2(0, 44)
	_set_perf_btn.pressed.connect(func() -> void:
		var cur: String = str(GameState.settings.get("performanceMode", "60fps"))
		GameState.settings["performanceMode"] = "battery_saver" if cur == "60fps" else "60fps"
		GameState.save_settings_to_disk()
		SynthAudio.play_sfx("click")
		_sync_ui_state()
	)
	vbox.add_child(_set_perf_btn)

	_set_sfx_btn = Button.new()
	_set_sfx_btn.custom_minimum_size = Vector2(0, 44)
	_set_sfx_btn.pressed.connect(func() -> void:
		GameState.settings["sfxEnabled"] = not bool(GameState.settings.get("sfxEnabled", true))
		GameState.save_settings_to_disk()
		SynthAudio.play_sfx("click")
		_sync_ui_state()
	)
	vbox.add_child(_set_sfx_btn)

	_set_rate_btn = Button.new()
	_set_rate_btn.custom_minimum_size = Vector2(0, 44)
	_set_rate_btn.pressed.connect(func() -> void:
		var cur: String = str(GameState.settings.get("rateDisplayFormat", "per_minute"))
		GameState.settings["rateDisplayFormat"] = "compact" if cur == "per_minute" else "per_minute"
		GameState.save_settings_to_disk()
		SynthAudio.play_sfx("click")
		_sync_ui_state()
	)
	vbox.add_child(_set_rate_btn)

func _open_settings_modal() -> void:
	_sync_ui_state()
	_settings_backdrop.visible = true

# ============================================================================
# GLOBAL UI SYNCHRONIZATION
# ============================================================================
func _sync_ui_state() -> void:
	if _title_layer == null or _hud_layer == null:
		return
	var is_title: bool = (GameState.app_mode == "title")
	_title_layer.visible = is_title
	_hud_layer.visible = not is_title
	if is_title:
		_inspector_backdrop.visible = false
		_build_backdrop.visible = false
		_belt_backdrop.visible = false
		_pause_backdrop.visible = false

	# Update Title Menu Session Info
	if _title_session_lbl:
		_title_session_lbl.text = GameState.session_name
	if _title_stats_lbl:
		var machine_cnt: int = 0
		for n in GameState.nodes:
			if str(n.get("buildingId", "")) != "resource_deposit":
				machine_cnt += 1
		_title_stats_lbl.text = "%d Machines · %d Belts" % [machine_cnt, GameState.connections.size()]

	# Update Top Toolbar Tool Buttons
	for tid in _tool_buttons.keys():
		var btn: Button = _tool_buttons[tid]
		var active: bool = (GameState.active_tool == tid)
		_style_button(btn, Color("#38BDF8") if active else Color("#131B2E"), Color("#BAE6FD") if active else Color("#26334D"), Color("#090D16") if active else Color("#CBD5E1"), 10, 12, 10, 6)

	if _undo_btn:
		_undo_btn.disabled = not GameState.can_undo()
	if _redo_btn:
		_redo_btn.disabled = not GameState.can_redo()

	# Update Active Build Placement Banner
	if _active_build_banner:
		var in_build: bool = (GameState.active_tool == "build" and not GameState.active_build_id.is_empty())
		_active_build_banner.visible = in_build
		if in_build:
			var b_def: Dictionary = Catalog.BUILDINGS.get(GameState.active_build_id, {})
			_active_build_lbl.text = "Placing: %s  (Tap canvas to deploy)" % str(b_def.get("name", "Machine"))

	# Update Multi-Select Batch Bar
	if _multi_select_bar:
		var sel_cnt: int = GameState.selected_node_ids.size()
		_multi_select_bar.visible = (sel_cnt > 1 or (sel_cnt == 1 and GameState.active_tool == "select"))
		_multi_select_lbl.text = "%d Machine%s Selected" % [sel_cnt, "" if sel_cnt == 1 else "s"]

	# Update Bottom-Left Belt Tier & Snap Buttons
	if _belt_tier_btn:
		var t_def: Dictionary = Catalog.CONVEYOR_BELT_TIERS.get(GameState.active_belt_tier, Catalog.CONVEYOR_BELT_TIERS[1])
		_belt_tier_btn.text = "Belt: %s ▴" % str(t_def["shortLabel"])
		var t_col: Color = t_def.get("accentColor", Color("#94A3B8"))
		_style_button(_belt_tier_btn, Color("#131B2E"), t_col, t_col, 10, 12)

	for t_num in _belt_tier_buttons.keys():
		var fbtn: Button = _belt_tier_buttons[t_num]
		var is_t: bool = (t_num == GameState.active_belt_tier)
		_style_button(fbtn, Color("#1C2742") if is_t else Color("#131B2E"), Color("#38BDF8") if is_t else Color("#26334D"), Color("#FFFFFF"), 10, 11, 6, 4)

	var snap_on: bool = bool(GameState.settings.get("snapToGrid", true))
	if _snap_btn:
		_snap_btn.text = "Snap: ON" if snap_on else "Snap: OFF"
		_style_button(_snap_btn, Color("#083344") if snap_on else Color("#131B2E"), Color("#38BDF8") if snap_on else Color("#26334D"), Color("#38BDF8") if snap_on else Color("#94A3B8"), 10, 12)

	# Update Settings Modal Buttons
	if _set_snap_btn:
		_set_snap_btn.text = "Grid Snap Alignment:  %s" % ("ENABLED (24px Grid)" if snap_on else "DISABLED (Freeform)")
		_style_button(_set_snap_btn, Color("#131B2E"), Color("#38BDF8") if snap_on else Color("#26334D"), Color("#F8FAFC"), 10, 13)
	if _set_perf_btn:
		var is_bs: bool = str(GameState.settings.get("performanceMode", "60fps")) == "battery_saver"
		_set_perf_btn.text = "Performance Profile:  %s" % ("BATTERY SAVER (30 FPS)" if is_bs else "HIGH FIDELITY (60 FPS)")
		_style_button(_set_perf_btn, Color("#131B2E"), Color("#F59E0B") if is_bs else Color("#22C55E"), Color("#F8FAFC"), 10, 13)
	if _set_sfx_btn:
		var sfx_on: bool = bool(GameState.settings.get("sfxEnabled", true))
		_set_sfx_btn.text = "Synthesized UI & Factory Audio:  %s" % ("ENABLED" if sfx_on else "MUTED")
		_style_button(_set_sfx_btn, Color("#131B2E"), Color("#38BDF8") if sfx_on else Color("#26334D"), Color("#F8FAFC"), 10, 13)
	if _set_rate_btn:
		var is_comp: bool = str(GameState.settings.get("rateDisplayFormat", "per_minute")) == "compact"
		_set_rate_btn.text = "Throughput Unit Display:  %s" % ("COMPACT (60/m)" if is_comp else "STANDARD (60 per minute)")
		_style_button(_set_rate_btn, Color("#131B2E"), Color("#F59E0B"), Color("#F8FAFC"), 10, 13)
