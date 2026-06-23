extends Node2D

const SAND_W := 120
const SAND_H := 220
const CELL := 6
const BLOCK_PIXELS := 6
const PIECE_COLS := SAND_W / BLOCK_PIXELS
const PIECE_ROWS := 36
const PLAY_W := SAND_W * CELL
const PLAY_H := SAND_H * CELL
const STEP_TIME := 1.0 / 55.0
const CLEAR_SETTLE_DELAY := 0.45
const MIN_COLORS := 3
const MAX_COLORS := 7

const BG := Color("05030a")
const GRID_DOT := Color("071b7a")
const BORDER := Color("6c41d8")
const BORDER_DARK := Color("20114c")
const WHITE := Color("f7f7ff")
const RED := Color("ff1515")
const UI_YELLOW := Color("fff425")
const CYAN := Color("25efd0")
const MAGENTA := Color("d51ff1")
const ORANGE := Color("ff9415")
const BLUE := Color("2d5cff")
const GREEN := Color("39e65b")
const PURPLE := Color("8f4dff")

const PALETTE := [CYAN, BLUE, ORANGE, UI_YELLOW, GREEN, MAGENTA, PURPLE]

const PIECES := {
	"I": [
		[Vector2i(-1, 0), Vector2i(0, 0), Vector2i(1, 0), Vector2i(2, 0)],
		[Vector2i(1, -1), Vector2i(1, 0), Vector2i(1, 1), Vector2i(1, 2)],
		[Vector2i(-1, 1), Vector2i(0, 1), Vector2i(1, 1), Vector2i(2, 1)],
		[Vector2i(0, -1), Vector2i(0, 0), Vector2i(0, 1), Vector2i(0, 2)],
	],
	"O": [
		[Vector2i(0, 0), Vector2i(1, 0), Vector2i(0, 1), Vector2i(1, 1)],
		[Vector2i(0, 0), Vector2i(1, 0), Vector2i(0, 1), Vector2i(1, 1)],
		[Vector2i(0, 0), Vector2i(1, 0), Vector2i(0, 1), Vector2i(1, 1)],
		[Vector2i(0, 0), Vector2i(1, 0), Vector2i(0, 1), Vector2i(1, 1)],
	],
	"T": [
		[Vector2i(-1, 0), Vector2i(0, 0), Vector2i(1, 0), Vector2i(0, 1)],
		[Vector2i(0, -1), Vector2i(0, 0), Vector2i(1, 0), Vector2i(0, 1)],
		[Vector2i(0, -1), Vector2i(-1, 0), Vector2i(0, 0), Vector2i(1, 0)],
		[Vector2i(0, -1), Vector2i(-1, 0), Vector2i(0, 0), Vector2i(0, 1)],
	],
	"L": [
		[Vector2i(-1, 0), Vector2i(0, 0), Vector2i(1, 0), Vector2i(1, 1)],
		[Vector2i(0, -1), Vector2i(0, 0), Vector2i(0, 1), Vector2i(1, -1)],
		[Vector2i(-1, -1), Vector2i(-1, 0), Vector2i(0, 0), Vector2i(1, 0)],
		[Vector2i(-1, 1), Vector2i(0, -1), Vector2i(0, 0), Vector2i(0, 1)],
	],
	"J": [
		[Vector2i(-1, 0), Vector2i(0, 0), Vector2i(1, 0), Vector2i(-1, 1)],
		[Vector2i(0, -1), Vector2i(0, 0), Vector2i(0, 1), Vector2i(1, 1)],
		[Vector2i(1, -1), Vector2i(-1, 0), Vector2i(0, 0), Vector2i(1, 0)],
		[Vector2i(-1, -1), Vector2i(0, -1), Vector2i(0, 0), Vector2i(0, 1)],
	],
	"S": [
		[Vector2i(0, 0), Vector2i(1, 0), Vector2i(-1, 1), Vector2i(0, 1)],
		[Vector2i(0, -1), Vector2i(0, 0), Vector2i(1, 0), Vector2i(1, 1)],
		[Vector2i(0, 0), Vector2i(1, 0), Vector2i(-1, 1), Vector2i(0, 1)],
		[Vector2i(0, -1), Vector2i(0, 0), Vector2i(1, 0), Vector2i(1, 1)],
	],
	"Z": [
		[Vector2i(-1, 0), Vector2i(0, 0), Vector2i(0, 1), Vector2i(1, 1)],
		[Vector2i(1, -1), Vector2i(0, 0), Vector2i(1, 0), Vector2i(0, 1)],
		[Vector2i(-1, 0), Vector2i(0, 0), Vector2i(0, 1), Vector2i(1, 1)],
		[Vector2i(1, -1), Vector2i(0, 0), Vector2i(1, 0), Vector2i(0, 1)],
	],
}

var grid: Array = []
var rng := RandomNumberGenerator.new()
var bag: Array[String] = []
var current := {}
var next_piece := {}
var piece_pos := Vector2i(PIECE_COLS / 2, 1)
var fall_timer := 0.0
var sim_timer := 0.0
var move_cooldown := 0.0
var clear_check_timer := -1.0
var score := 0
var lines := 0
var level := 1
var moves := 0
var max_colors := 7
var paused := false
var game_over := false
var play_origin := Vector2.ZERO
var colors_button_rect := Rect2()


func _ready() -> void:
	rng.randomize()
	_reset_game()


func _process(delta: float) -> void:
	if Input.is_action_just_pressed("restart_game"):
		_reset_game()
	if Input.is_action_just_pressed("pause_game") and not game_over:
		paused = not paused
	if paused or game_over:
		queue_redraw()
		return

	move_cooldown = maxf(move_cooldown - delta, 0.0)
	_handle_input()
	_update_piece(delta)
	_update_sand(delta)
	_update_clear_check(delta)
	queue_redraw()


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		var mouse_event := event as InputEventMouseButton
		if mouse_event.button_index == MOUSE_BUTTON_LEFT and mouse_event.pressed:
			if colors_button_rect.has_point(mouse_event.position):
				max_colors += 1
				if max_colors > MAX_COLORS:
					max_colors = MIN_COLORS
				_reset_game()


func _reset_game() -> void:
	grid.clear()
	for y in range(SAND_H):
		var row: Array[int] = []
		for x in range(SAND_W):
			row.append(-1)
		grid.append(row)
	bag.clear()
	score = 0
	lines = 0
	level = 1
	moves = 0
	clear_check_timer = -1.0
	paused = false
	game_over = false
	next_piece = _make_piece()
	_spawn_piece()
	queue_redraw()


func _make_piece() -> Dictionary:
	if bag.is_empty():
		bag = ["I", "O", "T", "L", "J", "S", "Z"]
		bag.shuffle()
	var kind: String = bag.pop_back()
	var color_index := rng.randi_range(0, max_colors - 1)
	return {
		"kind": kind,
		"rotation": 0,
		"color": color_index,
	}


func _spawn_piece() -> void:
	current = next_piece
	next_piece = _make_piece()
	piece_pos = Vector2i(PIECE_COLS / 2, 1)
	fall_timer = 0.0
	if not _piece_fits(piece_pos, int(current["rotation"])):
		game_over = true


func _handle_input() -> void:
	if Input.is_action_just_pressed("rotate_piece"):
		_try_rotate()
	if Input.is_action_just_pressed("hard_drop"):
		_hard_drop()

	var direction := 0
	if Input.is_action_pressed("move_left"):
		direction -= 1
	if Input.is_action_pressed("move_right"):
		direction += 1
	if direction != 0 and move_cooldown <= 0.0:
		_try_move(Vector2i(direction, 0))
		move_cooldown = 0.085


func _update_piece(delta: float) -> void:
	var speed := maxf(0.08, 0.72 - (level - 1) * 0.055)
	if Input.is_action_pressed("soft_drop"):
		speed *= 0.12
	fall_timer += delta
	if fall_timer >= speed:
		fall_timer = 0.0
		if not _try_move(Vector2i(0, 1)):
			_lock_piece()


func _try_move(offset: Vector2i) -> bool:
	var target := piece_pos + offset
	if _piece_fits(target, int(current["rotation"])):
		piece_pos = target
		if offset.x != 0:
			moves += 1
		return true
	return false


func _try_rotate() -> void:
	var next_rotation := (int(current["rotation"]) + 1) % 4
	for kick in [Vector2i.ZERO, Vector2i(-1, 0), Vector2i(1, 0), Vector2i(0, -1), Vector2i(-2, 0), Vector2i(2, 0)]:
		if _piece_fits(piece_pos + kick, next_rotation):
			piece_pos += kick
			current["rotation"] = next_rotation
			moves += 1
			return


func _hard_drop() -> void:
	while _try_move(Vector2i(0, 1)):
		score += 1
	_lock_piece()


func _piece_fits(pos: Vector2i, rotation: int) -> bool:
	for block: Vector2i in _piece_blocks(str(current["kind"]), rotation):
		var p: Vector2i = pos + block
		if p.x < 0 or p.x >= PIECE_COLS or p.y < 0 or p.y >= PIECE_ROWS:
			return false
		if _block_hits_sand(p):
			return false
	return true


func _block_hits_sand(block_pos: Vector2i) -> bool:
	var sx0 := block_pos.x * BLOCK_PIXELS
	var sy0 := block_pos.y * BLOCK_PIXELS
	for y in range(sy0, sy0 + BLOCK_PIXELS):
		for x in range(sx0, sx0 + BLOCK_PIXELS):
			if y >= 0 and y < SAND_H and x >= 0 and x < SAND_W and grid[y][x] != -1:
				return true
	return false


func _piece_blocks(kind: String, rotation: int) -> Array[Vector2i]:
	var blocks: Array[Vector2i] = []
	for block: Vector2i in PIECES[kind][rotation]:
		blocks.append(block)
	return blocks


func _lock_piece() -> void:
	var color_index := int(current["color"])
	for block: Vector2i in _piece_blocks(str(current["kind"]), int(current["rotation"])):
		var bp: Vector2i = piece_pos + block
		var sx0: int = bp.x * BLOCK_PIXELS
		var sy0: int = bp.y * BLOCK_PIXELS
		for y in range(sy0, sy0 + BLOCK_PIXELS):
			for x in range(sx0, sx0 + BLOCK_PIXELS):
				if x >= 0 and x < SAND_W and y >= 0 and y < SAND_H:
					grid[y][x] = color_index
	score += 25
	moves += 1
	clear_check_timer = CLEAR_SETTLE_DELAY
	_spawn_piece()


func _update_sand(delta: float) -> void:
	sim_timer += delta
	while sim_timer >= STEP_TIME:
		sim_timer -= STEP_TIME
		var moved := false
		for y in range(SAND_H - 2, -1, -1):
			var left_first := rng.randi_range(0, 1) == 0
			for x_raw in range(SAND_W):
				var x := x_raw if left_first else SAND_W - 1 - x_raw
				if grid[y][x] == -1:
					continue
				if _try_swap_sand(x, y, x, y + 1):
					moved = true
					continue
				var dx1 := -1 if rng.randi_range(0, 1) == 0 else 1
				var dx2 := -dx1
				if not _try_swap_sand(x, y, x + dx1, y + 1):
					if _try_swap_sand(x, y, x + dx2, y + 1):
						moved = true
				else:
					moved = true
		if moved:
			clear_check_timer = CLEAR_SETTLE_DELAY


func _update_clear_check(delta: float) -> void:
	if clear_check_timer < 0.0:
		return
	clear_check_timer -= delta
	if clear_check_timer <= 0.0:
		clear_check_timer = -1.0
		if _clear_connected_spans():
			clear_check_timer = CLEAR_SETTLE_DELAY


func _try_swap_sand(x1: int, y1: int, x2: int, y2: int) -> bool:
	if x2 < 0 or x2 >= SAND_W or y2 < 0 or y2 >= SAND_H:
		return false
	if grid[y2][x2] != -1:
		return false
	grid[y2][x2] = grid[y1][x1]
	grid[y1][x1] = -1
	return true


func _clear_connected_spans() -> bool:
	var visited: Array = []
	for y in range(SAND_H):
		var row: Array[bool] = []
		for x in range(SAND_W):
			row.append(false)
		visited.append(row)

	var cleared_groups := 0
	var cleared_particles := 0
	for y in range(SAND_H - 1, -1, -1):
		for x in range(SAND_W):
			if visited[y][x] or grid[y][x] == -1:
				continue
			var result := _collect_connected_region(Vector2i(x, y), visited)
			if bool(result["touches_left"]) and bool(result["touches_right"]):
				for p: Vector2i in result["cells"]:
					grid[p.y][p.x] = -1
				cleared_groups += 1
				cleared_particles += result["cells"].size()
	if cleared_groups > 0:
		lines += cleared_groups
		score += cleared_groups * 220 + cleared_particles
		level = 1 + lines / 5
		return true
	return false


func _collect_connected_region(start: Vector2i, visited: Array) -> Dictionary:
	var color: int = grid[start.y][start.x]
	var stack: Array[Vector2i] = [start]
	var cells: Array[Vector2i] = []
	var touches_left := false
	var touches_right := false
	visited[start.y][start.x] = true

	while not stack.is_empty():
		var p: Vector2i = stack.pop_back()
		cells.append(p)
		touches_left = touches_left or p.x == 0
		touches_right = touches_right or p.x == SAND_W - 1
		for dir: Vector2i in [Vector2i.LEFT, Vector2i.RIGHT, Vector2i.UP, Vector2i.DOWN]:
			var n: Vector2i = p + dir
			if n.x < 0 or n.x >= SAND_W or n.y < 0 or n.y >= SAND_H:
				continue
			if visited[n.y][n.x] or grid[n.y][n.x] != color:
				continue
			visited[n.y][n.x] = true
			stack.append(n)
	return {
		"cells": cells,
		"touches_left": touches_left,
		"touches_right": touches_right,
	}


func _draw() -> void:
	var viewport := get_viewport_rect().size
	draw_rect(Rect2(Vector2.ZERO, viewport), BG)

	var scale := minf(viewport.x / 1080.0, viewport.y / 1920.0)
	var board_size := Vector2(PLAY_W, PLAY_H) * scale
	play_origin = Vector2((viewport.x - board_size.x) * 0.5, viewport.y - board_size.y - 92.0 * scale)

	_draw_ui(scale)
	_draw_board(scale)
	_draw_sand(scale)
	_draw_piece(scale)
	_draw_overlay(scale)


func _draw_ui(scale: float) -> void:
	var top := 100.0 * scale
	var left := play_origin.x
	var right := play_origin.x + PLAY_W * scale
	_draw_label("LEVEL %02d" % level, Vector2(left, top), UI_YELLOW, 33 * scale)
	_draw_label("MOVES %03d" % moves, Vector2(right - 210 * scale, top), UI_YELLOW, 33 * scale)
	_draw_label("SCORE", Vector2(left, top + 92 * scale), UI_YELLOW, 30 * scale)
	_draw_label(str(score), Vector2(left, top + 138 * scale), WHITE, 70 * scale)
	colors_button_rect = Rect2(left, top + 242 * scale, 180 * scale, 48 * scale)
	draw_rect(colors_button_rect, Color("18122c"))
	draw_rect(colors_button_rect, UI_YELLOW, false, 3 * scale)
	_draw_label("COLORS %d" % max_colors, colors_button_rect.position + Vector2(14, 32) * scale, UI_YELLOW, 24 * scale)
	_draw_label("NEXT", Vector2(right - 160 * scale, top + 92 * scale), UI_YELLOW, 36 * scale)
	_draw_next_piece(Vector2(right - 122 * scale, top + 162 * scale), scale)
	draw_rect(Rect2(Vector2(66 * scale, 52 * scale), Vector2(22 * scale, 82 * scale)), UI_YELLOW)
	draw_rect(Rect2(Vector2(98 * scale, 52 * scale), Vector2(22 * scale, 82 * scale)), UI_YELLOW)


func _draw_board(scale: float) -> void:
	var board_rect := Rect2(play_origin, Vector2(PLAY_W, PLAY_H) * scale)
	draw_rect(board_rect.grow(12 * scale), BORDER_DARK)
	draw_rect(Rect2(play_origin - Vector2(14, 0) * scale, Vector2(10, PLAY_H) * scale), BORDER)
	draw_rect(Rect2(play_origin + Vector2(PLAY_W + 4, 0) * scale, Vector2(10, PLAY_H) * scale), BORDER)
	draw_rect(Rect2(play_origin + Vector2(0, PLAY_H + 6) * scale, Vector2(PLAY_W, 10) * scale), Color("1199f2"))
	for y in range(10, SAND_H, 12):
		for x in range(5, SAND_W, 12):
			draw_rect(Rect2(_sand_to_screen(x, y, scale), Vector2(2, 2) * scale), GRID_DOT)
	var danger_y := play_origin.y + 10 * BLOCK_PIXELS * CELL * scale
	draw_line(Vector2(play_origin.x, danger_y), Vector2(play_origin.x + PLAY_W * scale, danger_y), RED, 5 * scale)


func _draw_sand(scale: float) -> void:
	for y in range(SAND_H):
		for x in range(SAND_W):
			var color_index: int = grid[y][x]
			if color_index == -1:
				continue
			var color: Color = PALETTE[color_index]
			draw_rect(Rect2(_sand_to_screen(x, y, scale), Vector2(CELL, CELL) * scale), color)


func _draw_piece(scale: float) -> void:
	if game_over:
		return
	var color: Color = PALETTE[int(current["color"])]
	for block: Vector2i in _piece_blocks(str(current["kind"]), int(current["rotation"])):
		var bp: Vector2i = piece_pos + block
		var p: Vector2 = play_origin + Vector2(bp.x * BLOCK_PIXELS * CELL, bp.y * BLOCK_PIXELS * CELL) * scale
		draw_rect(Rect2(p, Vector2(BLOCK_PIXELS * CELL, BLOCK_PIXELS * CELL) * scale), color)
		draw_rect(Rect2(p + Vector2(12, 12) * scale, Vector2(8, 8) * scale), color.lightened(0.2))
		draw_rect(Rect2(p + Vector2(24, 24) * scale, Vector2(7, 7) * scale), color.darkened(0.14))


func _draw_next_piece(origin: Vector2, scale: float) -> void:
	var color: Color = PALETTE[int(next_piece["color"])]
	for block in _piece_blocks(str(next_piece["kind"]), 0):
		var p := origin + Vector2((block.x + 1) * 24, (block.y + 1) * 24) * scale
		draw_rect(Rect2(p, Vector2(22, 22) * scale), color)


func _draw_overlay(scale: float) -> void:
	if not paused and not game_over:
		return
	var text := "PAUSED" if paused else "GAME OVER"
	var sub := "P TO RESUME" if paused else "R TO RESTART"
	var center := play_origin + Vector2(PLAY_W, PLAY_H) * scale * 0.5
	draw_rect(Rect2(center - Vector2(235, 92) * scale, Vector2(470, 184) * scale), Color(0, 0, 0, 0.82))
	_draw_label(text, center - Vector2(175, 32) * scale, UI_YELLOW, 45 * scale)
	_draw_label(sub, center - Vector2(145, -30) * scale, WHITE, 24 * scale)


func _sand_to_screen(x: int, y: int, scale: float) -> Vector2:
	return play_origin + Vector2(x * CELL, y * CELL) * scale


func _draw_label(text: String, pos: Vector2, color: Color, size: float) -> void:
	draw_string(ThemeDB.fallback_font, pos, text, HORIZONTAL_ALIGNMENT_LEFT, -1, size, color)
