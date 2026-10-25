import type NodeCG from "@nodecg/types";
import type {OBSWebSocket} from "obs-websocket-js";
import type {Configschema} from "../types/generated/configschema";
import type {ObsAudioInputs} from "../types/generated/obsAudioInputs";
import type {ObsStatus} from "../types/generated/obsStatus";
import type {
	SetInputMute,
	SetInputVolume,
	ToggleInputMute,
} from "../types/obs-messages";

type AudioInput = ObsAudioInputs[number];

export const obsAudio = (
	nodecg: NodeCG.ServerAPI<Configschema>,
	obsWebSocket: OBSWebSocket,
) => {
	const log = new nodecg.Logger("obs-audio");
	const obsStatusRep = nodecg.Replicant<ObsStatus>("obsStatus");
	const audioInputsRep = nodecg.Replicant<ObsAudioInputs>("obsAudioInputs", {
		persistent: false,
		defaultValue: [],
	});

	/** 音声を持たない入力の場合は undefined を返す */
	const fetchAudioInput = async (
		inputName: string,
		inputUuid: string,
	): Promise<AudioInput | undefined> => {
		try {
			const [volume, mute] = await Promise.all([
				obsWebSocket.call("GetInputVolume", {inputUuid}),
				obsWebSocket.call("GetInputMute", {inputUuid}),
			]);
			return {
				inputName,
				inputUuid,
				inputVolumeMul: volume.inputVolumeMul,
				inputVolumeDb: volume.inputVolumeDb,
				inputMuted: mute.inputMuted,
			};
		} catch {
			return undefined;
		}
	};

	const refresh = async () => {
		try {
			const {inputs} = await obsWebSocket.call("GetInputList");
			const audioInputs = await Promise.all(
				inputs.map((input) =>
					fetchAudioInput(String(input.inputName), String(input.inputUuid)),
				),
			);
			audioInputsRep.value = audioInputs.filter(
				(input): input is AudioInput => input !== undefined,
			);
		} catch (error) {
			log.warn(`Failed to fetch audio inputs: ${errorMessage(error)}`);
		}
	};

	const updateInput = (inputUuid: string, patch: Partial<AudioInput>) => {
		const input = audioInputsRep.value?.find((i) => i.inputUuid === inputUuid);
		if (input) Object.assign(input, patch);
	};

	obsStatusRep.on("change", (newValue, oldValue) => {
		if (newValue?.status === oldValue?.status) return;
		if (newValue?.status === "connected") {
			void refresh();
		} else {
			audioInputsRep.value = [];
		}
	});

	obsWebSocket.on(
		"InputVolumeChanged",
		({inputUuid, inputVolumeMul, inputVolumeDb}) => {
			updateInput(inputUuid, {inputVolumeMul, inputVolumeDb});
		},
	);
	obsWebSocket.on("InputMuteStateChanged", ({inputUuid, inputMuted}) => {
		updateInput(inputUuid, {inputMuted});
	});
	obsWebSocket.on("InputNameChanged", ({inputUuid, inputName}) => {
		updateInput(inputUuid, {inputName});
	});
	obsWebSocket.on("InputCreated", async ({inputName, inputUuid}) => {
		const input = await fetchAudioInput(inputName, inputUuid);
		if (input) audioInputsRep.value?.push(input);
	});
	obsWebSocket.on("InputRemoved", ({inputUuid}) => {
		if (!audioInputsRep.value) return;
		audioInputsRep.value = audioInputsRep.value.filter(
			(i) => i.inputUuid !== inputUuid,
		);
	});

	const listen = <T>(
		messageName: string,
		handler: (data: T) => Promise<unknown>,
	) => {
		nodecg.listenFor(messageName, async (data: T, ack) => {
			try {
				const result = await handler(data);
				if (ack && !ack.handled) ack(null, result);
			} catch (error) {
				log.warn(`${messageName} failed: ${errorMessage(error)}`);
				if (ack && !ack.handled) ack(error);
			}
		});
	};

	listen<SetInputVolume>("obs:setInputVolume", (data) =>
		obsWebSocket.call("SetInputVolume", data),
	);
	listen<SetInputMute>("obs:setInputMute", (data) =>
		obsWebSocket.call("SetInputMute", data),
	);
	listen<ToggleInputMute>("obs:toggleInputMute", (data) =>
		obsWebSocket.call("ToggleInputMute", data),
	);
};

const errorMessage = (error: unknown) =>
	error instanceof Error ? error.message : String(error);
