import { FiberNode } from './fiber';
import internals from 'shared/internals';
import { Dispatch, Dispatcher } from 'react/src/currentDispatcher';
import {
	createUpdate,
	createUpdateQueue,
	enqueueUpdate,
	processUpdateQueue,
	UpdateQueue
} from './updateQueue';
import { scheduleUpdateOnFiber } from './workLoop';
import { Action } from 'shared/ReactTypes';
import { Lane, NoLane, requestUpdateLane } from './fiberLanes';
import { Flags, PassiveEffect } from './fiberFlags';
import { HookHasEffect, Passive } from './hookEffectTags';

interface Hook {
	memoizedState: any;
	updateQueue: unknown;
	next: Hook | null;
}

export interface Effect {
	tag: Flags;
	create: EffectCallback | void;
	destroy: EffectCallback | void;
	deps: EffectDeps | null;
	next: Effect | null;
}

type EffectCallback = () => void;
type EffectDeps = any[];

export interface FCUpdateQueue<State> extends UpdateQueue<State> {
	lastEffect: Effect | null;
}

// 从数据共享层获取 currentDispatcher
const { currentDispatcher } = internals;

// 存储当前渲染 FunctionComponent fiber
let currentlyRenderingFiber: FiberNode | null = null;
// 指针 —— 指向当前调用的 wip hook
let workInProgressHook: Hook | null = null;
// 指针 —— 指向当前调用的 current hook
let currentHook: Hook | null = null;
let renderLane: Lane = NoLane;

/**
 * dispatch 核心函数，插入 update 并开始协调
 * @param fiber
 * @param updateQueue
 * @param action
 */
const dispatchSetState = <State>(
	fiber: FiberNode,
	updateQueue: UpdateQueue<State>,
	action: Action<State>
) => {
	// dispatchSetState 函数或者叫 dispatcher 函数已经通过 bind 保存了前两个参数，也就是绑定了 fiber 和 dispatcher
	const lane = requestUpdateLane();
	// action 是 setState 传入的待更新的状态，调用 createUpdate 包装成 update 的 action
	const update = createUpdate(action, lane);
	// 将创建的 action 添加到 updateQueue 中
	enqueueUpdate(updateQueue, update);
	// 开始调度
	scheduleUpdateOnFiber(fiber, lane);
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

	// workInProgressHook 是一个指向当前正在渲染的 FiberNode 的指针, 它在 renderWithHooks 函数中被赋值
	// 它为 null 表示当前并没有函数类型 FiberNode 被渲染，也就是函数组件之外调用 Hook
	if (workInProgressHook === null) {
		// mount 阶段，第一个 hook 调用
		if (currentlyRenderingFiber === null) throw new Error('hook 只能在函数组件中调用');
		else {
			// workInProgressHook 是指向当前 Hook 链表节点的指针
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

	// workInProgressHook 指向当前的 hook 链表节点，它的有值与否取决于当前执行的是不是第一个 hook
	if (workInProgressHook === null) {
		if (currentlyRenderingFiber === null) throw new Error('hook 只能在函数组件中调用');
		else {
			// 执行第一个 hook 调用的逻辑：就是将当前新创建的 hook 赋值给 workInProgressHook
			workInProgressHook = newHook;
			// currentlyRenderingFiber 表示当前正在渲染的 FiberNode
			// 再将 currentlyRenderingFiber 的 memoizedState 指向这个新创建的 hook
			currentlyRenderingFiber.memoizedState = workInProgressHook;
		}
	} else {
		// 执行不是第一个 hook 调用的逻辑：将当前之前创建的 hook 链表节点的 next 赋值为新创建的 hook
		workInProgressHook.next = newHook;
		// 保持 workInProgressHook 的指向
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
	// dispatch 以及保存了 currentlyRenderingFiber 和 Hook 链表的 updateQueue
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
	queue.shared.pending = null;

	if (pending !== null) {
		const { memoizedState } = processUpdateQueue(hook.memoizedState, pending, renderLane);
		hook.memoizedState = memoizedState;
	}

	return [hook.memoizedState, queue.dispatch as Dispatch<State>];
};

/**
 * mount 阶段 useEffect
 * @param create 传入的 effect 函数
 * @param deps 依赖数组
 */
const mountEffect = (create: EffectCallback | void, deps: EffectDeps | void) => {
	const hook = mountWorkInProgressHook();
	const nextDeps = deps === undefined ? null : deps;
	// 给当前渲染 Fiber 打上 PassiveEffect 标记
	(currentlyRenderingFiber as FiberNode).flags |= PassiveEffect;

	// hook mount 阶段 useEffect 都需要被执行，所以 tag 会是 Passive | HookHasEffect
	hook.memoizedState = pushEffect(Passive | HookHasEffect, create, undefined, nextDeps);
};

/**
 * update 阶段 useEffect
 * @param create 传入的 effect 函数
 * @param deps 依赖数组
 */
const updateEffect = (create: EffectCallback | void, deps: EffectDeps | void) => {
	const hook = updateWorkInProgressHook();
	const nextDeps = deps === undefined ? null : deps;
	let destroy: EffectCallback | void;

	// currentHook 指向当前调用的 current hook
	if (currentHook !== null) {
		// 取出上一次的 effect
		const preEffect = currentHook.memoizedState as Effect;
		destroy = preEffect.destroy;

		// 判断是否存在依赖数组
		if (nextDeps !== null) {
			// 存在依赖数组，判断依赖数组是否有变化
			const prevDeps = preEffect.deps;
			if (areHookInputsEqual(nextDeps, prevDeps)) {
				// 依赖数组没有变化，不需要执行 effect
				// effect 的 tag 为 Passive
				hook.memoizedState = pushEffect(Passive, create, destroy, nextDeps);
				return;
			}
		}

		// 依赖数组有变化，或者没有依赖数组，都需要执行 effect 也就是标记 PassiveEffect
		(currentlyRenderingFiber as FiberNode).flags |= PassiveEffect;
		// effect 的 tag 为 Passive | HookHasEffect
		hook.memoizedState = pushEffect(Passive | HookHasEffect, create, destroy, nextDeps);
	}
};

/**
 * 判断依赖数组是否有变化
 * @param nextDeps
 * @param prevDeps
 * @returns
 */
const areHookInputsEqual = (nextDeps: EffectDeps | null, prevDeps: EffectDeps | null): boolean => {
	if (prevDeps === null || nextDeps === null) return false;

	for (let i = 0; i < prevDeps.length && i < nextDeps.length; i++) {
		// 如果 useEffect 的依赖数组传入的是空数组，在这里传递给 Object.is 的参数都会是 undefined
		// 而 undefined === undefined 为 true
		if (Object.is(prevDeps[i], nextDeps[i])) continue;
		return false;
	}

	return true;
};

/**
 * 创建 effect
 * @param hookFlags effectTag
 * @param create effect 函数
 * @param destroy	清除 effect 函数
 * @param deps 依赖数组
 * @returns
 */
const pushEffect = (
	hookFlags: Flags,
	create: EffectCallback | void,
	destroy: EffectCallback | void,
	deps: EffectDeps | null
): Effect => {
	// 根据传入的参数创建 effect
	const effect: Effect = { tag: hookFlags, create, destroy, deps, next: null };
	const fiber = currentlyRenderingFiber as FiberNode;
	const updateQueue = fiber.updateQueue as FCUpdateQueue<any>;

	// 一般来说，Function FiberNode 的 updateQueue 都是 null
	// 遇到 useEffect 开始执行，才会在 mountEffect 创建一个 updateQueue
	if (updateQueue === null) {
		const updateQueue = createFCUpdateQueue<any>();
		fiber.updateQueue = updateQueue;
		// 循环链表
		effect.next = effect;
		updateQueue.lastEffect = effect;
	} else {
		// updateQueue 不为 null，说明已经执行过 useEffect
		const lastEffect = updateQueue.lastEffect;
		// 什么情况下会出现 lastEffect 为 null 的情况？
		if (lastEffect === null) {
			effect.next = effect;
			updateQueue.lastEffect = effect;
		} else {
			// lastEffect.next 指向第一个 effect
			const firstEffect = lastEffect.next;
			// 执行新的 effect 保证 lastEffect.next 指向最后一个 effect
			lastEffect.next = effect;
			// 新的 effect 指向第一个 effect
			effect.next = firstEffect;
			// 更新 lastEffect
			updateQueue.lastEffect = effect;
		}
	}

	return effect;
};

/**
 * 创建 FCUpdateQueue
 * @returns
 */
const createFCUpdateQueue = <State>() => {
	// 这个函数实际上就是创建了一个额外具有 lastEffect 属性的 updateQueue
	const updateQueue = createUpdateQueue<State>() as FCUpdateQueue<State>;
	// FCUpdateQueue 是循环链表的结构，它的 lastEffect 属性指向最后一个 effect
	// updateQueue 只会用来存储 effect 数据结构吗？
	updateQueue.lastEffect = null;
	return updateQueue;
};

// mount 阶段 Hook 集合
const HooksDispatcherOnMount: Dispatcher = {
	useState: mountState,
	useEffect: mountEffect
};

const HooksDispatcherOnUpdate: Dispatcher = {
	useState: updateState,
	useEffect: updateEffect
};

/**
 * FunctionComponent 执行函数，返回子节点和挂载 hook
 * @param wip WorkInProgress FiberNode
 * @returns
 */
export const renderWithHooks = (wip: FiberNode, lane: Lane) => {
	currentlyRenderingFiber = wip;
	// 重置 hooks 链表
	wip.memoizedState = null;
	wip.updateQueue = null;
	renderLane = lane;

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
	renderLane = NoLane;
	return children;
};
