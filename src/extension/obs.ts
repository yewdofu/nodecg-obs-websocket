import type NodeCG from "@nodecg/types";
import {OBSWebSocket} from "obs-websocket-js";
import type {Configschema} from "../types/generated/configschema";
import type {ObsStatus} from "../types/generated/obsStatus";

export const obs = (nodecg: NodeCG.ServerAPI<Configschema>) => {
	const log = new nodecg.Logger("obs");
	const config = nodecg.bundleConfig.obs;
	const obsStatusRep = nodecg.Replicant<ObsStatus>("obsStatus", {
		persistent: false,
		defaultValue: {status: "disconnected"},
	});
	const obsWebSocket = new OBSWebSocket();

	if (!config.enabled) {
		log.info("OBS WebSocket is disabled in config");
		return obsWebSocket;
	}

	let reconnectTimer: NodeJS.Timeout | undefined;

	const scheduleReconnect = () => {
		if (reconnectTimer) return;
		reconnectTimer = setTimeout(() => {
			reconnectTimer = undefined;
			void connect();
		}, config.reconnectInterval);
	};

	const connect = async () => {
		obsStatusRep.value = {status: "connecting"};
		try {
			const {obsWebSocketVersion} = await obsWebSocket.connect(
				config.url,
				config.password || undefined,
			);
			const {obsVersion} = await obsWebSocket.call("GetVersion");
			obsStatusRep.value = {
				status: "connected",
				obsVersion,
				obsWebSocketVersion,
			};
			log.info(
				`Connected to OBS ${obsVersion} (obs-websocket ${obsWebSocketVersion}) at ${config.url}`,
			);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			obsStatusRep.value = {status: "disconnected", error: message};
			log.warn(`Failed to connect to ${config.url}: ${message}`);
			scheduleReconnect();
		}
	};

	obsWebSocket.on("ConnectionClosed", (error) => {
		// 接続確立前の失敗は connect() の catch で処理する
		if (obsStatusRep.value?.status !== "connected") return;
		obsStatusRep.value = {status: "disconnected", error: error.message};
		log.warn(`Disconnected from OBS: ${error.message}`);
		scheduleReconnect();
	});

	void connect();

	return obsWebSocket;
};
