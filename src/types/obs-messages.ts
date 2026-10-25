/** 操作対象の入力。inputName か inputUuid のどちらかを指定する */
type InputTarget = {inputName: string} | {inputUuid: string};

export type SetInputVolume = InputTarget &
	({inputVolumeDb: number} | {inputVolumeMul: number});

export type SetInputMute = InputTarget & {inputMuted: boolean};

export type ToggleInputMute = InputTarget;
