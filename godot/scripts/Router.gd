class_name Router
extends RefCounted
## ============================================================================
## FICSIT Labs — Orthogonal 90° Conveyor Router, Snap Lasers & Collision Math
## ============================================================================

const OBSTACLE_CLEARANCE: float = 16.0
const PORT_STUB_LEN: float = 28.0
const FILLET_RADIUS: float = 18.0

static func find_underlying_deposit_for_miner(x: float, y: float, w: float, h: float, nodes: Array) -> Dictionary:
	var m_cx: float = x + w * 0.5
	var m_cy: float = y + h * 0.5
	for n in nodes:
		if str(n.get("buildingId", "")) != "resource_deposit":
			continue
		var dx: float = float(n.get("x", 0.0))
		var dy: float = float(n.get("y", 0.0))
		var dw: float = float(n.get("width", 268.0))
		var dh: float = float(n.get("height", 144.0))
		var d_cx: float = dx + dw * 0.5
		var d_cy: float = dy + dh * 0.5
		if absf(m_cx - d_cx) <= 72.0 and absf(m_cy - d_cy) <= 60.0:
			return n
	return {}

static func do_nodes_overlap(a: Dictionary, b: Dictionary, padding: float = 6.0) -> bool:
	var ax: float = float(a.get("x", 0.0))
	var ay: float = float(a.get("y", 0.0))
	var aw: float = float(a.get("width", 268.0))
	var ah: float = float(a.get("height", 144.0))

	var bx: float = float(b.get("x", 0.0))
	var by: float = float(b.get("y", 0.0))
	var bw: float = float(b.get("width", 268.0))
	var bh: float = float(b.get("height", 144.0))

	return (
		ax < bx + bw + padding
		and ax + aw + padding > bx
		and ay < by + bh + padding
		and ay + ah + padding > by
	)

static func is_node_position_valid(
	building_id: String,
	x: float,
	y: float,
	w: float,
	h: float,
	nodes: Array,
	ignore_ids: Array = []
) -> bool:
	var candidate: Dictionary = {"buildingId": building_id, "x": x, "y": y, "width": w, "height": h}
	var allowed_deposit_id: String = ""
	if building_id == "miner_mk1":
		var dep: Dictionary = find_underlying_deposit_for_miner(x, y, w, h, nodes)
		if not dep.is_empty():
			allowed_deposit_id = str(dep.get("id", ""))

	for n in nodes:
		var nid: String = str(n.get("id", ""))
		if ignore_ids.has(nid):
			continue
		if nid == allowed_deposit_id:
			continue
		if do_nodes_overlap(candidate, n, 6.0):
			return false
	return true

static func compute_node_snap_alignment(
	building_id: String,
	raw_x: float,
	raw_y: float,
	w: float,
	h: float,
	nodes: Array,
	ignore_ids: Array = [],
	snap_enabled: bool = true
) -> Dictionary:
	var guidelines: Array[Dictionary] = []
	if not snap_enabled:
		var clamped_free: Vector2 = Catalog.clamp_node_to_world(raw_x, raw_y, w, h)
		return {"x": clamped_free.x, "y": clamped_free.y, "guidelines": guidelines}

	if building_id == "miner_mk1":
		var dep: Dictionary = find_underlying_deposit_for_miner(raw_x, raw_y, w, h, nodes)
		if not dep.is_empty():
			var dx: float = float(dep.get("x", raw_x))
			var dy: float = float(dep.get("y", raw_y))
			guidelines.append({
				"x1": dx + w * 0.5,
				"y1": dy - 40.0,
				"x2": dx + w * 0.5,
				"y2": dy + h + 40.0,
				"kind": "deposit",
			})
			return {"x": dx, "y": dy, "guidelines": guidelines}

	var snapped_x: float = Catalog.snap_to_grid(raw_x, Catalog.GRID_PITCH)
	var snapped_y: float = Catalog.snap_to_grid(raw_y, Catalog.GRID_PITCH)

	var best_dy: float = 18.0
	var best_dx: float = 18.0
	var cx: float = raw_x + w * 0.5
	var cy: float = raw_y + h * 0.5

	for n in nodes:
		var nid: String = str(n.get("id", ""))
		if ignore_ids.has(nid):
			continue
		var nx: float = float(n.get("x", 0.0))
		var ny: float = float(n.get("y", 0.0))
		var nw: float = float(n.get("width", 268.0))
		var nh: float = float(n.get("height", 144.0))
		if absf(nx - raw_x) < 1600.0 and absf(ny - raw_y) < 1200.0:
			var ncy: float = ny + nh * 0.5
			if absf(cy - ncy) < best_dy:
				best_dy = absf(cy - ncy)
				snapped_y = Catalog.snap_to_grid(ncy - h * 0.5, Catalog.GRID_PITCH)
				guidelines.append({
					"x1": minf(raw_x, nx),
					"y1": snapped_y + h * 0.5,
					"x2": maxf(raw_x + w, nx + nw),
					"y2": snapped_y + h * 0.5,
					"kind": "center",
				})
			var ncx: float = nx + nw * 0.5
			if absf(cx - ncx) < best_dx:
				best_dx = absf(cx - ncx)
				snapped_x = Catalog.snap_to_grid(ncx - w * 0.5, Catalog.GRID_PITCH)
				guidelines.append({
					"x1": snapped_x + w * 0.5,
					"y1": minf(raw_y, ny),
					"x2": snapped_x + w * 0.5,
					"y2": maxf(raw_y + h, ny + nh),
					"kind": "center",
				})

	var clamped: Vector2 = Catalog.clamp_node_to_world(snapped_x, snapped_y, w, h)
	return {"x": clamped.x, "y": clamped.y, "guidelines": guidelines}

static func compute_orthogonal_segment(p0: Vector2, p1: Vector2, start_horizontal: bool = true) -> Array[Vector2]:
	if is_equal_approx(p0.x, p1.x) or is_equal_approx(p0.y, p1.y):
		return [p0, p1]
	if start_horizontal:
		var mid_x: float = Catalog.snap_to_grid((p0.x + p1.x) * 0.5, 12.0)
		return [p0, Vector2(mid_x, p0.y), Vector2(mid_x, p1.y), p1]
	else:
		var mid_y: float = Catalog.snap_to_grid((p0.y + p1.y) * 0.5, 12.0)
		return [p0, Vector2(p0.x, mid_y), Vector2(p1.x, mid_y), p1]

static func simplify_orthogonal_polyline(pts: Array[Vector2]) -> Array[Vector2]:
	if pts.size() <= 2:
		return pts
	var cleaned: Array[Vector2] = [pts[0]]
	for i in range(1, pts.size()):
		if pts[i].distance_to(cleaned[cleaned.size() - 1]) > 0.5:
			cleaned.append(pts[i])
	if cleaned.size() <= 2:
		return cleaned

	var result: Array[Vector2] = [cleaned[0]]
	for i in range(1, cleaned.size() - 1):
		var a: Vector2 = result[result.size() - 1]
		var b: Vector2 = cleaned[i]
		var c: Vector2 = cleaned[i + 1]
		var collinear_x: bool = absf(a.x - b.x) < 0.5 and absf(b.x - c.x) < 0.5
		var collinear_y: bool = absf(a.y - b.y) < 0.5 and absf(b.y - c.y) < 0.5
		if not (collinear_x or collinear_y):
			result.append(b)
	result.append(cleaned[cleaned.size() - 1])
	return result

static func compute_conveyor_route(
	from_node: Dictionary,
	from_port_idx: int,
	to_node: Dictionary,
	to_port_idx: int,
	waypoints: Array,
	_nodes: Array
) -> Array[Vector2]:
	var out_total: int = (from_node.get("outputs", []) as Array).size()
	var in_total: int = (to_node.get("inputs", []) as Array).size()
	var p_start: Vector2 = Catalog.get_port_world_position(from_node, "output", from_port_idx, max(1, out_total))
	var p_end: Vector2 = Catalog.get_port_world_position(to_node, "input", to_port_idx, max(1, in_total))

	if waypoints.is_empty() and is_equal_approx(p_start.y, p_end.y) and p_end.x > p_start.x + 8.0:
		return [p_start, p_end]

	var stub_start := Vector2(p_start.x + PORT_STUB_LEN, p_start.y)
	var stub_end := Vector2(p_end.x - PORT_STUB_LEN, p_end.y)

	var poly: Array[Vector2] = [p_start, stub_start]
	var cur: Vector2 = stub_start

	if not waypoints.is_empty():
		for wp in waypoints:
			var wx: float = float(wp.get("x", cur.x))
			var wy: float = float(wp.get("y", cur.y))
			var target := Vector2(wx, wy)
			if absf(target.x - cur.x) > 0.5 and absf(target.y - cur.y) > 0.5:
				poly.append(Vector2(target.x, cur.y))
			poly.append(target)
			cur = target

	var tail_seg: Array[Vector2] = compute_orthogonal_segment(cur, stub_end, true)
	for i in range(1, tail_seg.size()):
		poly.append(tail_seg[i])
	poly.append(p_end)

	return simplify_orthogonal_polyline(poly)

static func compute_polyline_length(pts: Array[Vector2]) -> float:
	var total: float = 0.0
	for i in range(pts.size() - 1):
		total += pts[i].distance_to(pts[i + 1])
	return maxf(1.0, total)

static func sample_polyline(pts: Array[Vector2], progress: float) -> Dictionary:
	if pts.is_empty():
		return {"pos": Vector2.ZERO, "angle": 0.0}
	if pts.size() == 1:
		return {"pos": pts[0], "angle": 0.0}

	var total_len: float = compute_polyline_length(pts)
	var target_dist: float = clampf(progress, 0.0, 1.0) * total_len
	var accum: float = 0.0

	for i in range(pts.size() - 1):
		var a: Vector2 = pts[i]
		var b: Vector2 = pts[i + 1]
		var seg_len: float = a.distance_to(b)
		if seg_len < 0.001:
			continue
		if accum + seg_len >= target_dist or i == pts.size() - 2:
			var local_t: float = clampf((target_dist - accum) / seg_len, 0.0, 1.0)
			var pos: Vector2 = a.lerp(b, local_t)
			var angle: float = (b - a).angle()
			return {"pos": pos, "angle": angle}
		accum += seg_len

	var last: Vector2 = pts[pts.size() - 1]
	var prev: Vector2 = pts[pts.size() - 2]
	return {"pos": last, "angle": (last - prev).angle()}

static func distance_point_to_segment(p: Vector2, a: Vector2, b: Vector2) -> Dictionary:
	var ab: Vector2 = b - a
	var len_sq: float = ab.length_squared()
	if len_sq < 0.0001:
		return {"dist": p.distance_to(a), "point": a}
	var t: float = clampf((p - a).dot(ab) / len_sq, 0.0, 1.0)
	var proj: Vector2 = a + ab * t
	return {"dist": p.distance_to(proj), "point": proj}

static func distance_point_to_polyline(p: Vector2, pts: Array[Vector2]) -> Dictionary:
	var best_dist: float = INF
	var best_pt: Vector2 = p
	var best_seg: int = 0
	for i in range(pts.size() - 1):
		var res: Dictionary = distance_point_to_segment(p, pts[i], pts[i + 1])
		var d: float = float(res.get("dist", INF))
		if d < best_dist:
			best_dist = d
			best_pt = res.get("point", p)
			best_seg = i
	return {"dist": best_dist, "point": best_pt, "segmentIndex": best_seg}
