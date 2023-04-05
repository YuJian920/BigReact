import type { ReactElementType } from 'shared/ReactTypes';
import { mountChildFibers, reconcileChildFibers } from './childFibers';
import { FiberNode } from './fiber';
import { renderWithHooks } from './fiberHooks';
import { Lane } from './fiberLanes';
import { processUpdateQueue, UpdateQueue } from './updateQueue';
import { Fragment, FunctionComponent, HostComponent, HostRoot, HostText } from './workTags';

/**
 * 负责 React DFS 当中的递阶段，与 React Element 比较后返回子 Fiber 节点
 * @param wip
 * @returns
 */
export const beginWork = (wip: FiberNode, renderLane: Lane) => {
	switch (wip.tag) {
		case HostRoot:
			// HostRoot 的 beginWork 工作流程:
			// 1. 计算状态最新值
			// 2. 创造子 FiberNode
			return updateHostRoot(wip, renderLane);
		case HostComponent:
			// HostComponent 与 HostRoot 显著的不同在于 HostComponent 内部不能触发更新
			// HostComponent 的 beginWork 工作流程:
			// 1. 创造子 FiberNode
			return updateHostComponent(wip);
		case HostText:
			// HostText 不存在子节点，没有 beginWork 工作流程
			return null;
		case FunctionComponent:
			return updateFunctionComponent(wip, renderLane);
		case Fragment:
			return updateFragment(wip);
		default:
			if (__DEV__) console.warn('未实现的类型');
			break;
	}

	return null;
};

/**
 * Fragment 的 beginWork 流程
 * @param wip FiberNode
 * @returns
 */
const updateFragment = (wip: FiberNode) => {
	const nextChildren = wip.pendingProps;

	reconcileChildren(wip, nextChildren);
	return wip.child;
};

/**
 * FunctionComponent 的 beginWork 流程
 * @param wip FiberNode
 * @param renderLane Lane
 * @returns
 */
const updateFunctionComponent = (wip: FiberNode, renderLane: Lane) => {
	// 对于一个 FunctionComponent 而言，child 就是它的执行结果
	const nextChildren = renderWithHooks(wip, renderLane);

	reconcileChildren(wip, nextChildren);
	return wip.child;
};

/**
 * HostRoot 的 beginWork 流程
 * @param wip FiberNode
 * @returns
 */
const updateHostRoot = (wip: FiberNode, renderLane: Lane) => {
	const baseState = wip.memoizedState;
	const updateQueue = wip.updateQueue as UpdateQueue<Element>;
	// mount 阶段 pending 中存放的是在 updateContainer 函数中插入的 ReactElement
	// update 阶段更新不从 updateContainer 函数中发起，所以 pending 会为 null
	// 但是 update 阶段 wip 的 memoizedState 会有值
	// 来自 createWorkInProgess 函数中从 current 复制的 memoizedState
	const pending = updateQueue.shared.pending;
	updateQueue.shared.pending = null;
	// 计算 memoizedState
	const { memoizedState } = processUpdateQueue(baseState, pending, renderLane);
	wip.memoizedState = memoizedState;

	// 计算完成的 memoizedState 也是 ReactElement
	const nextChildren = wip.memoizedState;
	// 交由 reconcileChildren 开始生成子 Fiber 节点
	reconcileChildren(wip, nextChildren);
	return wip.child;
};

/**
 * HostComponent 的 beginWork 流程
 * @param wip FiberNode
 * @returns
 */
const updateHostComponent = (wip: FiberNode) => {
	// Host 类型的 FiberNode children 存放在 props 中
	// 在 JSX 转换时被放入 props 的 children 中
	const nextProps = wip.pendingProps;
	const nextChildren = nextProps.children;
	reconcileChildren(wip, nextChildren);
	return wip.child;
};

/**
 * 协调 children
 * @param wip FiberNode
 * @param children Children ReactElement
 */
const reconcileChildren = (wip: FiberNode, children?: ReactElementType) => {
	const current = wip.alternate;

	if (current !== null) {
		// update
		// 第一次渲染只会有 HostRootFiber 有 current fiberNode，其余节点都走 mount 流程
		wip.child = reconcileChildFibers(wip, current?.child, children);
	} else {
		// mount
		wip.child = mountChildFibers(wip, null, children);
	}
};
