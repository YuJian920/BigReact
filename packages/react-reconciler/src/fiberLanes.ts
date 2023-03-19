export type Lane = number;
export type Lanes = number;

export const SyncLane = 0b0001;
export const NoLane = 0b0000;
export const NoLanes = 0b0000;

export const mergeLanes = (laneA: Lanes, laneB: Lanes): Lanes => {
	return laneA | laneB;
};

export const requestUpdateLane = (): Lane => {
	return SyncLane;
};
