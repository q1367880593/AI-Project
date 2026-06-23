# SandBlock

A small Godot 4 prototype for a sand-style Tetris game.

## Run

1. Open Godot 4.
2. Click **Import**.
3. Select this folder and open `project.godot`.
4. Press **Run**.

## Controls

- Left / A: move left
- Right / D: move right
- Up / W / Space: rotate
- Down / S: soft drop
- Enter: hard drop
- P: pause
- R: restart
- Click COLORS: cycle the maximum number of sand colors, then restart

## Prototype Rules

Tetrominoes fall like Tetris pieces. When a piece locks, each block turns into colored sand particles.
Sand falls under gravity and slides diagonally when blocked. A connected area of the same color clears
when it reaches both the left and right walls, then the remaining sand settles again.
