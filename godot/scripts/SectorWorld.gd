extends Node2D
## ============================================================================
## FICSIT Labs — 1:1 Hardware-Batched 2D Sector World Renderer & Touch Controller
## Ported directly from src/components/canvasRenderer.ts, canvasNodeRenderer.ts,
## and canvasArtwork.ts
## ============================================================================

signal request_open_node_inspector(node_id: String)
signal request_open_belt_inspector(conn_id: String)

const VIEWPORT_CULL_MARGIN: float = 280.0

const TOPOGRAPHIC_RIDGE_CENTERS: Array[Vector3] = [
	Vector3(960.0, 1560.0, 620.0),
	Vector3(520.0, 3480.0, 740.0),
	Vector3(2260.0, 1080.0, 680.0),
	Vector3(3640.0, 1420.0, 760.0),
	Vector3(2620.0, 2960.0, 860.0),
	Vector3(3620.0, 3620.0, 720.0),
	Vector3(6420.0, 1360.0, 820.0),
	Vector3(6140.0, 4060.0, 760.0),
	Vector3(3240.0, 6060.0, 820.0),
	Vector3(9280.0, 2260.0, 840.0),
	Vector3(9640.0, 5320.0, 880.0),
]

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
var _pointer_world: Vector2 = Vector2(2800.0, 2850.0)
var _has_pointer_world: bool = false

var _is_marquee_selecting: bool = false
var _marquee_start_world: Vector2 = Vector2.ZERO
var _marquee_end_world: Vector2 = Vector2.ZERO

var _dragging_waypoint_conn_id: String = ""
var _dragging_waypoint_idx: int = -1

var _elapsed_time: float = 0.0
var modal_blocker_active: bool = false

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
	if GameState.app_mode != "playing" or modal_blocker_active:
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

	# Track raw multi-touch points for 2-finger pinch-zoom on Android.
	# Single-finger taps/drags are handled via InputEventMouseButton/Motion
	# (emulate_mouse_from_touch=true) so GUI Controls naturally consume HUD clicks first.
	if event is InputEventScreenTouch:
		var te := event as InputEventScreenTouch
		if te.pressed:
			_active_touches[te.index] = te.position
			if _active_touches.size() >= 2:
				var keys: Array = _active_touches.keys()
				var p0: Vector2 = _active_touches[keys[0]]
				var p1: Vector2 = _active_touches[keys[1]]
				_last_pinch_dist = maxf(10.0, p0.distance_to(p1))
				_last_pinch_mid = (p0 + p1) * 0.5
				_is_panning = false
				_dragging_node_id = ""
				_is_marquee_selecting = false
		else:
			_active_touches.erase(te.index)
			if _active_touches.size() < 2:
				_last_pinch_dist = 0.0
		return

	if event is InputEventScreenDrag:
		var de := event as InputEventScreenDrag
		_active_touches[de.index] = de.position
		if _active_touches.size() >= 2:
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

	if _active_touches.size() >= 2:
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
	_has_pointer_world = true
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
			var is_valid: bool = Router.is_node_position_valid(GameState.active_build_id, bx, by, bw, bh, GameState.nodes)
			if GameState.active_build_id == "miner_mk1":
				var dep: Dictionary = Router.find_underlying_deposit_for_miner(bx, by, bw, bh, GameState.nodes)
				if dep.is_empty():
					is_valid = false
			if is_valid:
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
	_has_pointer_world = true

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
		FactorySim.step_simulation(GameState.nodes, GameState.connections, 0.0)
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
				if b_id == "miner_mk1":
					var dep: Dictionary = Router.find_underlying_deposit_for_miner(sx, sy, nw, nh, GameState.nodes)
					if dep.is_empty():
						valid = false
				_drag_has_collision = not valid
				if valid:
					n["x"] = sx
					n["y"] = sy
				break
		FactorySim.step_simulation(GameState.nodes, GameState.connections, 0.0)
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
			var b_id: String = str(hit_node.get("buildingId", ""))
			GameState.select_node(nid)
			SynthAudio.play_sfx("click")
			if b_id != "resource_deposit":
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
	var sw_rect := Rect2(nx + nw * 0.78, ny + nh * 0.69, nw * 0.16, nh * 0.20)
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

# ============================================================================
# GEOMETRY & ROUNDED SHAPE HELPERS
# ============================================================================
func _draw_rounded_box(rect: Rect2, radius: float, fill_col: Color, border_col: Color = Color.TRANSPARENT, border_width: float = 0.0) -> void:
	var sb := StyleBoxFlat.new()
	sb.bg_color = fill_col
	var r_int: int = int(roundf(radius))
	sb.set_corner_radius_all(r_int)
	if border_width > 0.0 and border_col.a > 0.0:
		sb.border_color = border_col
		sb.set_border_width_all(maxi(1, int(roundf(border_width))))
	draw_style_box(sb, rect)

func _draw_ellipse_filled(center: Vector2, rx: float, ry: float, fill_col: Color, stroke_col: Color = Color.TRANSPARENT, stroke_w: float = 1.0, segments: int = 28) -> void:
	var pts := PackedVector2Array()
	for i in range(segments):
		var a: float = (float(i) / float(segments)) * TAU
		pts.append(Vector2(center.x + cos(a) * rx, center.y + sin(a) * ry))
	if fill_col.a > 0.0:
		draw_colored_polygon(pts, fill_col)
	if stroke_col.a > 0.0 and stroke_w > 0.0:
		pts.append(pts[0])
		draw_polyline(pts, stroke_col, stroke_w)

func _format_rate_text(rate_val: float) -> String:
	var clean_num: String = str(int(roundf(rate_val))) if is_equal_approx(rate_val, roundf(rate_val)) else ("%.1f" % rate_val)
	var is_compact: bool = str(GameState.settings.get("rateDisplayFormat", "per_minute")) == "compact"
	return ("%s/m" % clean_num) if is_compact else ("%s per minute" % clean_num)

# ============================================================================
# MAIN HARDWARE-BATCHED CANVAS DRAW PASS
# ============================================================================
func _draw() -> void:
	var vp_size: Vector2 = get_viewport_rect().size
	if vp_size.x <= 0.0 or vp_size.y <= 0.0:
		return

	var cam_x: float = float(GameState.camera.get("x", -1820.0))
	var cam_y: float = float(GameState.camera.get("y", -1920.0))
	var cam_z: float = clampf(float(GameState.camera.get("zoom", 0.74)), Catalog.MIN_ZOOM, Catalog.MAX_ZOOM)
	GameState.camera["zoom"] = cam_z

	var is_battery_saver: bool = str(GameState.settings.get("performanceMode", "60fps")) == "battery_saver"

	# 1. Outer Void Fill
	draw_rect(Rect2(Vector2.ZERO, vp_size), Color("#06090F"), true)

	draw_set_transform(Vector2(cam_x, cam_y), 0.0, Vector2(cam_z, cam_z))

	var view_min_x: float = -cam_x / cam_z - VIEWPORT_CULL_MARGIN
	var view_max_x: float = (-cam_x + vp_size.x) / cam_z + VIEWPORT_CULL_MARGIN
	var view_min_y: float = -cam_y / cam_z - VIEWPORT_CULL_MARGIN
	var view_max_y: float = (-cam_y + vp_size.y) / cam_z + VIEWPORT_CULL_MARGIN

	# 2. Sector 01 Surface Fill
	draw_rect(Rect2(0.0, 0.0, Catalog.WORLD_WIDTH, Catalog.WORLD_HEIGHT), Color("#0B0F17"), true)

	# 3. Topographic Terrain Ridge Contours & West Oasis Pond (ported from canvasRenderer.ts)
	for ridge in TOPOGRAPHIC_RIDGE_CENTERS:
		var rx: float = ridge.x
		var ry: float = ridge.y
		var rad: float = ridge.z
		if rx + rad < view_min_x or rx - rad > view_max_x or ry + rad < view_min_y or ry - rad > view_max_y:
			continue
		var scales: Array[float] = [1.0, 0.68, 0.38]
		var fills: Array[Color] = [Color("#0E1522"), Color("#111A2B"), Color("#142034")]
		for tier_i in range(3):
			var r_val: float = rad * scales[tier_i]
			_draw_ellipse_filled(
				Vector2(rx, ry),
				r_val * 1.18,
				r_val * 0.86,
				fills[tier_i],
				Color(0.118, 0.161, 0.231, 0.72),
				maxf(1.2, 1.0 / cam_z)
			)

	if 1380.0 + 480.0 >= view_min_x and 1380.0 - 480.0 <= view_max_x and 3360.0 + 380.0 >= view_min_y and 3360.0 - 380.0 <= view_max_y:
		_draw_ellipse_filled(
			Vector2(1380.0, 3360.0),
			440.0,
			320.0,
			Color(0.055, 0.455, 0.565, 0.16),
			Color(0.031, 0.569, 0.698, 0.38),
			maxf(1.5, 1.2 / cam_z)
		)

	var macro: bool = Catalog.is_macro_icon_zoom(cam_z)
	var font: Font = ThemeDB.fallback_font

	# 4. Minor (24px) & Major (96px) Blueprint Grid Lines
	var minor_grid: float = 24.0
	var major_grid: float = 96.0
	var start_x: float = maxf(0.0, floorf(view_min_x / minor_grid) * minor_grid)
	var end_x: float = minf(Catalog.WORLD_WIDTH, ceilf(view_max_x / minor_grid) * minor_grid)
	var start_y: float = maxf(0.0, floorf(view_min_y / minor_grid) * minor_grid)
	var end_y: float = minf(Catalog.WORLD_HEIGHT, ceilf(view_max_y / minor_grid) * minor_grid)

	if not is_battery_saver and cam_z >= 0.48:
		var gx: float = start_x
		while gx <= end_x:
			draw_line(Vector2(gx, start_y), Vector2(gx, end_y), Color("#131B2A"), 1.0)
			gx += minor_grid
		var gy: float = start_y
		while gy <= end_y:
			draw_line(Vector2(start_x, gy), Vector2(end_x, gy), Color("#131B2A"), 1.0)
			gy += minor_grid

	if cam_z >= 0.14:
		var maj_start_x: float = maxf(0.0, floorf(view_min_x / major_grid) * major_grid)
		var maj_start_y: float = maxf(0.0, floorf(view_min_y / major_grid) * major_grid)
		var mx: float = maj_start_x
		while mx <= end_x:
			draw_line(Vector2(mx, start_y), Vector2(mx, end_y), Color("#1B263B"), 1.0 / minf(1.0, cam_z))
			mx += major_grid
		var my: float = maj_start_y
		while my <= end_y:
			draw_line(Vector2(start_x, my), Vector2(end_x, my), Color("#1B263B"), 1.0 / minf(1.0, cam_z))
			my += major_grid

	# 5. Sector Perimeter Border & Label
	draw_rect(Rect2(0.0, 0.0, Catalog.WORLD_WIDTH, Catalog.WORLD_HEIGHT), Color(0.96, 0.62, 0.04, 0.45), false, 3.0 / minf(1.0, cam_z))
	draw_string(font, Vector2(20.0, 28.0), "SECTOR 01 BOUNDARY (12000 × 8000)", HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color(0.96, 0.62, 0.04, 0.65))

	# 6. Draw Resource Deposits (Natural Geological Outcrops or Macro Map Pins)
	for n in GameState.nodes:
		if str(n.get("buildingId", "")) != "resource_deposit":
			continue
		var nx: float = float(n.get("x", 0.0))
		var ny: float = float(n.get("y", 0.0))
		var nw: float = float(n.get("width", 268.0))
		var nh: float = float(n.get("height", 144.0))
		if nx + nw < view_min_x or nx > view_max_x or ny + nh < view_min_y or ny > view_max_y:
			continue
		_draw_deposit_node(n, macro, cam_z, is_battery_saver, font)

	# 7. Draw Conveyor Belts, Rollers, Overpass Bridges, Item Packets & Badges
	var visible_routes: Array[Dictionary] = []
	for conn in GameState.connections:
		var route_info: Dictionary = _draw_conveyor_connection(conn, macro, cam_z, is_battery_saver, font)
		if not route_info.is_empty():
			visible_routes.append(route_info)

	if not macro and visible_routes.size() > 1:
		_draw_belt_overpass_bridges(visible_routes)

	if not macro:
		for r_info in visible_routes:
			_draw_in_flight_belt_items(r_info["conn"], r_info["points"], font)
		for r_info in visible_routes:
			_draw_conveyor_badge(r_info["conn"], r_info["points"], cam_z, font)

	# 8. Draw Live Wiring Preview
	if not _wiring_from_node_id.is_empty():
		var preview_pts: Array[Vector2] = Router.compute_orthogonal_segment(_wiring_from_pos, _pointer_world, true)
		var tier_def: Dictionary = Catalog.CONVEYOR_BELT_TIERS[GameState.active_belt_tier]
		var t_col: Color = tier_def.get("accentColor", Color("#38BDF8"))
		for i in range(preview_pts.size() - 1):
			draw_line(preview_pts[i], preview_pts[i + 1], Color(0.06, 0.09, 0.16, 0.85), 14.0)
			draw_line(preview_pts[i], preview_pts[i + 1], t_col, 3.5)
		draw_circle(_pointer_world, 6.0, t_col)

	# 9. Draw Machine Nodes (Miner Mk.1, Smelter, Constructor, Assembler, Splitter, Merger, Storage, HUB)
	for n in GameState.nodes:
		if str(n.get("buildingId", "")) == "resource_deposit":
			continue
		var nx: float = float(n.get("x", 0.0))
		var ny: float = float(n.get("y", 0.0))
		var nw: float = float(n.get("width", 268.0))
		var nh: float = float(n.get("height", 144.0))
		if nx + nw < view_min_x or nx > view_max_x or ny + nh < view_min_y or ny > view_max_y:
			continue
		_draw_machine_node(n, macro, cam_z, is_battery_saver, font)

	# 10. Draw Ghost Placement Hologram when in Build Mode
	if GameState.active_tool == "build" and not GameState.active_build_id.is_empty() and _has_pointer_world:
		_draw_ghost_placement_preview(cam_z, font)

	# 11. Draw Snap Alignment Laser Guidelines
	for g in _active_guidelines:
		var p1 := Vector2(float(g.get("x1", 0.0)), float(g.get("y1", 0.0)))
		var p2 := Vector2(float(g.get("x2", 0.0)), float(g.get("y2", 0.0)))
		var g_col: Color = Color("#F59E0B") if str(g.get("kind", "")) == "port" else Color("#38BDF8")
		draw_line(p1, p2, g_col, 2.0 / minf(1.0, cam_z))
		draw_circle(p1, 4.0 / minf(1.0, cam_z), g_col)
		draw_circle(p2, 4.0 / minf(1.0, cam_z), g_col)

	# 12. Draw Marquee Selection Box
	if _is_marquee_selecting:
		var r_pos := Vector2(minf(_marquee_start_world.x, _marquee_end_world.x), minf(_marquee_start_world.y, _marquee_end_world.y))
		var r_size := Vector2(absf(_marquee_end_world.x - _marquee_start_world.x), absf(_marquee_end_world.y - _marquee_start_world.y))
		draw_rect(Rect2(r_pos, r_size), Color(0.22, 0.74, 0.97, 0.14), true)
		draw_rect(Rect2(r_pos, r_size), Color("#38BDF8"), false, 2.0 / minf(1.0, cam_z))

# ============================================================================
# NATURAL RESOURCE DEPOSIT OUTCROP & MACRO PIN (1:1 Port of canvasArtwork.ts)
# ============================================================================
func _draw_deposit_node(n: Dictionary, macro: bool, cam_z: float, is_battery_saver: bool, font: Font) -> void:
	var nx: float = float(n.get("x", 0.0))
	var ny: float = float(n.get("y", 0.0))
	var nw: float = float(n.get("width", 268.0))
	var nh: float = float(n.get("height", 144.0))
	var cx: float = nx + nw * 0.5
	var cy: float = ny + nh * 0.5

	var purity_key: String = str(n.get("purity", "normal"))
	var p_cfg: Dictionary = Catalog.PURITY_CONFIG.get(purity_key, Catalog.PURITY_CONFIG["normal"])
	var badge_col: Color = p_cfg.get("badgeColor", Color("#F97316"))
	var nid: String = str(n.get("id", ""))
	var is_sel: bool = nid == GameState.selected_node_id or GameState.selected_node_ids.has(nid)

	var recipe_id: String = str(n.get("recipeId", "deposit_iron"))
	var title_lower: String = str(n.get("title", "")).to_lower()
	var is_copper: bool = recipe_id == "deposit_copper" or title_lower.contains("copper")
	var is_limestone: bool = recipe_id == "deposit_limestone" or title_lower.contains("limestone")
	var ore_name: String = "Copper Ore" if is_copper else ("Limestone" if is_limestone else "Iron Ore")
	var item_key: String = "copper_ore" if is_copper else ("limestone" if is_limestone else "iron_ore")
	var ore_tex: Texture2D = Catalog.get_item_texture(item_key)

	# Check if a Miner Mk.1 is mounted on this deposit
	var is_miner_mounted: bool = false
	for other in GameState.nodes:
		if str(other.get("buildingId", "")) == "miner_mk1":
			var ox: float = float(other.get("x", 0.0)) + float(other.get("width", 268.0)) * 0.5
			var oy: float = float(other.get("y", 0.0)) + float(other.get("height", 144.0)) * 0.5
			if absf(ox - cx) <= 72.0 and absf(oy - cy) <= 60.0:
				is_miner_mounted = true
				break

	if macro:
		# Satisfactory Map Resource Pin with Stem
		var pin_scale: float = clampf(0.28 / maxf(0.06, cam_z), 1.0, 3.1)
		var pin_r: float = (20.0 if is_miner_mounted else 28.0) * pin_scale
		var pin_cx: float = (cx - nw * 0.36) if is_miner_mounted else cx
		var pin_cy: float = (cy - nh * 0.42) if is_miner_mounted else cy
		if is_miner_mounted:
			draw_line(Vector2(cx, cy), Vector2(pin_cx, pin_cy), badge_col, 3.0 * pin_scale)
		draw_circle(Vector2(pin_cx, pin_cy + 3.0 * pin_scale), pin_r + 2.0 * pin_scale, Color(0, 0, 0, 0.55))
		draw_circle(Vector2(pin_cx, pin_cy), pin_r, badge_col)
		draw_arc(Vector2(pin_cx, pin_cy), pin_r, 0.0, TAU, 24, Color("#FACC15") if is_sel else Color("#090D16"), (3.5 if is_sel else 2.5) * pin_scale)
		draw_circle(Vector2(pin_cx, pin_cy), pin_r * 0.76, Color("#0B111E"))
		if ore_tex:
			var idim: float = pin_r * 1.15
			draw_texture_rect(ore_tex, Rect2(pin_cx - idim * 0.5, pin_cy - idim * 0.5, idim, idim), false)
		return

	var formatted_rate: String = _format_rate_text(float(p_cfg.get("ratePerMin", 60.0)))
	var pad: float = 12.0

	# 1. Ground Shadow Ellipse
	if not is_battery_saver:
		_draw_ellipse_filled(Vector2(cx + 4.0, cy + 8.0), (nw + pad * 2.0) * 0.52, (nh + pad * 2.0) * 0.5, Color(0, 0, 0, 0.62))

	# 2. Outer Craggy Basalt Rock Slab Polygon
	var outer_rock := PackedVector2Array([
		Vector2(nx - pad + 26.0, ny - pad + 4.0),
		Vector2(nx + nw + pad - 30.0, ny - pad + 2.0),
		Vector2(nx + nw + pad - 2.0, ny - pad + 26.0),
		Vector2(nx + nw + pad, ny + nh + pad - 26.0),
		Vector2(nx + nw + pad - 24.0, ny + nh + pad - 2.0),
		Vector2(nx - pad + 28.0, ny + nh + pad),
		Vector2(nx - pad + 2.0, ny + nh + pad - 24.0),
		Vector2(nx - pad + 4.0, ny - pad + 26.0),
	])
	draw_colored_polygon(outer_rock, Color("#0D1522"))
	var outer_closed := outer_rock.duplicate()
	outer_closed.append(outer_rock[0])
	var rim_col: Color = Color("#FACC15") if is_sel else (Color("#10B981") if is_miner_mounted else Color("#1E2D44"))
	var rim_w: float = 3.0 if is_sel else (2.4 if is_miner_mounted else 1.5)
	draw_polyline(outer_closed, rim_col, rim_w)

	# 3. Inner Bedrock Strata Ring
	var inner_rock := PackedVector2Array([
		Vector2(nx + 28.0, ny + 4.0),
		Vector2(nx + nw - 32.0, ny + 2.0),
		Vector2(nx + nw - 4.0, ny + 26.0),
		Vector2(nx + nw - 2.0, ny + nh - 28.0),
		Vector2(nx + nw - 26.0, ny + nh - 4.0),
		Vector2(nx + 30.0, ny + nh - 2.0),
		Vector2(nx + 4.0, ny + nh - 26.0),
		Vector2(nx + 6.0, ny + 28.0),
	])
	draw_colored_polygon(inner_rock, Color("#131E30"))
	var inner_closed := inner_rock.duplicate()
	inner_closed.append(inner_rock[0])
	draw_polyline(inner_closed, Color("#1B2A3E"), 1.0)

	# Protruding Bedrock Pedestal Tab below mounted Miner Mk.1
	if is_miner_mounted:
		var tab_text: String = "● %s DEPOSIT (%s · %s)" % [ore_name.to_upper(), str(p_cfg.get("label", "NORMAL")).to_upper(), formatted_rate]
		var text_w: float = font.get_string_size(tab_text, HORIZONTAL_ALIGNMENT_LEFT, -1, 9).x
		var tab_w: float = maxf(232.0, text_w + 22.0)
		var tab_h: float = 19.0
		var tab_rect := Rect2(cx - tab_w * 0.5, ny + nh + 3.0, tab_w, tab_h)
		_draw_rounded_box(tab_rect, 5.0, Color("#08111D"), Color("#10B981"), 1.4)
		draw_string(font, Vector2(tab_rect.position.x, tab_rect.position.y + 13.0), tab_text, HORIZONTAL_ALIGNMENT_CENTER, tab_w, 9, Color("#10B981"))

	# 4. Natural Ore Rock Fractures & Fissures
	draw_line(Vector2(nx + 24.0, ny + 36.0), Vector2(nx + 68.0, ny + 48.0), Color(0, 0, 0, 0.45), 1.8)
	draw_line(Vector2(nx + 68.0, ny + 48.0), Vector2(nx + 84.0, ny + 32.0), Color(0, 0, 0, 0.45), 1.8)
	draw_line(Vector2(nx + nw - 26.0, ny + nh - 40.0), Vector2(nx + nw - 65.0, ny + nh - 45.0), Color(0, 0, 0, 0.45), 1.8)
	draw_line(Vector2(nx + nw - 65.0, ny + nh - 45.0), Vector2(nx + nw - 85.0, ny + nh - 25.0), Color(0, 0, 0, 0.45), 1.8)

	# 5. Crystalline Ore Clusters
	var crystal_base: Color = Color("#D97706") if is_copper else (Color("#94A3B8") if is_limestone else Color("#475569"))
	var crystal_hi: Color = Color("#FDE68A") if is_copper else (Color("#F8FAFC") if is_limestone else Color("#CBD5E1"))
	var left_cryst := PackedVector2Array([
		Vector2(nx + 20.0, ny + 72.0),
		Vector2(nx + 34.0, ny + 42.0),
		Vector2(nx + 48.0, ny + 54.0),
		Vector2(nx + 44.0, ny + 84.0),
	])
	draw_colored_polygon(left_cryst, crystal_base)
	var lc_closed := left_cryst.duplicate()
	lc_closed.append(left_cryst[0])
	draw_polyline(lc_closed, crystal_hi, 1.2)

	var right_cryst := PackedVector2Array([
		Vector2(nx + nw - 20.0, ny + 66.0),
		Vector2(nx + nw - 36.0, ny + 36.0),
		Vector2(nx + nw - 50.0, ny + 50.0),
		Vector2(nx + nw - 46.0, ny + 80.0),
	])
	draw_colored_polygon(right_cryst, crystal_base)
	var rc_closed := right_cryst.duplicate()
	rc_closed.append(right_cryst[0])
	draw_polyline(rc_closed, crystal_hi, 1.2)

	# 6. Central Excavation Collar
	var collar_r: float = 40.0
	draw_circle(Vector2(cx, cy), collar_r, Color("#080E18"))
	draw_arc(Vector2(cx, cy), collar_r, 0.0, TAU, 28, Color("#10B981") if is_miner_mounted else Color("#334155"), 2.2)
	draw_arc(Vector2(cx, cy), collar_r - 6.0, 0.0, TAU, 24, Color(0.06, 0.73, 0.51, 0.4) if is_miner_mounted else Color("#1E293B"), 1.4)

	if ore_tex:
		var icon_dim: float = 28.0 if is_miner_mounted else 34.0
		draw_texture_rect(ore_tex, Rect2(cx - icon_dim * 0.5, cy - (10.0 if is_miner_mounted else 8.0), icon_dim, icon_dim), false)

	var mount_lbl: String = "● MINER MK.1 LOCKED" if is_miner_mounted else "⚓ MINER MK.1 MOUNT"
	var mount_col: Color = Color("#10B981") if is_miner_mounted else Color("#94A3B8")
	draw_string(font, Vector2(nx, cy + 22.0), mount_lbl, HORIZONTAL_ALIGNMENT_CENTER, nw, 9, mount_col)

	# 7. Top-Left Survey Beacon & Top-Right Ore Name
	var beacon_text: String = "%s · %s" % [str(p_cfg.get("label", "NORMAL")).to_upper(), formatted_rate]
	var bw_est: float = maxf(126.0, font.get_string_size(beacon_text, HORIZONTAL_ALIGNMENT_LEFT, -1, 9).x + 16.0)
	var beacon_rect := Rect2(nx + 14.0, ny + 10.0, bw_est, 22.0)
	_draw_rounded_box(beacon_rect, 6.0, Color("#080D15"), badge_col, 1.2)
	draw_string(font, Vector2(beacon_rect.position.x + 8.0, beacon_rect.position.y + 15.0), beacon_text, HORIZONTAL_ALIGNMENT_LEFT, -1, 9, badge_col)
	draw_string(font, Vector2(nx, ny + 24.0), ore_name, HORIZONTAL_ALIGNMENT_RIGHT, nw - 16.0, 11, Color("#F8FAFC"))

# ============================================================================
# CONVEYOR BELT RAILS, ANIMATED ROLLERS, OVERPASS BRIDGES, ITEMS & BADGES
# ============================================================================
func _draw_conveyor_connection(conn: Dictionary, macro: bool, cam_z: float, is_battery_saver: bool, font: Font) -> Dictionary:
	var pts: Array = conn.get("_cachedPoints", [])
	if pts.size() < 2:
		return {}
	var tier_num: int = clampi(int(conn.get("beltTier", 1)), 1, 6)
	var tier_def: Dictionary = Catalog.CONVEYOR_BELT_TIERS[tier_num]
	var tier_accent: Color = tier_def.get("accentColor", Color("#94A3B8"))
	var is_sel: bool = str(conn.get("id", "")) == GameState.selected_connection_id
	var max_cap: float = float(conn.get("maxCapacityPerMin", tier_def.get("capacityPerMin", 60.0)))
	var rate: float = float(conn.get("ratePerMin", 0.0))
	var is_bottlenecked: bool = rate > max_cap

	var typed_pts: Array[Vector2] = []
	for p in pts:
		typed_pts.append(p as Vector2)

	if macro:
		var col_macro: Color = Color("#38BDF8") if is_sel else (Color("#EF4444") if is_bottlenecked else tier_accent)
		var w_macro: float = maxf(6.0, 3.2 / cam_z) if is_sel else maxf(4.0, 2.2 / cam_z)
		for i in range(typed_pts.size() - 1):
			draw_line(typed_pts[i], typed_pts[i + 1], col_macro, w_macro)
		return {"conn": conn, "points": typed_pts}

	# 1. Outer Industrial Steel Frame Rails (16px) & Inner Roller Bed (12.5px)
	var rail_col: Color = Color("#38BDF8") if is_sel else (Color("#EF4444") if is_bottlenecked else tier_accent)
	for i in range(typed_pts.size() - 1):
		var a: Vector2 = typed_pts[i]
		var b: Vector2 = typed_pts[i + 1]
		draw_line(a, b, rail_col, 16.0)
		draw_line(a, b, Color("#0B0F19"), 12.5)

	# 2. Animated Conveyor Rollers / Slats + Center Spine
	if not is_battery_saver and cam_z >= 0.35:
		var roller_spacing: float = 11.0
		var speed_px: float = float(tier_def.get("speedPxPerSec", 18.0))
		var is_moving: bool = rate > 0.1 or (conn.get("inFlightItems", []) as Array).size() > 0
		var roller_offset: float = fmod(_elapsed_time * speed_px, roller_spacing) if is_moving else 0.0
		for i in range(typed_pts.size() - 1):
			var a: Vector2 = typed_pts[i]
			var b: Vector2 = typed_pts[i + 1]
			var seg_v: Vector2 = b - a
			var seg_len: float = seg_v.length()
			if seg_len < 2.0:
				continue
			var dir: Vector2 = seg_v / seg_len
			var perp := Vector2(-dir.y, dir.x)
			var d: float = roller_offset
			while d < seg_len:
				var rp: Vector2 = a + dir * d
				draw_line(rp - perp * 5.0, rp + perp * 5.0, Color("#334155"), 1.6)
				d += roller_spacing
			draw_line(a, b, Color(0.118, 0.161, 0.231, 0.55), 1.2)

	# 3. Waypoint 90° Corner Dots & Midpoint "+ ADD CORNER" Handles
	if GameState.active_tool == "waypoint" or is_sel:
		var wps: Array = conn.get("waypoints", [])
		for i in range(wps.size()):
			var wp_pos := Vector2(float(wps[i].get("x", 0.0)), float(wps[i].get("y", 0.0)))
			draw_circle(wp_pos, 14.0, Color(0.22, 0.74, 0.97, 0.2))
			draw_circle(wp_pos, 9.5, Color("#0B0F19"))
			draw_arc(wp_pos, 9.5, 0.0, TAU, 20, Color("#38BDF8"), 2.5)
			draw_circle(wp_pos, 3.8, Color("#38BDF8"))
			if cam_z >= 0.55:
				var tag_rect := Rect2(wp_pos.x - 28.0, wp_pos.y - 28.0, 56.0, 14.0)
				_draw_rounded_box(tag_rect, 4.0, Color(0.04, 0.06, 0.1, 0.92), Color(0.22, 0.74, 0.97, 0.55), 1.0)
				draw_string(font, Vector2(tag_rect.position.x, tag_rect.position.y + 10.5), "CORNER %d" % [i + 1], HORIZONTAL_ALIGNMENT_CENTER, 56.0, 8, Color("#38BDF8"))

	return {"conn": conn, "points": typed_pts}

func _draw_belt_overpass_bridges(visible_routes: Array[Dictionary]) -> void:
	var bridge_half: float = 17.0
	var deck_half_w: float = 10.5
	for i in range(1, visible_routes.size()):
		var upper_pts: Array[Vector2] = visible_routes[i]["points"]
		var upper_conn: Dictionary = visible_routes[i]["conn"]
		var t_num: int = clampi(int(upper_conn.get("beltTier", 1)), 1, 6)
		var t_accent: Color = Catalog.CONVEYOR_BELT_TIERS[t_num].get("accentColor", Color("#94A3B8"))
		for j in range(i):
			var lower_pts: Array[Vector2] = visible_routes[j]["points"]
			for u in range(upper_pts.size() - 1):
				var u1: Vector2 = upper_pts[u]
				var u2: Vector2 = upper_pts[u + 1]
				var u_horiz: bool = absf(u1.y - u2.y) < 1.0
				var u_vert: bool = absf(u1.x - u2.x) < 1.0
				if not u_horiz and not u_vert:
					continue
				for l in range(lower_pts.size() - 1):
					var l1: Vector2 = lower_pts[l]
					var l2: Vector2 = lower_pts[l + 1]
					var l_horiz: bool = absf(l1.y - l2.y) < 1.0
					var l_vert: bool = absf(l1.x - l2.x) < 1.0
					if u_horiz == l_horiz:
						continue
					var ix: float = l1.x if u_horiz else u1.x
					var iy: float = u1.y if u_horiz else l1.y
					var margin: float = 18.0
					if u_horiz:
						if ix <= minf(u1.x, u2.x) + margin or ix >= maxf(u1.x, u2.x) - margin:
							continue
						if iy <= minf(l1.y, l2.y) + margin or iy >= maxf(l1.y, l2.y) - margin:
							continue
					else:
						if iy <= minf(u1.y, u2.y) + margin or iy >= maxf(u1.y, u2.y) - margin:
							continue
						if ix <= minf(l1.x, l2.x) + margin or ix >= maxf(l1.x, l2.x) - margin:
							continue
					# Draw Overpass Bridge Deck centered at (ix, iy)
					if u_horiz:
						draw_rect(Rect2(ix - bridge_half - 3.0, iy - deck_half_w - 4.0, (bridge_half + 3.0) * 2.0, (deck_half_w + 4.0) * 2.0), Color(0, 0, 0, 0.72), true)
						draw_rect(Rect2(ix - bridge_half, iy - deck_half_w, bridge_half * 2.0, deck_half_w * 2.0), Color("#1E293B"), true)
						draw_rect(Rect2(ix - bridge_half + 4.0, iy - 6.5, (bridge_half - 4.0) * 2.0, 13.0), Color("#0F172A"), true)
						draw_line(Vector2(ix - bridge_half, iy - deck_half_w), Vector2(ix + bridge_half, iy - deck_half_w), t_accent, 2.6)
						draw_line(Vector2(ix - bridge_half, iy + deck_half_w), Vector2(ix + bridge_half, iy + deck_half_w), t_accent, 2.6)
					else:
						draw_rect(Rect2(ix - deck_half_w - 4.0, iy - bridge_half - 3.0, (deck_half_w + 4.0) * 2.0, (bridge_half + 3.0) * 2.0), Color(0, 0, 0, 0.72), true)
						draw_rect(Rect2(ix - deck_half_w, iy - bridge_half, deck_half_w * 2.0, bridge_half * 2.0), Color("#1E293B"), true)
						draw_rect(Rect2(ix - 6.5, iy - bridge_half + 4.0, 13.0, (bridge_half - 4.0) * 2.0), Color("#0F172A"), true)
						draw_line(Vector2(ix - deck_half_w, iy - bridge_half), Vector2(ix - deck_half_w, iy + bridge_half), t_accent, 2.6)
						draw_line(Vector2(ix + deck_half_w, iy - bridge_half), Vector2(ix + deck_half_w, iy + bridge_half), t_accent, 2.6)

func _draw_in_flight_belt_items(conn: Dictionary, pts: Array[Vector2], _font: Font) -> void:
	var items: Array = conn.get("inFlightItems", [])
	if items.is_empty():
		return
	var box_size: float = 14.8
	var half_box: float = box_size * 0.5
	for i in range(items.size()):
		var pkt: Dictionary = items[i]
		var prog: float = clampf(float(pkt.get("progress", 0.0)), 0.0, 1.0)
		var sample: Dictionary = Router.sample_polyline(pts, prog)
		var pos: Vector2 = sample["pos"]
		var item_name: String = str(pkt.get("itemName", conn.get("itemName", "Iron Ore")))
		var accent: Color = Catalog.get_item_accent_color(item_name)
		var is_stalled: bool = (i == 0 and prog >= 0.96)
		var box_rect := Rect2(pos.x - half_box, pos.y - half_box, box_size, box_size)
		_draw_rounded_box(box_rect, 3.5, Color("#0F172A"), Color("#EF4444") if is_stalled else accent, 1.8 if is_stalled else 1.4)
		var tex: Texture2D = Catalog.get_item_texture(item_name)
		if tex:
			draw_texture_rect(tex, Rect2(pos.x - half_box + 1.2, pos.y - half_box + 1.2, box_size - 2.4, box_size - 2.4), false)
		if is_stalled:
			draw_circle(Vector2(pos.x + half_box - 1.5, pos.y - half_box + 1.5), 2.5, Color("#EF4444"))

func _draw_conveyor_badge(conn: Dictionary, pts: Array[Vector2], cam_z: float, font: Font) -> void:
	if cam_z < 0.42 or pts.size() < 2:
		return
	var mid_sample: Dictionary = Router.sample_polyline(pts, 0.5)
	var mid_pos: Vector2 = mid_sample["pos"]
	var angle: float = float(mid_sample.get("angle", 0.0))
	var perp := Vector2(-sin(angle), cos(angle))
	var offset_sign: float = -1.0 if perp.y <= 0.0 else 1.0
	var badge_center := mid_pos + perp * (offset_sign * 28.0)

	var tier_num: int = clampi(int(conn.get("beltTier", 1)), 1, 6)
	var tier_def: Dictionary = Catalog.CONVEYOR_BELT_TIERS[tier_num]
	var tier_accent: Color = tier_def.get("accentColor", Color("#94A3B8"))
	var is_sel: bool = str(conn.get("id", "")) == GameState.selected_connection_id
	var rate_val: int = int(roundf(float(conn.get("ratePerMin", 0.0))))
	var cap_val: int = int(roundf(float(conn.get("maxCapacityPerMin", 60.0))))
	var suffix: String = "/m" if str(GameState.settings.get("rateDisplayFormat", "per_minute")) == "compact" else " per minute"
	var label: String = "%d/%d%s · MK.%d" % [rate_val, cap_val, suffix, tier_num]

	var text_w: float = font.get_string_size(label, HORIZONTAL_ALIGNMENT_LEFT, -1, 9).x
	var bw: float = maxf(96.0, text_w + 16.0)
	var bh: float = 20.0
	var b_rect := Rect2(badge_center.x - bw * 0.5, badge_center.y - bh * 0.5, bw, bh)

	draw_line(mid_pos, badge_center, Color(tier_accent.r, tier_accent.g, tier_accent.b, 0.55), 1.4)
	draw_circle(mid_pos, 2.8, tier_accent)
	_draw_rounded_box(b_rect, 5.0, Color("#0F172A"), Color("#38BDF8") if is_sel else tier_accent, 1.4)
	draw_string(font, Vector2(b_rect.position.x, b_rect.position.y + 13.5), label, HORIZONTAL_ALIGNMENT_CENTER, bw, 9, Color("#F8FAFC"))

# ============================================================================
# MACHINE NODE RENDERER (1:1 Port of canvasNodeRenderer.ts)
# ============================================================================
func _draw_machine_node(n: Dictionary, macro: bool, cam_z: float, is_battery_saver: bool, font: Font) -> void:
	var nx: float = float(n.get("x", 0.0))
	var ny: float = float(n.get("y", 0.0))
	var nw: float = float(n.get("width", 268.0))
	var nh: float = float(n.get("height", 144.0))
	var nid: String = str(n.get("id", ""))
	var b_id: String = str(n.get("buildingId", ""))
	var b_def: Dictionary = Catalog.BUILDINGS.get(b_id, {})
	var accent: Color = b_def.get("accentColor", Color("#F59E0B"))
	var is_sel: bool = nid == GameState.selected_node_id or GameState.selected_node_ids.has(nid)
	var is_dragging_collision: bool = (nid == _dragging_node_id and _drag_has_collision)

	var is_stby: bool = bool(n.get("standby", false))
	var status_raw: String = str(n.get("status", "running"))
	var eff_val: int = int(roundf(float(n.get("efficiency", 0.0))))
	var status_col: Color = Color("#EF4444") if (is_stby or status_raw == "starved") else (Color("#FACC15") if (status_raw == "backed_up" or eff_val < 99) else Color("#22C55E"))

	if macro:
		var pin_scale: float = clampf(0.28 / maxf(0.06, cam_z), 1.0, 2.9)
		var box_dim: float = 84.0 * pin_scale
		var cx: float = nx + nw * 0.5
		var cy: float = ny + nh * 0.5
		var m_rect := Rect2(cx - box_dim * 0.5, cy - box_dim * 0.5, box_dim, box_dim)
		_draw_rounded_box(m_rect, 18.0 * pin_scale, Color("#0F172A"), Color("#38BDF8") if is_sel else accent, (4.0 if is_sel else 2.8) * pin_scale)
		var b_tex: Texture2D = Catalog.get_building_texture(b_id)
		if b_tex:
			var idim: float = box_dim * 0.68
			draw_texture_rect(b_tex, Rect2(cx - idim * 0.5, cy - idim * 0.5, idim, idim), false)
		draw_circle(Vector2(m_rect.end.x - 10.0 * pin_scale, m_rect.position.y + 10.0 * pin_scale), 7.0 * pin_scale, status_col)
		return

	# ------------------------------------------------------------------------
	# AUTHENTIC EXTERIOR MINER MK.1 CARD (1:1 Port of canvasNodeRenderer.ts)
	# ------------------------------------------------------------------------
	if b_id == "miner_mk1":
		if not is_battery_saver:
			_draw_rounded_box(Rect2(nx + 2.0, ny + 6.0, nw, nh), 11.0, Color(0, 0, 0, 0.52))
		_draw_rounded_box(Rect2(nx, ny, nw, nh), 11.0, Color("#52565E"))
		var chassis_tex: Texture2D = Catalog.get_cached_texture("res://assets/icons/buildings/miner_chassis_bg.png")
		if chassis_tex:
			draw_texture_rect(chassis_tex, Rect2(nx, ny, nw, nh), false)

		var is_backed_up: bool = status_raw == "backed_up"
		var status_str: String = "Standby" if is_stby else ("Output Full" if is_backed_up else ("Mining" if status_raw == "running" else "No Deposit"))
		var clock_pct: float = float(n.get("overclock", 100.0))
		var mw_val: float = Catalog.get_building_power_mw("miner_mk1", clock_pct, is_stby)
		var outs: Array = n.get("outputs", [])
		var out_item: String = str(outs[0].get("itemName", "Iron Ore")) if outs.size() > 0 else "Iron Ore"
		var out_rate: float = float(outs[0].get("ratePerMin", 60.0)) if outs.size() > 0 else 60.0
		var cycle_sec: float = 0.0 if is_stby else (60.0 / maxf(1.0, out_rate))

		# 1. Center Dark Monitor Screen Overlay (0.506..0.734, 0.111..0.392)
		var sx: float = nx + nw * 0.506
		var sy: float = ny + nh * 0.111
		var sw: float = nw * 0.228
		var sh: float = nh * 0.281
		_draw_rounded_box(Rect2(sx, sy, sw, sh), 4.0, Color("#0A0C0F"))

		var top_h: float = sh * 0.45
		var top_cy: float = sy + top_h * 0.5
		var dot_r: float = 3.6
		var lbl_w: float = font.get_string_size(status_str, HORIZONTAL_ALIGNMENT_LEFT, -1, 9).x
		var group_w: float = dot_r * 2.0 + 5.0 + lbl_w
		var start_top_x: float = sx + (sw - group_w) * 0.5
		draw_circle(Vector2(start_top_x + dot_r, top_cy), dot_r, status_col)
		draw_string(font, Vector2(start_top_x + dot_r * 2.0 + 5.0, top_cy + 3.5), status_str, HORIZONTAL_ALIGNMENT_LEFT, -1, 9, Color("#FFFFFF"))

		var div_y: float = sy + top_h
		var col_w: float = sw / 3.0
		draw_line(Vector2(sx + 3.0, div_y), Vector2(sx + sw - 3.0, div_y), Color("#26282E"), 0.8)
		draw_line(Vector2(sx + col_w, div_y + 2.5), Vector2(sx + col_w, sy + sh - 2.5), Color("#26282E"), 0.8)
		draw_line(Vector2(sx + col_w * 2.0, div_y + 2.5), Vector2(sx + col_w * 2.0, sy + sh - 2.5), Color("#26282E"), 0.8)

		var icon_cy: float = div_y + (sh - top_h) * 0.30
		var val_cy: float = div_y + (sh - top_h) * 0.84
		var c1x: float = sx + col_w * 0.5
		var c2x: float = sx + col_w * 1.5
		var c3x: float = sx + col_w * 2.5

		# Lightning bolt icon
		var bolt_pts := PackedVector2Array([
			Vector2(c1x + 0.8, icon_cy - 3.8),
			Vector2(c1x - 2.2, icon_cy + 0.4),
			Vector2(c1x + 0.1, icon_cy + 0.4),
			Vector2(c1x - 0.8, icon_cy + 4.0),
			Vector2(c1x + 2.2, icon_cy - 0.4),
			Vector2(c1x - 0.1, icon_cy - 0.4),
		])
		draw_colored_polygon(bolt_pts, Color("#FFFFFF"))
		# Stopwatch icon
		draw_arc(Vector2(c2x, icon_cy + 0.6), 3.1, 0.0, TAU, 14, Color("#FFFFFF"), 1.1)
		draw_line(Vector2(c2x - 1.2, icon_cy - 3.5), Vector2(c2x + 1.2, icon_cy - 3.5), Color("#FFFFFF"), 1.1)
		draw_line(Vector2(c2x, icon_cy + 0.6), Vector2(c2x + 1.4, icon_cy - 0.8), Color("#FFFFFF"), 1.1)
		# 4-bar ascending efficiency graph
		var bar_heights: Array[float] = [2.2, 3.8, 5.2, 6.8]
		for bi in range(4):
			var bh_val: float = bar_heights[bi]
			draw_rect(Rect2(c3x - 3.8 + float(bi) * 2.1, icon_cy + 3.6 - bh_val, 1.4, bh_val), Color("#FFFFFF"), true)

		var mw_str: String = "%d MW" % int(roundf(mw_val)) if is_equal_approx(mw_val, roundf(mw_val)) else ("%.1f MW" % mw_val)
		var sec_str: String = "0s" if is_stby else ("%.1f sec" % cycle_sec)
		var eff_str: String = "%d%%" % (0 if is_stby else eff_val)
		draw_string(font, Vector2(sx, val_cy), mw_str, HORIZONTAL_ALIGNMENT_CENTER, col_w, 6, Color("#FFFFFF"))
		draw_string(font, Vector2(sx + col_w, val_cy), sec_str, HORIZONTAL_ALIGNMENT_CENTER, col_w, 6, Color("#FFFFFF"))
		draw_string(font, Vector2(sx + col_w * 2.0, val_cy), eff_str, HORIZONTAL_ALIGNMENT_CENTER, col_w, 6, Color("#FFFFFF"))

		# 2. Top-Right White [ OUTPUT ] Card Overlay
		var slot_x: float = nx + nw * 0.795
		var slot_y: float = ny + nh * 0.165
		var slot_w: float = nw * 0.143
		var slot_h: float = nh * 0.276
		if out_item != "Iron Ore":
			_draw_rounded_box(Rect2(slot_x + 2.0, slot_y + 2.0, slot_w - 4.0, slot_h - 4.0), 3.0, Color("#9EA2AB"))
			var item_tex: Texture2D = Catalog.get_item_texture(out_item)
			if item_tex:
				draw_texture_rect(item_tex, Rect2(slot_x + 3.0, slot_y + 3.0, slot_w - 6.0, slot_h - 6.0), false)

		var stored_str: String = str(int(n.get("outputStorage", 0)))
		var badge_w: float = maxf(14.0, font.get_string_size(stored_str, HORIZONTAL_ALIGNMENT_LEFT, -1, 7).x + 6.0)
		var badge_h: float = 9.5
		var badge_rect := Rect2(slot_x + slot_w - badge_w - 1.5, slot_y + slot_h - badge_h - 1.5, badge_w, badge_h)
		_draw_rounded_box(badge_rect, 2.0, Color("#DF8A2E"))
		draw_string(font, Vector2(badge_rect.position.x, badge_rect.position.y + 7.5), stored_str, HORIZONTAL_ALIGNMENT_CENTER, badge_w, 7, Color("#FFFFFF"))

		if out_item != "Iron Ore":
			draw_rect(Rect2(nx + nw * 0.762, ny + nh * 0.440, nw * 0.146, nh * 0.056), Color("#FAFAFA"), true)
			draw_string(font, Vector2(nx + nw * 0.762, ny + nh * 0.482), "1 " + out_item, HORIZONTAL_ALIGNMENT_CENTER, nw * 0.146, 7, Color("#1E2024"))

		var is_compact: bool = str(GameState.settings.get("rateDisplayFormat", "per_minute")) == "compact"
		var rate_num_str: String = str(int(roundf(out_rate))) if is_equal_approx(out_rate, roundf(out_rate)) else ("%.1f" % out_rate)
		if is_compact or int(roundf(out_rate)) != 60:
			draw_rect(Rect2(nx + nw * 0.762, ny + nh * 0.494, nw * 0.146, nh * 0.054), Color("#FAFAFA"), true)
			var unit_str: String = "/m" if is_compact else " per minute"
			var nw_txt: float = font.get_string_size(rate_num_str, HORIZONTAL_ALIGNMENT_LEFT, -1, 7).x
			var uw_txt: float = font.get_string_size(unit_str, HORIZONTAL_ALIGNMENT_LEFT, -1, 7).x
			var rx0: float = nx + nw * 0.835 - (nw_txt + uw_txt) * 0.5
			draw_string(font, Vector2(rx0, ny + nh * 0.534), rate_num_str, HORIZONTAL_ALIGNMENT_LEFT, -1, 7, Color("#DF8A2E"))
			draw_string(font, Vector2(rx0 + nw_txt, ny + nh * 0.534), unit_str, HORIZONTAL_ALIGNMENT_LEFT, -1, 7, Color("#3A3D42"))

		# 3. Bottom-Left Stepped White Overclock Box Overlay (0% — 250%)
		var oc_x: float = nx + nw * 0.107
		var oc_top_y: float = ny + nh * 0.665
		var oc_top_w: float = nw * 0.354
		var oc_top_h: float = nh * 0.058
		var oc_bot_y: float = oc_top_y + oc_top_h - 0.5
		var oc_bot_w: float = nw * 0.648
		var oc_bot_h: float = nh * 0.197
		draw_rect(Rect2(oc_x, oc_top_y, oc_top_w, oc_top_h), Color("#FAFAFA"), true)
		draw_rect(Rect2(oc_x, oc_bot_y, oc_bot_w, oc_bot_h), Color("#FAFAFA"), true)

		var pad_l: float = oc_x + 3.5
		draw_string(font, Vector2(pad_l, oc_top_y + oc_top_h * 0.78), "Clock Speed: %d%%" % int(roundf(clock_pct)), HORIZONTAL_ALIGNMENT_LEFT, -1, 7, Color("#1E2024"))

		var tr_y: float = oc_bot_y + oc_bot_h * 0.24
		var pfx: String = "Target production rate: "
		var pfx_w: float = font.get_string_size(pfx, HORIZONTAL_ALIGNMENT_LEFT, -1, 6).x
		draw_string(font, Vector2(pad_l, tr_y), pfx, HORIZONTAL_ALIGNMENT_LEFT, -1, 6, Color("#3A3D42"))
		draw_string(font, Vector2(pad_l + pfx_w, tr_y), _format_rate_text(out_rate), HORIZONTAL_ALIGNMENT_LEFT, -1, 6, Color("#DF8A2E"))

		var bar_x: float = pad_l
		var bar_y: float = oc_bot_y + oc_bot_h * 0.32
		var bar_w: float = oc_bot_w - 7.0
		var bar_h: float = oc_bot_h * 0.38
		var shards: int = clampi(int(n.get("powerShards", 0)), 0, 3)
		var max_unlocked: float = 100.0 + float(shards * 50)
		var seg_gap: float = 1.6
		var seg_w: float = (bar_w - seg_gap * 4.0) / 5.0
		for s_idx in range(5):
			var s_start: float = float(s_idx * 50)
			var s_end: float = float((s_idx + 1) * 50)
			var seg_x: float = bar_x + float(s_idx) * (seg_w + seg_gap)
			draw_rect(Rect2(seg_x, bar_y, seg_w, bar_h), Color("#9CA3AF") if s_end <= max_unlocked else Color("#D1D5DB"), true)
			if clock_pct > s_start:
				var fill_ratio: float = clampf((minf(s_end, clock_pct) - s_start) / 50.0, 0.0, 1.0)
				draw_rect(Rect2(seg_x, bar_y, seg_w * fill_ratio, bar_h), Color("#E0862B"), true)

		var tick_y: float = oc_bot_y + oc_bot_h * 0.92
		draw_string(font, Vector2(bar_x, tick_y), "0%", HORIZONTAL_ALIGNMENT_LEFT, -1, 6, Color("#1E2024"))
		draw_string(font, Vector2(bar_x + bar_w * 0.40 - 10.0, tick_y), "100%", HORIZONTAL_ALIGNMENT_LEFT, -1, 6, Color("#1E2024"))
		draw_string(font, Vector2(bar_x + bar_w * 0.60 - 10.0, tick_y), "150%", HORIZONTAL_ALIGNMENT_LEFT, -1, 6, Color("#1E2024"))
		draw_string(font, Vector2(bar_x + bar_w * 0.80 - 10.0, tick_y), "200%", HORIZONTAL_ALIGNMENT_LEFT, -1, 6, Color("#1E2024"))
		draw_string(font, Vector2(bar_x + bar_w - 18.0, tick_y), "250%", HORIZONTAL_ALIGNMENT_LEFT, -1, 6, Color("#1E2024"))

		# 4. Bottom-Right Horizontal I / O Standby Rocker Switch (0.805, 0.728, 0.092, 0.095)
		var rkr_x: float = nx + nw * 0.805
		var rkr_y: float = ny + nh * 0.728
		var rkr_w: float = nw * 0.092
		var rkr_h: float = nh * 0.095
		var half_w: float = rkr_w * 0.5
		draw_rect(Rect2(rkr_x - 1.0, rkr_y - 1.0, rkr_w + 2.0, rkr_h + 2.0), Color("#23262B"), true)
		draw_rect(Rect2(rkr_x, rkr_y, half_w, rkr_h), Color("#B93815") if not is_stby else Color("#3E4249"), true)
		draw_rect(Rect2(rkr_x + half_w, rkr_y, half_w, rkr_h), Color("#B91C1C") if is_stby else Color("#3E4249"), true)
		draw_line(
			Vector2(rkr_x + half_w * 0.5, rkr_y + rkr_h * 0.24),
			Vector2(rkr_x + half_w * 0.5, rkr_y + rkr_h * 0.76),
			Color("#FFFFFF") if not is_stby else Color("#9CA3AF"),
			1.6
		)
		draw_arc(
			Vector2(rkr_x + half_w * 1.5, rkr_y + rkr_h * 0.5),
			minf(half_w, rkr_h) * 0.25,
			0.0,
			TAU,
			12,
			Color("#FFFFFF") if is_stby else Color("#9CA3AF"),
			1.4
		)

		var border_col: Color = Color("#EF4444") if is_dragging_collision else (Color("#38BDF8") if is_sel else Color("#27292E"))
		_draw_rounded_box(Rect2(nx, ny, nw, nh), 11.0, Color.TRANSPARENT, border_col, 2.5 if (is_sel or is_dragging_collision) else 1.5)
	else:
		# --------------------------------------------------------------------
		# STANDARD PROCESSOR / LOGISTICS / HUB NODE CARD (1:1 Port)
		# --------------------------------------------------------------------
		var header_h: float = 50.0
		if not is_battery_saver:
			_draw_rounded_box(Rect2(nx + 2.0, ny + 6.0, nw, nh), 14.0, Color(0, 0, 0, 0.48))

		var card_border: Color = Color("#EF4444") if is_dragging_collision else (Color("#38BDF8") if is_sel else Color("#26334D"))
		_draw_rounded_box(Rect2(nx, ny, nw, nh), 14.0, Color("#131B2E"), card_border, 2.5 if (is_sel or is_dragging_collision) else 1.5)
		_draw_rounded_box(Rect2(nx + 1.0, ny + 1.0, nw - 2.0, header_h), 13.0, Color("#1A2540"))
		_draw_rounded_box(Rect2(nx + 2.0, ny + 1.0, nw - 4.0, 4.0), 2.0, Color("#EF4444") if is_dragging_collision else accent)
		draw_line(Vector2(nx, ny + header_h), Vector2(nx + nw, ny + header_h), Color("#26334D"), 1.0)

		# Building Icon Badge (32x32)
		var badge_rect := Rect2(nx + 12.0, ny + 10.0, 32.0, 32.0)
		_draw_rounded_box(badge_rect, 8.0, Color("#0B0F19"), accent, 1.2)
		var b_tex: Texture2D = Catalog.get_building_texture(b_id)
		if b_tex:
			draw_texture_rect(b_tex, Rect2(nx + 13.0, ny + 11.0, 30.0, 30.0), false)

		# Title & Subtitle
		draw_string(font, Vector2(nx + 52.0, ny + 24.0), str(n.get("title", "Machine")), HORIZONTAL_ALIGNMENT_LEFT, nw - 135.0, 13, Color("#F8FAFC"))
		var clock_pct: float = float(n.get("overclock", 100.0))
		var mw_val: float = Catalog.get_building_power_mw(b_id, clock_pct, is_stby)
		var sub_str: String = "%d%% · %.1f MW" % [int(roundf(clock_pct)), mw_val] if mw_val > 0.0 else str(b_def.get("subcategory", "Logistics")).to_upper()
		draw_string(font, Vector2(nx + 52.0, ny + 40.0), sub_str, HORIZONTAL_ALIGNMENT_LEFT, -1, 10, Color("#FACC15") if int(roundf(clock_pct)) != 100 else Color("#94A3B8"))

		# Top-Right Status Pill
		var status_lbl: String = "STANDBY" if is_stby else ("OUTPUT FULL" if status_raw == "backed_up" else ("STARVED" if status_raw == "starved" else ("%d%%" % eff_val)))
		var pill_w: float = maxf(54.0, font.get_string_size(status_lbl, HORIZONTAL_ALIGNMENT_LEFT, -1, 9).x + 22.0)
		var pill_rect := Rect2(nx + nw - pill_w - 10.0, ny + 15.0, pill_w, 20.0)
		_draw_rounded_box(pill_rect, 10.0, Color("#0B0F19"), Color(status_col.r, status_col.g, status_col.b, 0.45), 1.0)
		draw_circle(Vector2(pill_rect.position.x + 8.5, pill_rect.position.y + 10.0), 3.2, status_col)
		draw_string(font, Vector2(pill_rect.position.x + 15.0, pill_rect.position.y + 13.5), status_lbl, HORIZONTAL_ALIGNMENT_LEFT, -1, 9, status_col)

		# Recipe & Dual Storage Strip (y + 58, height 28)
		var strip_rect := Rect2(nx + 12.0, ny + 58.0, nw - 24.0, 28.0)
		_draw_rounded_box(strip_rect, 6.0, Color("#0B0F19"), Color("#1E293B"), 1.0)

		var recipe_id: String = str(n.get("recipeId", ""))
		var recipe: Dictionary = Catalog.RECIPES.get(recipe_id, {})
		var outs: Array = n.get("outputs", [])
		var primary_item: String = str(outs[0].get("itemName", "")) if outs.size() > 0 else str(n.get("bufferedItemName", "Iron Plate"))
		var p_tex: Texture2D = Catalog.get_item_texture(primary_item)
		var text_x: float = nx + 20.0
		if p_tex:
			draw_texture_rect(p_tex, Rect2(nx + 17.0, ny + 63.0, 18.0, 18.0), false)
			text_x = nx + 40.0

		var rec_title: String = str(recipe.get("name", "")) if not recipe.is_empty() else ("Central Terminal" if b_id == "the_hub" else ("Buffer Storage" if b_id == "storage_container" else "Flow Router"))
		draw_string(font, Vector2(text_x, ny + 76.0), rec_title, HORIZONTAL_ALIGNMENT_LEFT, 106.0, 11, Color("#E2E8F0"))

		var is_processor: bool = (b_id == "smelter" or b_id == "constructor" or b_id == "assembler")
		if is_processor:
			var in_stored: int = int(n.get("storage", 0))
			var out_stored: int = int(n.get("outputStorage", 0))
			var out_max: int = maxi(1, int(n.get("maxStorage", 100)))
			var r_ins: Array = recipe.get("inputs", [])
			var in_max: int = Catalog.get_item_stack_size(str(r_ins[0].get("itemName", "Iron Ore"))) if r_ins.size() > 0 else 100
			var dual_w: float = 96.0
			var dual_x: float = nx + nw - dual_w - 18.0

			# Top mini bar: IN (#0891B2)
			var in_rect := Rect2(dual_x, ny + 60.5, dual_w, 10.5)
			_draw_rounded_box(in_rect, 3.0, Color("#1E293B"))
			var in_pct: float = clampf(float(in_stored) / float(maxi(1, in_max)), 0.0, 1.0)
			if in_pct > 0.0:
				_draw_rounded_box(Rect2(dual_x, ny + 60.5, maxf(4.0, dual_w * in_pct), 10.5), 3.0, Color("#0891B2"))
			draw_string(font, Vector2(dual_x, ny + 68.5), "IN %d/%d" % [in_stored, in_max], HORIZONTAL_ALIGNMENT_CENTER, dual_w, 7, Color("#F8FAFC"))

			# Bottom mini bar: OUT (#0D9488 or #D97706 when full)
			var out_rect := Rect2(dual_x, ny + 73.0, dual_w, 10.5)
			_draw_rounded_box(out_rect, 3.0, Color("#1E293B"))
			var out_pct: float = clampf(float(out_stored) / float(out_max), 0.0, 1.0)
			if out_pct > 0.0:
				_draw_rounded_box(Rect2(dual_x, ny + 73.0, maxf(4.0, dual_w * out_pct), 10.5), 3.0, Color("#D97706") if out_stored >= out_max else Color("#0D9488"))
			draw_string(font, Vector2(dual_x, ny + 81.0), "OUT %d/%d" % [out_stored, out_max], HORIZONTAL_ALIGNMENT_CENTER, dual_w, 7, Color("#F8FAFC"))
		else:
			var cur_st: int = int(n.get("storage", 0))
			var max_st: int = maxi(1, int(n.get("maxStorage", 100)))
			var s_w: float = 88.0
			var s_x: float = nx + nw - s_w - 18.0
			_draw_rounded_box(Rect2(s_x, ny + 65.0, s_w, 14.0), 4.0, Color("#1E293B"))
			var st_pct: float = clampf(float(cur_st) / float(max_st), 0.0, 1.0)
			if st_pct > 0.0:
				_draw_rounded_box(Rect2(s_x, ny + 65.0, maxf(4.0, s_w * st_pct), 14.0), 4.0, Color("#0D9488"))
			draw_string(font, Vector2(s_x, ny + 75.0), "%d/%d" % [cur_st, max_st], HORIZONTAL_ALIGNMENT_CENTER, s_w, 8, Color("#F8FAFC"))

		# Bottom Cycle Progress Bar
		var cyc_prog: float = clampf(float(n.get("cycleProgress", 0.0)), 0.0, 1.0)
		if is_processor and status_raw == "running" and not is_stby:
			_draw_rounded_box(Rect2(nx + 14.0, ny + nh - 8.0, nw - 28.0, 4.0), 2.0, Color("#090D16"))
			if cyc_prog > 0.01:
				_draw_rounded_box(Rect2(nx + 14.0, ny + nh - 8.0, (nw - 28.0) * cyc_prog, 4.0), 2.0, accent)

	# ------------------------------------------------------------------------
	# INPUT & OUTPUT PORT SOCKETS WITH ITEM ICONS & RATE PILLS
	# ------------------------------------------------------------------------
	var ins: Array = n.get("inputs", [])
	for i in range(ins.size()):
		var p_pos: Vector2 = Catalog.get_port_world_position(n, "input", i, ins.size())
		_draw_port_socket(p_pos, ins[i], "input", b_id == "miner_mk1", font)

	var outs_arr: Array = n.get("outputs", [])
	for i in range(outs_arr.size()):
		var p_pos: Vector2 = Catalog.get_port_world_position(n, "output", i, outs_arr.size())
		_draw_port_socket(p_pos, outs_arr[i], "output", b_id == "miner_mk1", font)

func _draw_port_socket(p_pos: Vector2, port: Dictionary, side: String, is_miner: bool, font: Font) -> void:
	var item_name: String = str(port.get("itemName", ""))
	var target_rate: float = float(port.get("ratePerMin", 0.0))
	var actual_rate: float = float(port.get("actualRatePerMin", 0.0))
	var ring_col: Color = Color("#38BDF8") if side == "input" else Color("#F59E0B")

	# Port Rate Readout Pill (on interior cards, not exterior Miner Mk.1)
	if not is_miner and (target_rate > 0.0 or actual_rate > 0.0):
		var is_compact: bool = str(GameState.settings.get("rateDisplayFormat", "per_minute")) == "compact"
		var rate_col: Color = Color("#22C55E") if (target_rate > 0.0 and actual_rate >= target_rate * 0.98) else (Color("#FACC15") if actual_rate > 0.0 else Color("#94A3B8"))
		var num_str: String = "%d/%d" % [int(roundf(actual_rate)), int(roundf(target_rate))] if target_rate > 0.0 else ("%d" % int(roundf(actual_rate)))
		var pill_text: String = (num_str + "/m") if is_compact else (num_str + "/min")
		var tw: float = maxf(46.0, font.get_string_size(pill_text, HORIZONTAL_ALIGNMENT_LEFT, -1, 8).x + 10.0)
		var px: float = (p_pos.x + 19.0) if side == "input" else (p_pos.x - 19.0 - tw)
		var p_rect := Rect2(px, p_pos.y - 9.0, tw, 18.0)
		_draw_rounded_box(p_rect, 4.0, Color(0.04, 0.06, 0.1, 0.92), Color("#1E293B"), 1.0)
		draw_string(font, Vector2(p_rect.position.x, p_rect.position.y + 12.0), pill_text, HORIZONTAL_ALIGNMENT_CENTER, tw, 8, rate_col)

	var r: float = 14.5
	draw_circle(p_pos, r, Color("#0B0F19"))
	draw_arc(p_pos, r, 0.0, TAU, 22, ring_col, 2.2)

	var p_tex: Texture2D = Catalog.get_item_texture(item_name) if (not item_name.is_empty() and item_name != "Any" and item_name != "Output") else null
	if p_tex:
		draw_texture_rect(p_tex, Rect2(p_pos.x - 9.5, p_pos.y - 9.5, 19.0, 19.0), false)
	else:
		draw_circle(p_pos, 4.2, ring_col)

# ============================================================================
# GHOST BUILDING PLACEMENT HOLOGRAM
# ============================================================================
func _draw_ghost_placement_preview(_cam_z: float, font: Font) -> void:
	var b_def: Dictionary = Catalog.BUILDINGS.get(GameState.active_build_id, {})
	if b_def.is_empty():
		return
	var bw: float = float(b_def.get("width", 268.0))
	var bh: float = float(b_def.get("height", 144.0))
	var snap_res: Dictionary = Router.compute_node_snap_alignment(
		GameState.active_build_id,
		_pointer_world.x - bw * 0.5,
		_pointer_world.y - bh * 0.5,
		bw,
		bh,
		GameState.nodes,
		[],
		bool(GameState.settings.get("snapToGrid", true))
	)
	var gx: float = float(snap_res.get("x", _pointer_world.x))
	var gy: float = float(snap_res.get("y", _pointer_world.y))
	var guidelines: Array = snap_res.get("guidelines", [])
	for g in guidelines:
		var p1 := Vector2(float(g.get("x1", 0.0)), float(g.get("y1", 0.0)))
		var p2 := Vector2(float(g.get("x2", 0.0)), float(g.get("y2", 0.0)))
		draw_line(p1, p2, Color("#38BDF8"), 2.0)

	var is_valid: bool = Router.is_node_position_valid(GameState.active_build_id, gx, gy, bw, bh, GameState.nodes)
	var status_msg: String = "TAP TO PLACE"
	if GameState.active_build_id == "miner_mk1":
		var dep: Dictionary = Router.find_underlying_deposit_for_miner(gx, gy, bw, bh, GameState.nodes)
		if dep.is_empty():
			is_valid = false
			status_msg = "MOUNT ON RESOURCE DEPOSIT"
	if not is_valid and status_msg == "TAP TO PLACE":
		status_msg = "COLLISION — INVALID POSITION"

	var col_border: Color = Color("#38BDF8") if is_valid else Color("#EF4444")
	var col_fill: Color = Color(0.055, 0.647, 0.914, 0.20) if is_valid else Color(0.937, 0.267, 0.267, 0.22)
	_draw_rounded_box(Rect2(gx, gy, bw, bh), 14.0, col_fill, col_border, 2.5)
	draw_string(font, Vector2(gx, gy + bh * 0.46), str(b_def.get("name", "Machine")), HORIZONTAL_ALIGNMENT_CENTER, bw, 14, Color("#F8FAFC"))
	draw_string(font, Vector2(gx, gy + bh * 0.65), status_msg, HORIZONTAL_ALIGNMENT_CENTER, bw, 11, col_border)
