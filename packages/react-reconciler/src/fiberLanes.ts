export type Lane = number;
export type Lanes = number;

export const SyncLane = 0b0001;
export const NoLane = 0b0000;
export const NoLanes = 0b0000;

/**
 * 合并 lane
 * @param laneA
 * @param laneB
 * @returns
 */
export const mergeLanes = (laneA: Lanes, laneB: Lanes): Lanes => {
	return laneA | laneB;
};

/**
 * 获取更新 lane
 * @returns lane
 */
export const requestUpdateLane = (): Lane => {
	return SyncLane;
};

/**
 * 获取最高优先级的 lane
 * @param lanes lane 集合
 * @returns
 */
export const getHighestPriorityLanes = (lanes: Lanes): Lanes => {
	return lanes & -lanes;
};
