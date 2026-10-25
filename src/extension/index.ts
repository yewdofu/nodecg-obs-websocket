import type NodeCG from "@nodecg/types";
import type {Configschema} from "../types/generated/configschema";
import {example} from "./example";
import {obs} from "./obs";

export default function (nodecg: NodeCG.ServerAPI<Configschema>) {
	example(nodecg);
	obs(nodecg);
}
