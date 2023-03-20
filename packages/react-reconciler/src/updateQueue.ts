import { Dispatch } from 'react/src/currentDispatcher';
import type { Action } from 'shared/ReactTypes';
import { Lane } from './fiberLanes';

export interface Update<State> {
	action: Action<State>;
	lane: Lane;
	next: Update<any> | null;
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
export const createUpdate = <State>(action: Action<State>, lane: Lane): Update<State> => {
	return { action, lane, next: null };
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
	const pending = updateQueue.shared.pending;
	if (pending === null) {
		// 此时 update.next 指向自己，形成环状链表
		update.next = update;
	} else {
		// b.next = a.next
		update.next = pending.next;
		// a.next = b
		// 如果插入一个 b，那么 b -> a -> b 形成环状链表
		// 如果再插入一个 c，那么 c -> a -> b -> c 形成环状链表
		// pending 始终指向最后一个插入的 update
		// 这里似乎涉及到环装链表的算法，待补充
		pending.next = update;
	}

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
	pendingUpdate: Update<State> | null,
	renderLane: Lane
): { memoizedState: State } => {
	// 设置 memoizedState 的初始值
	const result: ReturnType<typeof processUpdateQueue<State>> = { memoizedState: baseState };

	if (pendingUpdate !== null) {
		// 第一个 update
		const first = pendingUpdate.next;
		// 当前处理的 update
		let pending = pendingUpdate.next as Update<any>;
		do {
			// 获取当前 update 的 lane
			const updateLane = pending.lane;
			if (updateLane === renderLane) {
				// action 有两种情况，一种是具体值，一种是函数
				const action = pending.action;
				// 函数会被传入 baseState 后执行，返回值赋值给 memoizedState
				if (action instanceof Function) baseState = action(baseState);
				// 具体值会直接赋值给 memoizedState
				else baseState = action;
			} else {
				if (__DEV__) console.error('processUpdateQueue: updateLane !== renderLane');
			}

			pending = pending.next as Update<any>;
		} while (pending !== first);
	}

	result.memoizedState = baseState;
	return result;
};
