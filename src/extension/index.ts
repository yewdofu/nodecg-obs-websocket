import type NodeCG from "@nodecg/types";
import type {Configschema} from "../types/generated/configschema";
import {obs} from "./obs";
import {obsAudio} from "./obs-audio";

export default function (nodecg: NodeCG.ServerAPI<Configschema>) {
	const obsWebSocket = obs(nodecg);
	obsAudio(nodecg, obsWebSocket);
}
