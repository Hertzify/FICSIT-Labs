class_name FactorySim
extends RefCounted
## ============================================================================
## FICSIT Labs — 20 Hz Discrete Factory & Conveyor Simulation Engine
## ============================================================================

const FIXED_SIM_DT: float = 0.05

static func create_machine_node(
	building_id: String,
	x: float,
	y: float,
	custom_id: String = "",
	custom_recipe_id: String = ""
) -> Dictionary:
	var b_def: Dictionary = Catalog.BUILDINGS.get(building_id, Catalog.BUILDINGS["smelter"])
	var nid: String = custom_id if not custom_id.is_empty() else "%s_%d_%d" % [building_id, Time.get_ticks_msec(), randi() % 10000]
	var recipe_id: String = custom_recipe_id if not custom_recipe_id.is_empty() else str(b_def.get("defaultRecipeId", ""))
	var recipe: Dictionary = Catalog.RECIPES.get(recipe_id, {})

	var in_count: int = int(b_def.get("inputPortCount", 0))
	var out_count: int = int(b_def.get("outputPortCount", 0))

	var inputs: Array[Dictionary] = []
	var r_inputs: Array = recipe.get("inputs", [])
	for i in range(in_count):
		var item_name: String = "Any"
		var rate: float = 0.0
		if i < r_inputs.size():
			item_name = str(r_inputs[i].get("itemName", "Any"))
			rate = float(r_inputs[i].get("ratePerMin", 0.0))
		inputs.append({
			"id": "%s_in_%d" % [nid, i],
			"label": "In %d" % [i + 1],
			"side": "input",
			"index": i,
			"itemName": item_name,
			"ratePerMin": rate,
			"actualRatePerMin": 0.0,
		})

	var outputs: Array[Dictionary] = []
	var r_outputs: Array = recipe.get("outputs", [])
	for i in range(out_count):
		var item_name: String = "Output"
		var rate: float = 0.0
		if i < r_outputs.size():
			item_name = str(r_outputs[i].get("itemName", "Output"))
			rate = float(r_outputs[i].get("ratePerMin", 0.0))
		outputs.append({
			"id": "%s_out_%d" % [nid, i],
			"label": "Out %d" % [i + 1],
			"side": "output",
			"index": i,
			"itemName": item_name,
			"ratePerMin": rate,
			"actualRatePerMin": 0.0,
		})

	var max_store: int = Catalog.get_building_max_storage(building_id, recipe_id)

	return {
		"id": nid,
		"buildingId": building_id,
		"title": str(b_def.get("name", "Machine")),
		"recipeId": recipe_id,
		"purity": "normal",
		"x": x,
		"y": y,
		"width": float(b_def.get("width", 268.0)),
		"height": float(b_def.get("height", 144.0)),
		"inputs": inputs,
		"outputs": outputs,
		"efficiency": 100.0 if building_id == "resource_deposit" else 0.0,
		"status": "running" if building_id == "resource_deposit" else "starved",
		"overclock": 100.0,
		"powerShards": 0,
		"somersloops": 0,
		"standby": false,
		"storage": 0,
		"inputStorage2": 0,
		"outputStorage": 0,
		"maxStorage": max_store,
		"cycleProgress": 0.0,
		"bufferedItemName": "",
		"splitterOutIdx": 0,
	}

static func change_node_recipe(node: Dictionary, new_recipe_id: String) -> void:
	if not Catalog.RECIPES.has(new_recipe_id):
		return
	var recipe: Dictionary = Catalog.RECIPES[new_recipe_id]
	node["recipeId"] = new_recipe_id
	node["storage"] = 0
	node["inputStorage2"] = 0
	node["outputStorage"] = 0
	node["cycleProgress"] = 0.0
	var r_inputs: Array = recipe.get("inputs", [])
	var inputs: Array = node.get("inputs", [])
	for i in range(inputs.size()):
		if i < r_inputs.size():
			inputs[i]["itemName"] = str(r_inputs[i].get("itemName", "Any"))
			inputs[i]["ratePerMin"] = float(r_inputs[i].get("ratePerMin", 0.0))
	var r_outputs: Array = recipe.get("outputs", [])
	var outputs: Array = node.get("outputs", [])
	for i in range(outputs.size()):
		if i < r_outputs.size():
			outputs[i]["itemName"] = str(r_outputs[i].get("itemName", "Output"))
			outputs[i]["ratePerMin"] = float(r_outputs[i].get("ratePerMin", 0.0))
	node["maxStorage"] = Catalog.get_building_max_storage(str(node.get("buildingId", "")), new_recipe_id)

static func can_node_accept_item(node: Dictionary, port_id: String, item_name: String) -> bool:
	var b_id: String = str(node.get("buildingId", ""))
	if b_id == "resource_deposit" or b_id == "miner_mk1":
		return false
	if b_id == "the_hub" or b_id == "storage_container":
		var max_cap: int = Catalog.get_building_max_storage(b_id, "", item_name)
		node["maxStorage"] = max_cap
		return int(node.get("storage", 0)) < max_cap
	if b_id == "splitter" or b_id == "merger":
		return int(node.get("outputStorage", 0)) < 9

	var recipe_id: String = str(node.get("recipeId", ""))
	var recipe: Dictionary = Catalog.RECIPES.get(recipe_id, {})
	if recipe.is_empty():
		return false
	var r_inputs: Array = recipe.get("inputs", [])
	var inputs: Array = node.get("inputs", [])
	var port_idx: int = 0
	for i in range(inputs.size()):
		if str(inputs[i].get("id", "")) == port_id:
			port_idx = i
			break
	if port_idx >= r_inputs.size():
		return false
	var expected_name: String = str(r_inputs[port_idx].get("itemName", ""))
	if not expected_name.is_empty() and expected_name != "Any" and expected_name.to_lower() != item_name.to_lower():
		return false
	var stack_cap: int = Catalog.get_item_stack_size(expected_name)
	if port_idx == 0:
		return int(node.get("storage", 0)) < stack_cap
	else:
		return int(node.get("inputStorage2", 0)) < stack_cap

static func deliver_item_to_node(node: Dictionary, port_id: String, item_name: String) -> void:
	var b_id: String = str(node.get("buildingId", ""))
	if b_id == "the_hub" or b_id == "storage_container":
		node["storage"] = int(node.get("storage", 0)) + 1
		node["outputStorage"] = int(node.get("storage", 0))
		node["bufferedItemName"] = item_name
		node["status"] = "running"
		node["efficiency"] = 100.0
		return
	if b_id == "splitter" or b_id == "merger":
		node["outputStorage"] = int(node.get("outputStorage", 0)) + 1
		node["storage"] = int(node.get("outputStorage", 0))
		node["bufferedItemName"] = item_name
		node["status"] = "running"
		node["efficiency"] = 100.0
		return

	var inputs: Array = node.get("inputs", [])
	var port_idx: int = 0
	for i in range(inputs.size()):
		if str(inputs[i].get("id", "")) == port_id:
			port_idx = i
			break
	if port_idx == 0:
		node["storage"] = int(node.get("storage", 0)) + 1
	else:
		node["inputStorage2"] = int(node.get("inputStorage2", 0)) + 1

static func step_simulation(nodes: Array, connections: Array, dt: float) -> void:
	var node_map: Dictionary = {}
	for n in nodes:
		node_map[str(n.get("id", ""))] = n

	# 1. Machine Production & Extraction Step
	for n in nodes:
		var b_id: String = str(n.get("buildingId", ""))
		if b_id == "resource_deposit":
			n["status"] = "running"
			n["efficiency"] = 100.0
			continue

		if bool(n.get("standby", false)):
			n["status"] = "standby"
			n["efficiency"] = 0.0
			continue

		var clock_pct: float = Catalog.clamp_clock_speed_pct(
			float(n.get("overclock", 100.0)),
			int(n.get("powerShards", 0))
		)
		n["overclock"] = clock_pct

		if b_id == "miner_mk1":
			var dep: Dictionary = Router.find_underlying_deposit_for_miner(
				float(n.get("x", 0.0)),
				float(n.get("y", 0.0)),
				float(n.get("width", 268.0)),
				float(n.get("height", 144.0)),
				nodes
			)
			if dep.is_empty():
				n["status"] = "starved"
				n["efficiency"] = 0.0
				var outs_empty: Array = n.get("outputs", [])
				if outs_empty.size() > 0:
					outs_empty[0]["actualRatePerMin"] = 0.0
				continue

			var dep_recipe_id: String = str(dep.get("recipeId", "deposit_iron"))
			var expected_mine_recipe: String = "mine_iron"
			if dep_recipe_id == "deposit_copper":
				expected_mine_recipe = "mine_copper"
			elif dep_recipe_id == "deposit_limestone":
				expected_mine_recipe = "mine_limestone"
			if str(n.get("recipeId", "")) != expected_mine_recipe:
				change_node_recipe(n, expected_mine_recipe)

			var purity_key: String = str(dep.get("purity", "normal"))
			n["purity"] = purity_key
			var purity_cfg: Dictionary = Catalog.PURITY_CONFIG.get(purity_key, Catalog.PURITY_CONFIG["normal"])
			var purity_mult: float = float(purity_cfg.get("multiplier", 1.0))

			var recipe: Dictionary = Catalog.RECIPES.get(str(n.get("recipeId", "mine_iron")), {})
			var r_outs: Array = recipe.get("outputs", [])
			var out_item_name: String = str(r_outs[0].get("itemName", "Iron Ore")) if r_outs.size() > 0 else "Iron Ore"
			var max_out: int = Catalog.get_item_stack_size(out_item_name)
			n["maxStorage"] = max_out

			var target_rate: float = Catalog.get_scaled_rate_per_min(60.0 * purity_mult, clock_pct)
			var outs: Array = n.get("outputs", [])
			if outs.size() > 0:
				outs[0]["itemName"] = out_item_name
				outs[0]["ratePerMin"] = target_rate

			var cur_out: int = int(n.get("outputStorage", 0))
			if cur_out >= max_out:
				n["status"] = "backed_up"
				n["efficiency"] = lerpf(float(n.get("efficiency", 0.0)), 0.0, minf(1.0, dt * 2.0))
			else:
				n["status"] = "running"
				if dt > 0.0:
					var cycle_sec: float = maxf(0.05, 60.0 / maxf(1.0, target_rate))
					var prog: float = float(n.get("cycleProgress", 0.0)) + dt / cycle_sec
					while prog >= 1.0 and int(n.get("outputStorage", 0)) < max_out:
						prog -= 1.0
						n["outputStorage"] = int(n.get("outputStorage", 0)) + 1
						n["storage"] = int(n.get("outputStorage", 0))
						n["bufferedItemName"] = out_item_name
					n["cycleProgress"] = clampf(prog, 0.0, 0.999)
				n["efficiency"] = lerpf(float(n.get("efficiency", 100.0)), 100.0, minf(1.0, dt * 4.0))

			if outs.size() > 0:
				outs[0]["actualRatePerMin"] = snappedf(target_rate * (float(n.get("efficiency", 100.0)) / 100.0), 0.1)
			continue

		if b_id == "smelter" or b_id == "constructor" or b_id == "assembler":
			var recipe_id: String = str(n.get("recipeId", ""))
			var recipe: Dictionary = Catalog.RECIPES.get(recipe_id, {})
			if recipe.is_empty():
				continue
			var r_ins: Array = recipe.get("inputs", [])
			var r_outs: Array = recipe.get("outputs", [])
			var base_cycle: float = float(recipe.get("cycleTimeSec", 2.0))
			var scaled_cycle: float = Catalog.get_scaled_cycle_time_sec(base_cycle, clock_pct)

			var need1: int = 1
			var need2: int = 0
			if r_ins.size() > 0:
				need1 = maxi(1, int(roundf(float(r_ins[0].get("ratePerMin", 30.0)) * base_cycle / 60.0)))
			if r_ins.size() > 1:
				need2 = maxi(1, int(roundf(float(r_ins[1].get("ratePerMin", 30.0)) * base_cycle / 60.0)))

			var prod_count: int = 1
			var out_item_name: String = "Output"
			var base_out_rate: float = 30.0
			if r_outs.size() > 0:
				out_item_name = str(r_outs[0].get("itemName", "Output"))
				base_out_rate = float(r_outs[0].get("ratePerMin", 30.0))
				prod_count = maxi(1, int(roundf(base_out_rate * base_cycle / 60.0)))

			var max_out: int = Catalog.get_item_stack_size(out_item_name)
			n["maxStorage"] = max_out

			var has_inputs: bool = int(n.get("storage", 0)) >= need1 and (r_ins.size() < 2 or int(n.get("inputStorage2", 0)) >= need2)
			var has_space: bool = int(n.get("outputStorage", 0)) + prod_count <= max_out

			if not has_space:
				n["status"] = "backed_up"
				n["efficiency"] = lerpf(float(n.get("efficiency", 0.0)), 0.0, minf(1.0, dt * 2.0))
			elif not has_inputs:
				n["status"] = "starved"
				n["efficiency"] = lerpf(float(n.get("efficiency", 0.0)), 0.0, minf(1.0, dt * 2.0))
			else:
				n["status"] = "running"
				if dt > 0.0:
					var prog: float = float(n.get("cycleProgress", 0.0)) + dt / maxf(0.05, scaled_cycle)
					if prog >= 1.0:
						prog -= 1.0
						n["storage"] = maxi(0, int(n.get("storage", 0)) - need1)
						if r_ins.size() > 1:
							n["inputStorage2"] = maxi(0, int(n.get("inputStorage2", 0)) - need2)
						n["outputStorage"] = mini(max_out, int(n.get("outputStorage", 0)) + prod_count)
						n["bufferedItemName"] = out_item_name
					n["cycleProgress"] = clampf(prog, 0.0, 0.999)
				n["efficiency"] = lerpf(float(n.get("efficiency", 100.0)), 100.0, minf(1.0, dt * 4.0))

			var scaled_out_rate: float = Catalog.get_scaled_rate_per_min(base_out_rate, clock_pct)
			var outs: Array = n.get("outputs", [])
			if outs.size() > 0:
				outs[0]["itemName"] = out_item_name
				outs[0]["ratePerMin"] = scaled_out_rate
				outs[0]["actualRatePerMin"] = snappedf(scaled_out_rate * (float(n.get("efficiency", 0.0)) / 100.0), 0.1)

			var ins: Array = n.get("inputs", [])
			for i in range(ins.size()):
				if i < r_ins.size():
					var sc_in: float = Catalog.get_scaled_rate_per_min(float(r_ins[i].get("ratePerMin", 30.0)), clock_pct)
					ins[i]["ratePerMin"] = sc_in
					ins[i]["actualRatePerMin"] = snappedf(sc_in * (float(n.get("efficiency", 0.0)) / 100.0), 0.1)

	# 2. Conveyor Belt Advancement, Injection & Delivery Step
	for conn in connections:
		var from_id: String = str(conn.get("fromNodeId", ""))
		var to_id: String = str(conn.get("toNodeId", ""))
		if not node_map.has(from_id) or not node_map.has(to_id):
			continue
		var from_node: Dictionary = node_map[from_id]
		var to_node: Dictionary = node_map[to_id]

		var tier_num: int = clampi(int(conn.get("beltTier", 1)), 1, 6)
		var tier_def: Dictionary = Catalog.CONVEYOR_BELT_TIERS[tier_num]
		var cap_per_min: float = float(tier_def.get("capacityPerMin", 60.0))
		var speed_px: float = float(tier_def.get("speedPxPerSec", 18.0))
		conn["maxCapacityPerMin"] = cap_per_min

		var from_outs: Array = from_node.get("outputs", [])
		var from_port_idx: int = 0
		for i in range(from_outs.size()):
			if str(from_outs[i].get("id", "")) == str(conn.get("fromPortId", "")):
				from_port_idx = i
				break
		var to_ins: Array = to_node.get("inputs", [])
		var to_port_idx: int = 0
		for i in range(to_ins.size()):
			if str(to_ins[i].get("id", "")) == str(conn.get("toPortId", "")):
				to_port_idx = i
				break

		var pts: Array[Vector2] = Router.compute_conveyor_route(
			from_node,
			from_port_idx,
			to_node,
			to_port_idx,
			conn.get("waypoints", []),
			nodes
		)
		conn["_cachedPoints"] = pts
		var path_len: float = maxf(18.0, Router.compute_polyline_length(pts))
		var min_spacing: float = clampf(Catalog.BELT_ITEM_FOOTPRINT_PX / path_len, 0.015, 0.45)

		if not conn.has("inFlightItems") or not (conn["inFlightItems"] is Array):
			conn["inFlightItems"] = []
		var items: Array = conn["inFlightItems"]

		if dt > 0.0:
			var dp: float = (speed_px * dt) / path_len
			# Advance from front (index 0 = closest to destination) to back
			for i in range(items.size()):
				var pkt: Dictionary = items[i]
				var cur_p: float = float(pkt.get("progress", 0.0))
				var limit_p: float = 1.0
				if i > 0:
					limit_p = maxf(0.0, float(items[i - 1].get("progress", 1.0)) - min_spacing)
				pkt["progress"] = minf(limit_p, cur_p + dp)

			# Deliver leading item if at destination (progress >= 1.0)
			if items.size() > 0:
				var head: Dictionary = items[0]
				if float(head.get("progress", 0.0)) >= 0.999:
					var h_item: String = str(head.get("itemName", conn.get("itemName", "Iron Ore")))
					if can_node_accept_item(to_node, str(conn.get("toPortId", "")), h_item):
						deliver_item_to_node(to_node, str(conn.get("toPortId", "")), h_item)
						items.pop_front()
						conn["firstItemArrived"] = true

			# Emit new item from source if source has outputStorage > 0 and belt tail has clearance
			var cooldown: float = maxf(0.0, float(conn.get("emitCooldown", 0.0)) - dt)
			var tail_clear: bool = items.is_empty() or float(items[items.size() - 1].get("progress", 1.0)) >= min_spacing
			var src_b_id: String = str(from_node.get("buildingId", ""))
			var avail_out: int = int(from_node.get("outputStorage", 0))
			if src_b_id == "storage_container":
				avail_out = int(from_node.get("storage", 0))

			if cooldown <= 0.0 and tail_clear and avail_out > 0 and not bool(from_node.get("standby", false)):
				var emit_name: String = str(from_node.get("bufferedItemName", ""))
				if emit_name.is_empty() and from_outs.size() > from_port_idx:
					emit_name = str(from_outs[from_port_idx].get("itemName", "Iron Ore"))
				if emit_name.is_empty() or emit_name == "Output":
					emit_name = str(conn.get("itemName", "Iron Ore"))

				items.append({
					"id": "pkt_%d_%d" % [Time.get_ticks_msec(), randi() % 10000],
					"itemName": emit_name,
					"progress": 0.0,
				})
				conn["itemName"] = emit_name
				if src_b_id == "storage_container":
					from_node["storage"] = maxi(0, avail_out - 1)
					from_node["outputStorage"] = from_node["storage"]
				else:
					from_node["outputStorage"] = maxi(0, avail_out - 1)
					if src_b_id == "miner_mk1" or src_b_id == "splitter" or src_b_id == "merger":
						from_node["storage"] = from_node["outputStorage"]
				cooldown = 60.0 / cap_per_min
			conn["emitCooldown"] = cooldown

		var src_rate: float = cap_per_min
		if from_outs.size() > from_port_idx:
			var r: float = float(from_outs[from_port_idx].get("actualRatePerMin", 0.0))
			if r > 0.0:
				src_rate = minf(cap_per_min, r)
		conn["ratePerMin"] = src_rate if items.size() > 0 else 0.0
