import { FiberNode } from './fiber';
import internals from 'shared/internals';
import { Dispatch, Dispatcher } from 'react/src/currentDispatcher';
import { createUpdate, createUpdateQueue, enqueueUpdate, UpdateQueue } from './updateQueue';
import { scheduleUpdateOnFiber } from './workLoop';
import { Action } from 'shared/ReactTypes';

interface Hook {
	memoizedState: any;
	updateQueue: unknown;
	next: Hook | null;
}

// 从数据共享层获取 currentDispatcher
const { currentDispatcher } = internals;

// 存储当前渲染 FunctionComponent fiber
let currentlyRenderingFiber: FiberNode | null = null;
// 指针 —— 指向当前调用的 hook
let workInProgressHook: Hook | null = null;

/**
 * dispatch 核心函数，插入 update 并开始协调
 * @param fiber
 * @param updateQueue
 * @param action
 */
const dispatchSetState = <State>(fiber: FiberNode, updateQueue: UpdateQueue<State>, action: Action<State>) => {
	const update = createUpdate(action);
	enqueueUpdate(updateQueue, update);
	// 开始调度
	scheduleUpdateOnFiber(fiber);
};

/**
 * 返回当前调用 hook 节点
 * @returns
 */
const mountWorkInProgressHook = (): Hook => {
	const hook: Hook = {
		memoizedState: null,
		updateQueue: null,
		next: null
	};

	if (workInProgressHook === null) {
		// mount 阶段，第一个 hook 调用
		if (currentlyRenderingFiber === null) throw new Error('hook 只能在函数组件中调用');
		else {
			// 指向创建的 hook
			workInProgressHook = hook;
			// WorkInProgress FiberNode 赋值第一个 hook 链表节点
			currentlyRenderingFiber.memoizedState = workInProgressHook;
		}
	} else {
		// mount 阶段，不是第一个 hook 调用
		// hook 链表新增节点
		workInProgressHook.next = hook;
		// 指向新节点
		workInProgressHook = workInProgressHook.next;
	}

	return workInProgressHook;
};

/**
 * mount 阶段 useState
 * @param initialState
 * @returns
 */
const mountState = <State>(initialState: () => State | State): [State, Dispatch<State>] => {
	const hook = mountWorkInProgressHook();

	// 计算 memoizedState，也就是 useState 传入的值
	let memoizedState;
	if (initialState instanceof Function) {
		memoizedState = initialState();
	} else {
		memoizedState = initialState;
	}

	// 创建新 updateQueue
	const queue = createUpdateQueue<State>();
	hook.updateQueue = queue;
	// 存储 memoizedState
	hook.memoizedState = memoizedState;

	//@ts-ignore
	// dispatchSetState 使用 bind 是为了隐藏多余参数以及使 dispatch 函数能脱离 FunctionComponent 环境
	// dispatch 以及保存了 currentlyRenderingFiber 和 queue
	const dispatch = dispatchSetState.bind(null, currentlyRenderingFiber, queue);
	queue.dispatch = dispatch;

	return [memoizedState, dispatch];
};

// mount 阶段 Hook 集合
const HooksDispatcherOnMount: Dispatcher = {
	useState: mountState
};

/**
 * FunctionComponent 执行函数，返回子节点和挂载 hook
 * @param wip WorkInProgress FiberNode
 * @returns
 */
export const renderWithHooks = (wip: FiberNode) => {
	currentlyRenderingFiber = wip;
	wip.memoizedState = null;

	const current = wip.alternate;

	if (current !== null) {
		// update
	} else {
		// mount
		// 指向挂载阶段 hook
		currentDispatcher.current = HooksDispatcherOnMount;
	}

	// FunctionComponent 的 tupe 存储其函数本身
	const Component = wip.type;
	const props = wip.pendingProps;
	const children = Component(props);

	// 重置 currentlyRenderingFiber
	currentlyRenderingFiber = null;
	return children;
};
