import { Dispatch } from 'react/src/currentDispatcher';
import type { Action } from 'shared/ReactTypes';

export interface Update<State> {
	action: Action<State>;
}

export interface UpdateQueue<State> {
	shared: {
		pending: Update<State> | null;
	};
	dispatch: Dispatch<State> | null;
}

/**
 * 创建 Update 实例
 * @param action
 * @returns
 */
export const createUpdate = <State>(action: Action<State>): Update<State> => {
	return { action };
};

/**
 * 创建 UpdateQueue 实例
 * @returns
 */
export const createUpdateQueue = <State>() => {
	// 之所以是这样的数据结构是因为这样可以在 current 和 wip 中公用一个 UpdateQueue
	return { shared: { pending: null }, dispatch: null } as UpdateQueue<State>;
};

/**
 * 添加 Update 至 UpdateQueue
 * @param updateQueue
 * @param update
 */
export const enqueueUpdate = <State>(updateQueue: UpdateQueue<State>, update: Update<State>) => {
	updateQueue.shared.pending = update;
};

/**
 * 消费 Updare
 * @param baseState
 * @param pendingUpdate
 * @returns
 */
export const processUpdateQueue = <State>(
	baseState: State,
	pendingUpdate: Update<State> | null
): { memoizedState: State } => {
	// 设置 memoizedState 的初始值
	const result: ReturnType<typeof processUpdateQueue<State>> = { memoizedState: baseState };

	if (pendingUpdate !== null) {
		// action 有两种情况，一种是具体值，一种是函数
		const action = pendingUpdate.action;
		// 函数会被传入 baseState 后执行，返回值赋值给 memoizedState
		if (action instanceof Function) result.memoizedState = action(baseState);
		// 具体值会直接赋值给 memoizedState
		else result.memoizedState = action;
	}

	return result;
};
