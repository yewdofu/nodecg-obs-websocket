import {useReplicant} from "@nodecg/react-hooks";
import {type CSSProperties, useState} from "react";
import type {ObsAudioInputs} from "../../../types/generated/obsAudioInputs";
import type {ObsStatus} from "../../../types/generated/obsStatus";
import type {
	SetInputVolume,
	ToggleInputMute,
} from "../../../types/obs-messages";
import {render} from "../../render";

type AudioInput = ObsAudioInputs[number];

// OBS のミキサーと同じく、スライダー位置の3乗を音量倍率とする
const positionToMul = (position: number) => position ** 3;
const mulToPosition = (mul: number) => Math.min(Math.cbrt(mul), 1);

const formatDb = (db: number) =>
	Number.isFinite(db) && db > -100 ? `${db.toFixed(1)} dB` : "-∞ dB";

const statusLabel: Record<ObsStatus["status"], string> = {
	connected: "接続中",
	connecting: "接続試行中",
	disconnected: "未接続",
};

const statusColor: Record<ObsStatus["status"], string> = {
	connected: "#4caf50",
	connecting: "#ffb300",
	disconnected: "#e53935",
};

const styles = {
	root: {
		padding: 8,
		color: "#fff",
		fontFamily: "sans-serif",
		fontSize: 14,
	},
	status: {
		display: "flex",
		alignItems: "center",
		gap: 6,
		marginBottom: 8,
	},
	statusDot: {
		width: 10,
		height: 10,
		borderRadius: "50%",
	},
	error: {
		color: "#ef9a9a",
		fontSize: 12,
		marginBottom: 8,
		wordBreak: "break-all",
	},
	input: {
		display: "grid",
		gridTemplateColumns: "1fr auto",
		gridTemplateRows: "auto auto",
		columnGap: 8,
		alignItems: "center",
		padding: "6px 0",
		borderTop: "1px solid rgba(255, 255, 255, 0.15)",
	},
	header: {
		display: "flex",
		justifyContent: "space-between",
		gap: 8,
		minWidth: 0,
	},
	name: {
		overflow: "hidden",
		textOverflow: "ellipsis",
		whiteSpace: "nowrap",
	},
	db: {
		fontVariantNumeric: "tabular-nums",
		opacity: 0.8,
	},
	slider: {
		width: "100%",
		margin: 0,
	},
	muteButton: {
		gridRow: "1 / 3",
		gridColumn: 2,
		width: 64,
		height: 36,
		border: "none",
		borderRadius: 4,
		color: "#fff",
		cursor: "pointer",
		fontWeight: "bold",
	},
	empty: {
		opacity: 0.6,
	},
} satisfies Record<string, CSSProperties>;

const sendMessage = (name: string, data: unknown) => {
	nodecg.sendMessage(name, data).catch((error: unknown) => {
		console.error(`${name} failed`, error);
	});
};

const AudioInputControl = ({input}: {input: AudioInput}) => {
	// ドラッグ中は Replicant の更新でつまみが戻らないようローカル値を優先する
	const [draggingPosition, setDraggingPosition] = useState<number>();
	const position = draggingPosition ?? mulToPosition(input.inputVolumeMul);
	const db =
		draggingPosition === undefined
			? input.inputVolumeDb
			: 20 * Math.log10(positionToMul(draggingPosition));

	const changeVolume = (newPosition: number) => {
		setDraggingPosition(newPosition);
		sendMessage("obs:setInputVolume", {
			inputUuid: input.inputUuid,
			inputVolumeMul: positionToMul(newPosition),
		} satisfies SetInputVolume);
	};

	const toggleMute = () => {
		sendMessage("obs:toggleInputMute", {
			inputUuid: input.inputUuid,
		} satisfies ToggleInputMute);
	};

	return (
		<div style={styles.input}>
			<div style={styles.header}>
				<span
					style={styles.name}
					title={input.inputName}
				>
					{input.inputName}
				</span>
				<span style={styles.db}>{formatDb(db)}</span>
			</div>
			<input
				type='range'
				min={0}
				max={1}
				step={0.001}
				value={position}
				style={styles.slider}
				onChange={(e) => changeVolume(e.currentTarget.valueAsNumber)}
				onPointerUp={() => setDraggingPosition(undefined)}
				onBlur={() => setDraggingPosition(undefined)}
			/>
			<button
				type='button'
				style={{
					...styles.muteButton,
					background: input.inputMuted ? "#e53935" : "#546e7a",
				}}
				onClick={toggleMute}
			>
				{input.inputMuted ? "MUTE" : "ON"}
			</button>
		</div>
	);
};

export const ObsAudio = () => {
	const [obsStatus] = useReplicant<ObsStatus>("obsStatus");
	const [audioInputs] = useReplicant<ObsAudioInputs>("obsAudioInputs");
	const status = obsStatus?.status ?? "disconnected";

	return (
		<div style={styles.root}>
			<div style={styles.status}>
				<span style={{...styles.statusDot, background: statusColor[status]}} />
				<span>OBS: {statusLabel[status]}</span>
			</div>
			{status !== "connected" && obsStatus?.error && (
				<div style={styles.error}>{obsStatus.error}</div>
			)}
			{audioInputs?.map((input) => (
				<AudioInputControl
					key={input.inputUuid}
					input={input}
				/>
			))}
			{status === "connected" && audioInputs?.length === 0 && (
				<div style={styles.empty}>音声ソースがありません</div>
			)}
		</div>
	);
};

render(<ObsAudio />);
