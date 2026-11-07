extends Node
## ============================================================================
## FICSIT Labs — Procedural PCM Synthesizer SFX (`SynthAudio.gd`)
## ============================================================================
## Generates zero-asset low-overhead tactile UI and machine sound effects using
## Godot 4's AudioStreamGenerator. Clock speed adjustments intentionally play
## zero sound effects per user specification.

var _player: AudioStreamPlayer
var _playback: AudioStreamGeneratorPlayback
var _sample_rate: float = 22050.0

func _ready() -> void:
	_player = AudioStreamPlayer.new()
	var stream := AudioStreamGenerator.new()
	stream.mix_rate = _sample_rate
	stream.buffer_length = 0.25
	_player.stream = stream
	_player.volume_db = -8.0
	add_child(_player)
	_player.play()
	_playback = _player.get_stream_playback() as AudioStreamGeneratorPlayback

func play_sfx(kind: String) -> void:
	if not GameState or not GameState.settings.get("sfxEnabled", true):
		return
	if _playback == null:
		return

	var duration: float = 0.06
	var start_freq: float = 420.0
	var end_freq: float = 280.0
	var amp: float = 0.18

	match kind:
		"click":
			duration = 0.035
			start_freq = 540.0
			end_freq = 380.0
			amp = 0.14
		"place":
			duration = 0.08
			start_freq = 240.0
			end_freq = 150.0
			amp = 0.22
		"connect":
			duration = 0.075
			start_freq = 360.0
			end_freq = 640.0
			amp = 0.18
		"disconnect":
			duration = 0.075
			start_freq = 480.0
			end_freq = 210.0
			amp = 0.18
		"error":
			duration = 0.11
			start_freq = 170.0
			end_freq = 115.0
			amp = 0.24
		"save":
			duration = 0.09
			start_freq = 520.0
			end_freq = 880.0
			amp = 0.16
		_:
			return

	var total_frames: int = mini(int(_sample_rate * duration), _playback.get_frames_available())
	var phase: float = 0.0
	for i in range(total_frames):
		var t: float = float(i) / float(max(1, total_frames))
		var freq: float = lerpf(start_freq, end_freq, t)
		var env: float = (1.0 - t) * (1.0 - t)
		phase += freq / _sample_rate
		var sample: float = sin(phase * TAU) * amp * env
		_playback.push_frame(Vector2(sample, sample))
