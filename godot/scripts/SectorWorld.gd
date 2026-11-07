extends Node2D
## ============================================================================
## FICSIT Labs — Hardware-Batched 2D Sector World Renderer & Touch Controller
## ============================================================================

signal request_open_node_inspector(node_id: String)
signal request_open_belt_inspector(conn_id: String)

const VIEWPORT_CULL_MARGIN: float = 240.0

var _active_touches: Dictionary = {}
var _last_pinch_dist: float = 0.0
var _last_pinch_mid: Vector2 = Vector2.ZERO

var _is_panning: bool = false
var _pan_last_screen: Vector2 = Vector2.ZERO
var _pointer_down_screen: Vector2 = Vector2.ZERO
var _pointer_moved: bool = false

var _dragging_node_id: String = ""
var _drag_offset_world: Vector2 = Vector2.ZERO
var _drag_has_collision: bool = false
var _active_guidelines: Array = []

var _wiring_from_node_id: String = ""
var _wiring_from_port_id: String = ""
var _wiring_from_pos: Vector2 = Vector2.ZERO
var _pointer_world: Vector2 = Vector2.ZERO

var _is_marquee_selecting: bool = false
var _marquee_start_world: Vector2 = Vector2.ZERO
var _marquee_end_world: Vector2 = Vector2.ZERO

var _dragging_waypoint_conn_id: String = ""
var _dragging_waypoint_idx: int = -1

var _elapsed_time: float = 0.0

func _ready() -> void:
	GameState.state_changed.connect(queue_redraw)
	GameState.selection_changed.connect(queue_redraw)

func _process(delta: float) -> void:
	_elapsed_time += delta
	if GameState.app_mode == "title":
		var t: float = float(Time.get_ticks_msec())
		GameState.camera["x"] = -1820.0 + sin(t * 0.00025) * 90.0
		GameState.camera["y"] = -1920.0 + cos(t * 0.0002) * 35.0
		GameState.camera["zoom"] = 0.74
	queue_redraw()

func screen_to_world(screen_pt: Vector2) -> Vector2:
	var cam_x: float = float(GameState.camera.get("x", -1820.0))
	var cam_y: float = float(GameState.camera.get("y", -1920.0))
	var cam_z: float = maxf(Catalog.MIN_ZOOM, float(GameState.camera.get("zoom", 0.74)))
	return Vector2((screen_pt.x - cam_x) / cam_z, (screen_pt.y - cam_y) / cam_z)

func apply_zoom_about_screen_point(next_zoom_raw: float, screen_pt: Vector2) -> void:
	var vp_size: Vector2 = get_viewport_rect().size
	var cur_z: float = float(GameState.camera.get("zoom", 0.74))
	if not is_finite(cur_z) or cur_z <= 0.0:
		cur_z = 0.74
	var cur_x: float = float(GameState.camera.get("x", -1820.0))
	var cur_y: float = float(GameState.camera.get("y", -1920.0))
	var next_z: float = clampf(next_zoom_raw, Catalog.MIN_ZOOM, Catalog.MAX_ZOOM)

	var world_pt := Vector2((screen_pt.x - cur_x) / cur_z, (screen_pt.y - cur_y) / cur_z)
	var raw_cam := Vector2(screen_pt.x - world_pt.x * next_z, screen_pt.y - world_pt.y * next_z)
	GameState.camera = Catalog.clamp_camera_to_world(raw_cam, next_z, vp_size.x, vp_size.y)
	queue_redraw()

func _unhandled_input(event: InputEvent) -> void:
	if GameState.app_mode != "playing":
		return

	if event is InputEventKey and event.pressed:
		var ke := event as InputEventKey
		if ke.keycode == KEY_DELETE or ke.keycode == KEY_BACKSPACE:
			if not GameState.selected_node_ids.is_empty():
				GameState.dismantle_nodes(GameState.selected_node_ids)
			elif not GameState.selected_connection_id.is_empty():
				GameState.dismantle_connection(GameState.selected_connection_id)
			return
		if ke.keycode == KEY_Z and (ke.ctrl_pressed or ke.meta_pressed):
			if ke.shift_pressed:
				GameState.redo()
			else:
				GameState.undo()
			return
		if ke.keycode == KEY_Y and (ke.ctrl_pressed or ke.meta_pressed):
			GameState.redo()
			return

	# Multi-touch pinch zoom tracking on Android
	if event is InputEventScreenTouch:
		var te := event as InputEventScreenTouch
		if te.pressed:
			_active_touches[te.index] = te.position
			if _active_touches.size() == 2:
				var keys: Array = _active_touches.keys()
				var p0: Vector2 = _active_touches[keys[0]]
				var p1: Vector2 = _active_touches[keys[1]]
				_last_pinch_dist = maxf(10.0, p0.distance_to(p1))
				_last_pinch_mid = (p0 + p1) * 0.5
				_is_panning = false
				_dragging_node_id = ""
				return
			elif _active_touches.size() == 1:
				_on_pointer_down(te.position)
		else:
			_active_touches.erase(te.index)
			if _active_touches.is_empty():
				_on_pointer_up(te.position)
		return

	if event is InputEventScreenDrag:
		var de := event as InputEventScreenDrag
		_active_touches[de.index] = de.position
		if _active_touches.size() == 2:
			var keys: Array = _active_touches.keys()
			var p0: Vector2 = _active_touches[keys[0]]
			var p1: Vector2 = _active_touches[keys[1]]
			var dist: float = maxf(10.0, p0.distance_to(p1))
			var mid: Vector2 = (p0 + p1) * 0.5
			if _last_pinch_dist > 0.0:
				var ratio: float = dist / _last_pinch_dist
				var cur_z: float = float(GameState.camera.get("zoom", 0.74))
				apply_zoom_about_screen_point(cur_z * ratio, mid)
			_last_pinch_dist = dist
			_last_pinch_mid = mid
			return
		elif _active_touches.size() == 1:
			_on_pointer_move(de.position)
		return

	if event is InputEventMouseButton:
		var mb := event as InputEventMouseButton
		if mb.button_index == MOUSE_BUTTON_WHEEL_UP and mb.pressed:
			apply_zoom_about_screen_point(float(GameState.camera.get("zoom", 0.74)) * 1.12, mb.position)
			return
		if mb.button_index == MOUSE_BUTTON_WHEEL_DOWN and mb.pressed:
			apply_zoom_about_screen_point(float(GameState.camera.get("zoom", 0.74)) / 1.12, mb.position)
			return
		if mb.button_index == MOUSE_BUTTON_LEFT:
			if mb.pressed:
				_on_pointer_down(mb.position)
			else:
				_on_pointer_up(mb.position)
		return

	if event is InputEventMouseMotion:
		var mm := event as InputEventMouseMotion
		_on_pointer_move(mm.position)

func _on_pointer_down(screen_pt: Vector2) -> void:
	_pointer_down_screen = screen_pt
	_pan_last_screen = screen_pt
	_pointer_moved = false
	var w_pt: Vector2 = screen_to_world(screen_pt)
	_pointer_world = w_pt
	var zoom: float = float(GameState.camera.get("zoom", 0.74))

	# 1. Build placement mode
	if GameState.active_tool == "build" and not GameState.active_build_id.is_empty():
		var b_def: Dictionary = Catalog.BUILDINGS.get(GameState.active_build_id, {})
		if not b_def.is_empty():
			var bw: float = float(b_def.get("width", 268.0))
			var bh: float = float(b_def.get("height", 144.0))
			var snap_res: Dictionary = Router.compute_node_snap_alignment(
				GameState.active_build_id,
				w_pt.x - bw * 0.5,
				w_pt.y - bh * 0.5,
				bw,
				bh,
				GameState.nodes,
				[],
				bool(GameState.settings.get("snapToGrid", true))
			)
			var bx: float = float(snap_res.get("x", w_pt.x))
			var by: float = float(snap_res.get("y", w_pt.y))
			if Router.is_node_position_valid(GameState.active_build_id, bx, by, bw, bh, GameState.nodes):
				GameState.push_snapshot("Build " + str(b_def.get("name", "Machine")))
				var new_node: Dictionary = FactorySim.create_machine_node(GameState.active_build_id, bx, by)
				GameState.nodes.append(new_node)
				FactorySim.step_simulation(GameState.nodes, GameState.connections, 0.0)
				GameState.select_node(str(new_node["id"]))
				SynthAudio.play_sfx("place")
				GameState.state_changed.emit()
			else:
				SynthAudio.play_sfx("error")
		return

	# 2. Waypoint corner dot tool
	if GameState.active_tool == "waypoint":
		var wp_hit: Dictionary = _find_waypoint_at_world(w_pt, zoom)
		if not wp_hit.is_empty():
			GameState.push_snapshot("Move Belt Corner Dot")
			_dragging_waypoint_conn_id = str(wp_hit["connId"])
			_dragging_waypoint_idx = int(wp_hit["index"])
			return
		var belt_hit: Dictionary = _find_belt_at_world(w_pt, zoom)
		if not belt_hit.is_empty():
			GameState.push_snapshot("Add Belt Corner Dot")
			var conn: Dictionary = belt_hit["conn"]
			if not conn.has("waypoints") or not (conn["waypoints"] is Array):
				conn["waypoints"] = []
			var wps: Array = conn["waypoints"]
			var snapped_wp := Vector2(Catalog.snap_to_grid(w_pt.x, 12.0), Catalog.snap_to_grid(w_pt.y, 12.0))
			wps.append({"x": snapped_wp.x, "y": snapped_wp.y})
			_dragging_waypoint_conn_id = str(conn["id"])
			_dragging_waypoint_idx = wps.size() - 1
			GameState.select_connection(str(conn["id"]))
			SynthAudio.play_sfx("click")
			return

	# 3. Marquee multi-select tool
	if GameState.active_tool == "select":
		_is_marquee_selecting = true
		_marquee_start_world = w_pt
		_marquee_end_world = w_pt
		return

	# 4. Port hit check for wiring (in edit tool)
	if GameState.active_tool == "edit":
		var port_hit: Dictionary = _find_port_at_world(w_pt, zoom)
		if not port_hit.is_empty():
			if str(port_hit["side"]) == "output":
				_wiring_from_node_id = str(port_hit["nodeId"])
				_wiring_from_port_id = str(port_hit["portId"])
				_wiring_from_pos = port_hit["pos"]
				SynthAudio.play_sfx("click")
				return
			elif str(port_hit["side"]) == "input" and not _wiring_from_node_id.is_empty():
				_try_create_connection(_wiring_from_node_id, _wiring_from_port_id, str(port_hit["nodeId"]), str(port_hit["portId"]))
				_wiring_from_node_id = ""
				_wiring_from_port_id = ""
				return

	# 5. Node hit check
	var hit_node: Dictionary = _find_node_at_world(w_pt)
	if not hit_node.is_empty():
		var nid: String = str(hit_node["id"])
		var b_id: String = str(hit_node.get("buildingId", ""))
		# Check exterior Miner Mk.1 Standby switch hit
		if GameState.active_tool == "edit" and b_id == "miner_mk1" and not Catalog.is_macro_icon_zoom(zoom):
			if _is_point_on_miner_standby_switch(w_pt, hit_node):
				GameState.push_snapshot("Toggle Miner Standby")
				hit_node["standby"] = not bool(hit_node.get("standby", false))
				FactorySim.step_simulation(GameState.nodes, GameState.connections, 0.0)
				SynthAudio.play_sfx("click")
				GameState.state_changed.emit()
				return

		GameState.select_node(nid)
		if (GameState.active_tool == "move" or GameState.active_tool == "edit") and b_id != "resource_deposit":
			GameState.push_snapshot("Move " + str(hit_node.get("title", "Machine")))
			_dragging_node_id = nid
			_drag_offset_world = Vector2(w_pt.x - float(hit_node["x"]), w_pt.y - float(hit_node["y"]))
			return

	# 6. Belt hit check
	var hit_belt: Dictionary = _find_belt_at_world(w_pt, zoom)
	if not hit_belt.is_empty():
		var cid: String = str(hit_belt["conn"]["id"])
		GameState.select_connection(cid)
		SynthAudio.play_sfx("click")
		request_open_belt_inspector.emit(cid)
		return

	# 7. Empty space pan
	_wiring_from_node_id = ""
	_wiring_from_port_id = ""
	_is_panning = true

func _on_pointer_move(screen_pt: Vector2) -> void:
	if screen_pt.distance_to(_pointer_down_screen) > 6.0:
		_pointer_moved = true
	var w_pt: Vector2 = screen_to_world(screen_pt)
	_pointer_world = w_pt

	if not _dragging_waypoint_conn_id.is_empty():
		for c in GameState.connections:
			if str(c.get("id", "")) == _dragging_waypoint_conn_id:
				var wps: Array = c.get("waypoints", [])
				if _dragging_waypoint_idx >= 0 and _dragging_waypoint_idx < wps.size():
					wps[_dragging_waypoint_idx] = {
						"x": Catalog.snap_to_grid(w_pt.x, 12.0),
						"y": Catalog.snap_to_grid(w_pt.y, 12.0),
					}
				break
		queue_redraw()
		return

	if _is_marquee_selecting:
		_marquee_end_world = w_pt
		queue_redraw()
		return

	if not _dragging_node_id.is_empty() and _pointer_moved:
		for n in GameState.nodes:
			if str(n.get("id", "")) == _dragging_node_id:
				var raw_x: float = w_pt.x - _drag_offset_world.x
				var raw_y: float = w_pt.y - _drag_offset_world.y
				var nw: float = float(n.get("width", 268.0))
				var nh: float = float(n.get("height", 144.0))
				var b_id: String = str(n.get("buildingId", ""))
				var snap_res: Dictionary = Router.compute_node_snap_alignment(
					b_id,
					raw_x,
					raw_y,
					nw,
					nh,
					GameState.nodes,
					[_dragging_node_id],
					bool(GameState.settings.get("snapToGrid", true))
				)
				var sx: float = float(snap_res.get("x", raw_x))
				var sy: float = float(snap_res.get("y", raw_y))
				_active_guidelines = snap_res.get("guidelines", [])
				var valid: bool = Router.is_node_position_valid(b_id, sx, sy, nw, nh, GameState.nodes, [_dragging_node_id])
				_drag_has_collision = not valid
				if valid:
					n["x"] = sx
					n["y"] = sy
				break
		queue_redraw()
		return

	if _is_panning:
		var delta_s: Vector2 = screen_pt - _pan_last_screen
		_pan_last_screen = screen_pt
		var vp_size: Vector2 = get_viewport_rect().size
		var next_pos := Vector2(
			float(GameState.camera.get("x", -1820.0)) + delta_s.x,
			float(GameState.camera.get("y", -1920.0)) + delta_s.y
		)
		GameState.camera = Catalog.clamp_camera_to_world(
			next_pos,
			float(GameState.camera.get("zoom", 0.74)),
			vp_size.x,
			vp_size.y
		)
		queue_redraw()

func _on_pointer_up(screen_pt: Vector2) -> void:
	var w_pt: Vector2 = screen_to_world(screen_pt)
	var zoom: float = float(GameState.camera.get("zoom", 0.74))

	if not _dragging_waypoint_conn_id.is_empty():
		_dragging_waypoint_conn_id = ""
		_dragging_waypoint_idx = -1
		FactorySim.step_simulation(GameState.nodes, GameState.connections, 0.0)
		queue_redraw()
		return

	if _is_marquee_selecting:
		_is_marquee_selecting = false
		var min_x: float = minf(_marquee_start_world.x, _marquee_end_world.x)
		var max_x: float = maxf(_marquee_start_world.x, _marquee_end_world.x)
		var min_y: float = minf(_marquee_start_world.y, _marquee_end_world.y)
		var max_y: float = maxf(_marquee_start_world.y, _marquee_end_world.y)
		GameState.selected_node_ids.clear()
		for n in GameState.nodes:
			if str(n.get("buildingId", "")) == "resource_deposit":
				continue
			var nx: float = float(n.get("x", 0.0))
			var ny: float = float(n.get("y", 0.0))
			var nw: float = float(n.get("width", 268.0))
			var nh: float = float(n.get("height", 144.0))
			if nx + nw >= min_x and nx <= max_x and ny + nh >= min_y and ny <= max_y:
				GameState.selected_node_ids.append(str(n["id"]))
		if GameState.selected_node_ids.size() == 1:
			GameState.selected_node_id = GameState.selected_node_ids[0]
		GameState.selection_changed.emit()
		queue_redraw()
		return

	if not _wiring_from_node_id.is_empty() and _pointer_moved:
		var port_hit: Dictionary = _find_port_at_world(w_pt, zoom)
		if not port_hit.is_empty() and str(port_hit.get("side", "")) == "input":
			_try_create_connection(_wiring_from_node_id, _wiring_from_port_id, str(port_hit["nodeId"]), str(port_hit["portId"]))
			_wiring_from_node_id = ""
			_wiring_from_port_id = ""

	if not _dragging_node_id.is_empty():
		var tapped_id: String = _dragging_node_id
		_dragging_node_id = ""
		_active_guidelines.clear()
		_drag_has_collision = false
		FactorySim.step_simulation(GameState.nodes, GameState.connections, 0.0)
		if not _pointer_moved and GameState.active_tool == "edit":
			SynthAudio.play_sfx("click")
			request_open_node_inspector.emit(tapped_id)
		queue_redraw()
		return

	if _is_panning and not _pointer_moved:
		var hit_node: Dictionary = _find_node_at_world(w_pt)
		if not hit_node.is_empty() and GameState.active_tool == "edit":
			var nid: String = str(hit_node["id"])
			GameState.select_node(nid)
			SynthAudio.play_sfx("click")
			request_open_node_inspector.emit(nid)
		else:
			GameState.clear_selection()

	_is_panning = false
	_active_guidelines.clear()
	queue_redraw()

func _try_create_connection(from_node_id: String, from_port_id: String, to_node_id: String, to_port_id: String) -> void:
	if from_node_id == to_node_id:
		SynthAudio.play_sfx("error")
		return
	for c in GameState.connections:
		if str(c.get("fromNodeId", "")) == from_node_id and str(c.get("fromPortId", "")) == from_port_id:
			SynthAudio.play_sfx("error")
			return
		if str(c.get("toNodeId", "")) == to_node_id and str(c.get("toPortId", "")) == to_port_id:
			SynthAudio.play_sfx("error")
			return

	GameState.push_snapshot("Connect Conveyor Belt")
	var tier_def: Dictionary = Catalog.CONVEYOR_BELT_TIERS[GameState.active_belt_tier]
	var cap: float = float(tier_def.get("capacityPerMin", 60.0))
	var new_conn: Dictionary = {
		"id": "conn_%d_%d" % [Time.get_ticks_msec(), randi() % 10000],
		"fromNodeId": from_node_id,
		"fromPortId": from_port_id,
		"toNodeId": to_node_id,
		"toPortId": to_port_id,
		"beltTier": GameState.active_belt_tier,
		"itemName": "Iron Ore",
		"ratePerMin": cap,
		"maxCapacityPerMin": cap,
		"firstItemArrived": false,
		"waypoints": [],
		"inFlightItems": [],
	}
	GameState.connections.append(new_conn)
	FactorySim.step_simulation(GameState.nodes, GameState.connections, 0.0)
	SynthAudio.play_sfx("connect")
	GameState.state_changed.emit()

func _find_node_at_world(pt: Vector2) -> Dictionary:
	# Prefer non-deposit machines on top of deposits
	for i in range(GameState.nodes.size() - 1, -1, -1):
		var n: Dictionary = GameState.nodes[i]
		if str(n.get("buildingId", "")) == "resource_deposit":
			continue
		var rect := Rect2(float(n["x"]), float(n["y"]), float(n["width"]), float(n["height"]))
		if rect.has_point(pt):
			return n
	for i in range(GameState.nodes.size() - 1, -1, -1):
		var n: Dictionary = GameState.nodes[i]
		var rect := Rect2(float(n["x"]), float(n["y"]), float(n["width"]), float(n["height"]))
		if rect.has_point(pt):
			return n
	return {}

func _is_point_on_miner_standby_switch(pt: Vector2, node: Dictionary) -> bool:
	var nx: float = float(node.get("x", 0.0))
	var ny: float = float(node.get("y", 0.0))
	var nw: float = float(node.get("width", 268.0))
	var nh: float = float(node.get("height", 144.0))
	var sw_rect := Rect2(nx + nw * 0.77, ny + nh * 0.70, nw * 0.19, nh * 0.25)
	return sw_rect.has_point(pt)

func _find_port_at_world(pt: Vector2, zoom: float) -> Dictionary:
	var hit_r: float = 24.0 if Catalog.is_macro_icon_zoom(zoom) else 18.0
	for n in GameState.nodes:
		var nid: String = str(n.get("id", ""))
		var ins: Array = n.get("inputs", [])
		for i in range(ins.size()):
			var p_pos: Vector2 = Catalog.get_port_world_position(n, "input", i, ins.size())
			if pt.distance_to(p_pos) <= hit_r:
				return {"nodeId": nid, "portId": str(ins[i]["id"]), "side": "input", "pos": p_pos}
		var outs: Array = n.get("outputs", [])
		for i in range(outs.size()):
			var p_pos: Vector2 = Catalog.get_port_world_position(n, "output", i, outs.size())
			if pt.distance_to(p_pos) <= hit_r:
				return {"nodeId": nid, "portId": str(outs[i]["id"]), "side": "output", "pos": p_pos}
	return {}

func _find_belt_at_world(pt: Vector2, zoom: float) -> Dictionary:
	var threshold: float = 22.0 / maxf(0.2, minf(1.0, zoom))
	for c in GameState.connections:
		var pts: Array = c.get("_cachedPoints", [])
		if pts.size() >= 2:
			var typed_pts: Array[Vector2] = []
			for v in pts:
				typed_pts.append(v as Vector2)
			var res: Dictionary = Router.distance_point_to_polyline(pt, typed_pts)
			if float(res.get("dist", INF)) <= threshold:
				return {"conn": c, "point": res["point"]}
	return {}

func _find_waypoint_at_world(pt: Vector2, zoom: float) -> Dictionary:
	var hit_r: float = 18.0 / maxf(0.25, minf(1.0, zoom))
	for c in GameState.connections:
		var wps: Array = c.get("waypoints", [])
		for i in range(wps.size()):
			var wp_pt := Vector2(float(wps[i].get("x", 0.0)), float(wps[i].get("y", 0.0)))
			if pt.distance_to(wp_pt) <= hit_r:
				return {"connId": str(c["id"]), "index": i}
	return {}

func _draw() -> void:
	var vp_size: Vector2 = get_viewport_rect().size
	if vp_size.x <= 0.0 or vp_size.y <= 0.0:
		return

	var cam_x: float = float(GameState.camera.get("x", -1820.0))
	var cam_y: float = float(GameState.camera.get("y", -1920.0))
	var cam_z: float = clampf(float(GameState.camera.get("zoom", 0.74)), Catalog.MIN_ZOOM, Catalog.MAX_ZOOM)
	GameState.camera["zoom"] = cam_z

	# Deep Void background
	draw_rect(Rect2(Vector2.ZERO, vp_size), Color("#06090F"), true)

	draw_set_transform(Vector2(cam_x, cam_y), 0.0, Vector2(cam_z, cam_z))

	var view_min_x: float = -cam_x / cam_z - VIEWPORT_CULL_MARGIN
	var view_max_x: float = (-cam_x + vp_size.x) / cam_z + VIEWPORT_CULL_MARGIN
	var view_min_y: float = -cam_y / cam_z - VIEWPORT_CULL_MARGIN
	var view_max_y: float = (-cam_y + vp_size.y) / cam_z + VIEWPORT_CULL_MARGIN

	# Sector 01 Surface Fill & Border
	draw_rect(Rect2(0.0, 0.0, Catalog.WORLD_WIDTH, Catalog.WORLD_HEIGHT), Color("#0B0F17"), true)

	var macro: bool = Catalog.is_macro_icon_zoom(cam_z)
	var font: Font = ThemeDB.fallback_font

	# Blueprint Grid (LOD culled for low-end Android GPUs)
	if cam_z >= 0.14:
		var step: float = 120.0
		var gx0: float = maxf(0.0, floorf(view_min_x / step) * step)
		var gx1: float = minf(Catalog.WORLD_WIDTH, ceilf(view_max_x / step) * step)
		var gy0: float = maxf(0.0, floorf(view_min_y / step) * step)
		var gy1: float = minf(Catalog.WORLD_HEIGHT, ceilf(view_max_y / step) * step)
		var x: float = gx0
		while x <= gx1:
			draw_line(Vector2(x, gy0), Vector2(x, gy1), Color(1, 1, 1, 0.035), 1.0 / cam_z)
			x += step
		var y: float = gy0
		while y <= gy1:
			draw_line(Vector2(gx0, y), Vector2(gx1, y), Color(1, 1, 1, 0.035), 1.0 / cam_z)
			y += step

	draw_rect(Rect2(0.0, 0.0, Catalog.WORLD_WIDTH, Catalog.WORLD_HEIGHT), Color("#F59E0B"), false, maxf(2.0, 2.5 / cam_z))

	# 1. Draw Resource Deposits
	for n in GameState.nodes:
		if str(n.get("buildingId", "")) != "resource_deposit":
			continue
		var nx: float = float(n.get("x", 0.0))
		var ny: float = float(n.get("y", 0.0))
		var nw: float = float(n.get("width", 268.0))
		var nh: float = float(n.get("height", 144.0))
		if nx + nw < view_min_x or nx > view_max_x or ny + nh < view_min_y or ny > view_max_y:
			continue
		_draw_deposit_node(n, macro, cam_z, font)

	# 2. Draw Conveyor Belts & Discrete Item Packets
	for conn in GameState.connections:
		_draw_conveyor_connection(conn, macro, cam_z, font)

	# 3. Draw Live Wiring Preview
	if not _wiring_from_node_id.is_empty():
		var preview_pts: Array[Vector2] = Router.compute_orthogonal_segment(_wiring_from_pos, _pointer_world, true)
		for i in range(preview_pts.size() - 1):
			draw_line(preview_pts[i], preview_pts[i + 1], Color("#F59E0B"), 4.0 / minf(1.0, cam_z))

	# 4. Draw Machine Nodes (Miners, Smelters, Constructors, Assemblers, Logistics, HUB)
	for n in GameState.nodes:
		if str(n.get("buildingId", "")) == "resource_deposit":
			continue
		var nx: float = float(n.get("x", 0.0))
		var ny: float = float(n.get("y", 0.0))
		var nw: float = float(n.get("width", 268.0))
		var nh: float = float(n.get("height", 144.0))
		if nx + nw < view_min_x or nx > view_max_x or ny + nh < view_min_y or ny > view_max_y:
			continue
		_draw_machine_node(n, macro, cam_z, font)

	# 5. Draw Snap Alignment Laser Guidelines
	for g in _active_guidelines:
		var p1 := Vector2(float(g.get("x1", 0.0)), float(g.get("y1", 0.0)))
		var p2 := Vector2(float(g.get("x2", 0.0)), float(g.get("y2", 0.0)))
		draw_line(p1, p2, Color("#38BDF8"), 2.0 / minf(1.0, cam_z))

	# 6. Draw Marquee Selection Box
	if _is_marquee_selecting:
		var r_pos := Vector2(minf(_marquee_start_world.x, _marquee_end_world.x), minf(_marquee_start_world.y, _marquee_end_world.y))
		var r_size := Vector2(absf(_marquee_end_world.x - _marquee_start_world.x), absf(_marquee_end_world.y - _marquee_start_world.y))
		draw_rect(Rect2(r_pos, r_size), Color(0.22, 0.74, 0.97, 0.15), true)
		draw_rect(Rect2(r_pos, r_size), Color("#38BDF8"), false, 2.0 / minf(1.0, cam_z))

func _draw_deposit_node(n: Dictionary, macro: bool, cam_z: float, font: Font) -> void:
	var nx: float = float(n.get("x", 0.0))
	var ny: float = float(n.get("y", 0.0))
	var nw: float = float(n.get("width", 268.0))
	var nh: float = float(n.get("height", 144.0))
	var purity_key: String = str(n.get("purity", "normal"))
	var p_cfg: Dictionary = Catalog.PURITY_CONFIG.get(purity_key, Catalog.PURITY_CONFIG["normal"])
	var badge_col: Color = p_cfg.get("badgeColor", Color("#F97316"))
	var center := Vector2(nx + nw * 0.5, ny + nh * 0.5)

	if macro:
		var r: float = maxf(26.0, 12.0 / cam_z)
		draw_circle(center, r, Color("#111827"))
		draw_arc(center, r, 0.0, TAU, 24, badge_col, maxf(4.0, 2.2 / cam_z))
		return

	draw_rect(Rect2(nx + 12.0, ny + 12.0, nw - 24.0, nh - 24.0), Color(0.08, 0.12, 0.16, 0.85), true)
	draw_rect(Rect2(nx + 12.0, ny + 12.0, nw - 24.0, nh - 24.0), badge_col, false, 2.5)

	var recipe_id: String = str(n.get("recipeId", "deposit_iron"))
	var item_key: String = "iron_ore"
	if recipe_id == "deposit_copper":
		item_key = "copper_ore"
	elif recipe_id == "deposit_limestone":
		item_key = "limestone"
	var tex: Texture2D = Catalog.get_item_texture(item_key)
	if tex:
		draw_texture_rect(tex, Rect2(nx + 24.0, ny + 32.0, 56.0, 56.0), false)

	draw_string(font, Vector2(nx + 92.0, ny + 56.0), str(n.get("title", "Resource Deposit")), HORIZONTAL_ALIGNMENT_LEFT, -1, 15, Color("#F8FAFC"))
	draw_string(font, Vector2(nx + 92.0, ny + 82.0), "%s · %d/m base" % [str(p_cfg.get("label", "NORMAL")), int(p_cfg.get("ratePerMin", 60.0))], HORIZONTAL_ALIGNMENT_LEFT, -1, 13, badge_col)

func _draw_conveyor_connection(conn: Dictionary, macro: bool, cam_z: float, font: Font) -> void:
	var pts: Array = conn.get("_cachedPoints", [])
	if pts.size() < 2:
		return
	var tier_num: int = clampi(int(conn.get("beltTier", 1)), 1, 6)
	var tier_def: Dictionary = Catalog.CONVEYOR_BELT_TIERS[tier_num]
	var accent: Color = tier_def.get("accentColor", Color("#94A3B8"))
	var is_sel: bool = str(conn.get("id", "")) == GameState.selected_connection_id

	var typed_pts: Array[Vector2] = []
	for p in pts:
		typed_pts.append(p as Vector2)

	for i in range(typed_pts.size() - 1):
		var a: Vector2 = typed_pts[i]
		var b: Vector2 = typed_pts[i + 1]
		draw_line(a, b, Color("#0F172A"), 18.0 if not macro else maxf(6.0, 4.0 / cam_z))
		draw_line(a, b, Color("#F59E0B") if is_sel else accent, 11.0 if not macro else maxf(3.0, 2.2 / cam_z))

	# Draw discrete items moving on the belt
	if not macro and cam_z >= 0.32:
		var items: Array = conn.get("inFlightItems", [])
		for pkt in items:
			var prog: float = float(pkt.get("progress", 0.0))
			var sample: Dictionary = Router.sample_polyline(typed_pts, prog)
			var pos: Vector2 = sample["pos"]
			var item_name: String = str(pkt.get("itemName", conn.get("itemName", "Iron Ore")))
			var tex: Texture2D = Catalog.get_item_texture(item_name)
			if tex:
				draw_texture_rect(tex, Rect2(pos.x - 10.0, pos.y - 10.0, 20.0, 20.0), false)
			else:
				draw_circle(pos, 7.0, Catalog.get_item_accent_color(item_name))

	# Draw 90° corner dot handles when Waypoint tool active or belt selected
	if GameState.active_tool == "waypoint" or is_sel:
		var wps: Array = conn.get("waypoints", [])
		for wp in wps:
			var wp_pos := Vector2(float(wp.get("x", 0.0)), float(wp.get("y", 0.0)))
			draw_circle(wp_pos, 9.0, Color("#0B0F17"))
			draw_arc(wp_pos, 9.0, 0.0, TAU, 16, Color("#38BDF8"), 2.5)

	# Draw throughput pill at belt midpoint
	if not macro and cam_z >= 0.45:
		var mid_sample: Dictionary = Router.sample_polyline(typed_pts, 0.5)
		var mid_pos: Vector2 = mid_sample["pos"]
		var rate_val: int = int(roundf(float(conn.get("ratePerMin", 0.0))))
		var cap_val: int = int(roundf(float(conn.get("maxCapacityPerMin", 60.0))))
		var suffix: String = "/m" if str(GameState.settings.get("rateDisplayFormat", "per_minute")) == "compact" else " per minute"
		var label: String = "%d/%d%s" % [rate_val, cap_val, suffix]
		draw_rect(Rect2(mid_pos.x - 54.0, mid_pos.y - 24.0, 108.0, 20.0), Color(0.04, 0.06, 0.09, 0.92), true)
		draw_string(font, Vector2(mid_pos.x - 48.0, mid_pos.y - 10.0), label, HORIZONTAL_ALIGNMENT_LEFT, -1, 11, accent)

func _draw_machine_node(n: Dictionary, macro: bool, cam_z: float, font: Font) -> void:
	var nx: float = float(n.get("x", 0.0))
	var ny: float = float(n.get("y", 0.0))
	var nw: float = float(n.get("width", 268.0))
	var nh: float = float(n.get("height", 144.0))
	var nid: String = str(n.get("id", ""))
	var b_id: String = str(n.get("buildingId", ""))
	var b_def: Dictionary = Catalog.BUILDINGS.get(b_id, {})
	var accent: Color = b_def.get("accentColor", Color("#F59E0B"))
	var is_sel: bool = nid == GameState.selected_node_id or GameState.selected_node_ids.has(nid)

	if macro:
		draw_rect(Rect2(nx, ny, nw, nh), Color("#151C28"), true)
		draw_rect(Rect2(nx, ny, nw, nh), Color("#F59E0B") if is_sel else accent, false, maxf(4.0, 2.5 / cam_z))
		var b_tex: Texture2D = Catalog.get_building_texture(b_id)
		if b_tex:
			draw_texture_rect(b_tex, Rect2(nx + nw * 0.5 - 36.0, ny + nh * 0.5 - 36.0, 72.0, 72.0), false)
		return

	# Authentic Exterior Miner Mk.1 Card (with Miner Mk.1 Build Icon in top-left bay + clickable Standby switch)
	if b_id == "miner_mk1":
		draw_rect(Rect2(nx, ny, nw, nh), Color("#4A4F57"), true)
		draw_rect(Rect2(nx, ny, nw, nh), Color("#38BDF8") if is_sel else Color("#20242A"), false, 3.0 if is_sel else 2.0)

		# Top-left bay recessed housing + Miner Mk.1 Build Menu Icon
		var bay_rect := Rect2(nx + nw * 0.06, ny + nh * 0.11, nw * 0.40, nh * 0.50)
		draw_rect(bay_rect, Color("#14181F"), true)
		draw_rect(bay_rect, Color("#F59E0B", 0.45), false, 1.5)
		var miner_tex: Texture2D = Catalog.get_building_texture("miner_mk1")
		if miner_tex:
			draw_texture_rect(miner_tex, Rect2(bay_rect.position.x + 14.0, bay_rect.position.y + 4.0, bay_rect.size.x - 28.0, bay_rect.size.y - 8.0), false)

		# Central black status monitor
		var mon_rect := Rect2(nx + nw * 0.48, ny + nh * 0.06, nw * 0.25, nh * 0.60)
		draw_rect(mon_rect, Color("#0D1117"), true)
		var is_stby: bool = bool(n.get("standby", false))
		var status_str: String = "Standby" if is_stby else ("Mining" if str(n.get("status", "")) == "running" else "Paused")
		var status_col: Color = Color("#EF4444") if is_stby else Color("#FACC15")
		draw_circle(Vector2(mon_rect.position.x + 14.0, mon_rect.position.y + 18.0), 4.5, status_col)
		draw_string(font, Vector2(mon_rect.position.x + 24.0, mon_rect.position.y + 22.0), status_str, HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color("#F8FAFC"))

		var clock_pct: float = float(n.get("overclock", 100.0))
		var mw_val: float = Catalog.get_building_power_mw("miner_mk1", clock_pct, is_stby)
		var eff_val: int = int(roundf(float(n.get("efficiency", 0.0))))
		draw_string(font, Vector2(mon_rect.position.x + 6.0, mon_rect.position.y + 52.0), "%.1f MW · %d%%" % [mw_val, eff_val], HORIZONTAL_ALIGNMENT_LEFT, -1, 10, Color("#FACC15"))

		# Right-side Output Card
		var out_rect := Rect2(nx + nw * 0.75, ny + nh * 0.10, nw * 0.19, nh * 0.56)
		draw_rect(out_rect, Color("#F1F5F9"), true)
		var outs: Array = n.get("outputs", [])
		var out_item: String = str(outs[0].get("itemName", "Iron Ore")) if outs.size() > 0 else "Iron Ore"
		var out_rate: float = float(outs[0].get("ratePerMin", 60.0)) if outs.size() > 0 else 60.0
		var item_tex: Texture2D = Catalog.get_item_texture(out_item)
		if item_tex:
			draw_texture_rect(item_tex, Rect2(out_rect.position.x + 8.0, out_rect.position.y + 4.0, 34.0, 34.0), false)
		draw_rect(Rect2(out_rect.position.x + 22.0, out_rect.position.y + 28.0, 26.0, 13.0), Color("#E5941A"), true)
		draw_string(font, Vector2(out_rect.position.x + 25.0, out_rect.position.y + 38.0), str(int(n.get("outputStorage", 0))), HORIZONTAL_ALIGNMENT_LEFT, -1, 10, Color("#FFFFFF"))
		draw_string(font, Vector2(out_rect.position.x + 4.0, out_rect.position.y + 66.0), "%d/m" % int(roundf(out_rate)), HORIZONTAL_ALIGNMENT_LEFT, -1, 10, Color("#D97706"))

		# Bottom-left Clock Speed Bar (0% - 250%)
		var oc_rect := Rect2(nx + nw * 0.06, ny + nh * 0.70, nw * 0.68, nh * 0.24)
		draw_rect(oc_rect, Color("#F8FAFC"), true)
		draw_string(font, Vector2(oc_rect.position.x + 6.0, oc_rect.position.y + 13.0), "Clock Speed: %d%%" % int(roundf(clock_pct)), HORIZONTAL_ALIGNMENT_LEFT, -1, 10, Color("#0F172A"))
		var fill_ratio: float = clampf(clock_pct / 250.0, 0.0, 1.0)
		draw_rect(Rect2(oc_rect.position.x + 6.0, oc_rect.position.y + 18.0, (oc_rect.size.x - 12.0) * fill_ratio, 10.0), Color("#E5941A"), true)

		# Bottom-right Standby Rocker Switch
		var sw_rect := Rect2(nx + nw * 0.78, ny + nh * 0.72, nw * 0.16, nh * 0.18)
		draw_rect(sw_rect, Color("#1E293B"), true)
		draw_rect(Rect2(sw_rect.position.x + 2.0, sw_rect.position.y + 2.0, sw_rect.size.x * 0.45, sw_rect.size.y - 4.0), Color("#EF4444") if not is_stby else Color("#334155"), true)
		draw_string(font, Vector2(sw_rect.position.x + 4.0, sw_rect.position.y + sw_rect.size.y + 10.0), "STANDBY", HORIZONTAL_ALIGNMENT_LEFT, -1, 8, Color("#E2E8F0"))
	else:
		# Standard Processor / Logistics Card
		draw_rect(Rect2(nx, ny, nw, nh), Color("#161F30"), true)
		draw_rect(Rect2(nx, ny, nw, nh), Color("#F59E0B") if is_sel else accent, false, 3.0 if is_sel else 2.0)
		draw_rect(Rect2(nx, ny, nw, 28.0), Color(accent.r, accent.g, accent.b, 0.18), true)

		var b_tex: Texture2D = Catalog.get_building_texture(b_id)
		if b_tex:
			draw_texture_rect(b_tex, Rect2(nx + 12.0, ny + 36.0, 48.0, 48.0), false)

		draw_string(font, Vector2(nx + 12.0, ny + 20.0), str(n.get("title", "Machine")), HORIZONTAL_ALIGNMENT_LEFT, -1, 14, Color("#F8FAFC"))
		var clock_pct: int = int(roundf(float(n.get("overclock", 100.0))))
		var eff_pct: int = int(roundf(float(n.get("efficiency", 0.0))))
		draw_string(font, Vector2(nx + 70.0, ny + 56.0), "%d%% Clock · %d%% Eff" % [clock_pct, eff_pct], HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color("#94A3B8"))
		draw_string(font, Vector2(nx + 70.0, ny + 80.0), "In: %d  Out: %d" % [int(n.get("storage", 0)), int(n.get("outputStorage", 0))], HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color("#F59E0B"))

	# Draw Input & Output Ports
	var ins: Array = n.get("inputs", [])
	for i in range(ins.size()):
		var p_pos: Vector2 = Catalog.get_port_world_position(n, "input", i, ins.size())
		draw_circle(p_pos, 9.0, Color("#0B0F17"))
		draw_arc(p_pos, 9.0, 0.0, TAU, 16, Color("#38BDF8"), 2.5)

	var outs: Array = n.get("outputs", [])
	for i in range(outs.size()):
		var p_pos: Vector2 = Catalog.get_port_world_position(n, "output", i, outs.size())
		draw_circle(p_pos, 9.0, Color("#0B0F17"))
		draw_arc(p_pos, 9.0, 0.0, TAU, 16, Color("#F59E0B"), 2.5)
