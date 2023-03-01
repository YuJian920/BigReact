import { FiberNode } from './fiber';
import internals from 'shared/internals';
import { Dispatch, Dispatcher } from 'react/src/currentDispatcher';
import { createUpdate, createUpdateQueue, enqueueUpdate, processUpdateQueue, UpdateQueue } from './updateQueue';
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
// 指针 —— 指向当前调用的 wip hook
let workInProgressHook: Hook | null = null;
// 指针 —— 指向当前调用的 current hook
let currentHook: Hook | null = null;

/**
 * dispatch 核心函数，插入 update 并开始协调
 * @param fiber
 * @param updateQueue
 * @param action
 */
const dispatchSetState = <State>(fiber: FiberNode, updateQueue: UpdateQueue<State>, action: Action<State>) => {
	// dispatchSetState 函数或者叫 dispatcher 函数已经通过 bind 保存了前两个参数，也就是绑定了 fiber 和 dispatcher
	// action 是 setState 传入的待更新的状态，调用 createUpdate 包装成 update 的 action
	const update = createUpdate(action);
	// 将创建的 action 添加到 updateQueue 中
	enqueueUpdate(updateQueue, update);
	// 开始调度
	scheduleUpdateOnFiber(fiber);
};

/**
 * mount 阶段 返回当前调用 hook 节点
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
 * update 阶段 返回当前调用 hook 节点
 * @returns
 */
const updateWorkInProgressHook = (): Hook => {
	let nextCurrentHook: Hook | null = null;

	if (currentHook === null) {
		// update 阶段，第一个 hook 调用
		const current = currentlyRenderingFiber?.alternate;
		if (current !== null) {
			nextCurrentHook = current?.memoizedState;
		} else {
			nextCurrentHook = null;
		}
	} else {
		// update 阶段，不是第一个 hook 调用
		nextCurrentHook = currentHook.next;
	}

	if (nextCurrentHook === null) {
		throw new Error(`组件${currentlyRenderingFiber?.type} 本次执行时的 Hook 比上次执行多`);
	}

	currentHook = nextCurrentHook as Hook;
	const newHook: Hook = {
		memoizedState: currentHook.memoizedState,
		updateQueue: currentHook.updateQueue,
		next: null
	};

	if (workInProgressHook === null) {
		if (currentlyRenderingFiber === null) throw new Error('hook 只能在函数组件中调用');
		else {
			// 指向创建的 hook
			workInProgressHook = newHook;
			// WorkInProgress FiberNode 赋值第一个 hook 链表节点
			currentlyRenderingFiber.memoizedState = workInProgressHook;
		}
	} else {
		// hook 链表新增节点
		workInProgressHook.next = newHook;
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
	// queue 之所以这样设计很有可能是借用引用类型特点，绑定到 dispatchSetState 的时候可以及时修改
	const queue = createUpdateQueue<State>();
	hook.updateQueue = queue;
	// 存储 memoizedState
	hook.memoizedState = memoizedState;

	// @ts-ignore
	// dispatchSetState 使用 bind 是为了隐藏多余参数以及使 dispatch 函数能脱离 FunctionComponent 环境
	// dispatch 以及保存了 currentlyRenderingFiber 和 queue
	const dispatch = dispatchSetState.bind(null, currentlyRenderingFiber, queue);
	queue.dispatch = dispatch;

	return [memoizedState, dispatch];
};

/**
 * update 阶段 useState
 * @param initialState
 * @returns
 */
const updateState = <State>(): [State, Dispatch<State>] => {
	const hook = updateWorkInProgressHook();

	const queue = hook.updateQueue as UpdateQueue<State>;
	const pending = queue.shared.pending;

	if (pending !== null) {
		const { memoizedState } = processUpdateQueue(hook.memoizedState, pending);
		hook.memoizedState = memoizedState;
	}

	return [hook.memoizedState, queue.dispatch as Dispatch<State>];
};

// mount 阶段 Hook 集合
const HooksDispatcherOnMount: Dispatcher = {
	useState: mountState
};

const HooksDispatcherOnUpdate: Dispatcher = {
	useState: updateState
};

/**
 * FunctionComponent 执行函数，返回子节点和挂载 hook
 * @param wip WorkInProgress FiberNode
 * @returns
 */
export const renderWithHooks = (wip: FiberNode) => {
	currentlyRenderingFiber = wip;
	// 重置 hooks 链表
	wip.memoizedState = null;

	const current = wip.alternate;

	if (current !== null) {
		// update
		// 指向更新阶段 hook
		currentDispatcher.current = HooksDispatcherOnUpdate;
	} else {
		// mount
		// 指向挂载阶段 hook
		currentDispatcher.current = HooksDispatcherOnMount;
	}

	// FunctionComponent 的 tupe 存储其函数本身
	const Component = wip.type;
	const props = wip.pendingProps;
	const children = Component(props);

	// 重置
	currentlyRenderingFiber = null;
	workInProgressHook = null;
	currentHook = null;
	return children;
};
