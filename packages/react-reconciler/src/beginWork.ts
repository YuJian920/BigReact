import type { ReactElementType } from 'shared/ReactTypes';
import { mountChildFibers, reconcileChildFibers } from './childFibers';
import { FiberNode } from './fiber';
import { processUpdateQueue, UpdateQueue } from './updateQueue';
import { HostComponent, HostRoot, HostText } from './workTags';

/**
 * 负责 React DFS 当中的递阶段，与 React Element 比较后返回子 Fiber 节点
 * @param wip
 * @returns
 */
export const beginWork = (wip: FiberNode) => {
	switch (wip.tag) {
		case HostRoot:
			// HostRoot 的 beginWork 工作流程:
			// 1. 计算状态最新值
			// 2. 创造子 FiberNode
			return updateHostRoot(wip);
		case HostComponent:
			// HostComponent 与 HostRoot 显著的不同在于 HostComponent 内部不能触发更新
			// HostComponent 的 beginWork 工作流程:
			// 1. 创造子 FiberNode
			return updateHostComponent(wip);
		case HostText:
			// HostText 不存在子节点，没有 beginWork 工作流程
			return null;
		default:
			if (__DEV__) console.warn('未实现的类型');
			break;
	}

	return null;
};

/**
 * HostRoot 的 beginWork 流程
 * @param wip
 * @returns
 */
const updateHostRoot = (wip: FiberNode) => {
	const baseState = wip.memoizedState;
	const updateQueue = wip.updateQueue as UpdateQueue<Element>;
	// 取出 pending
	const pending = updateQueue.shared.pending;
	updateQueue.shared.pending = null;
	// 计算 memoizedState
	const { memoizedState } = processUpdateQueue(baseState, pending);
	wip.memoizedState = memoizedState;

	// 在 updateContainer 函数中，为 hostRootFiber 插入的 pending 是 ReactElement
	// 计算完成的 memoizedState 也是 ReactElement
	const nextChildren = wip.memoizedState;
	reconcileChildren(wip, nextChildren);
	return wip.child;
};

const updateHostComponent = (wip: FiberNode) => {
	const nextProps = wip.pendingProps;
	const nextChildren = nextProps.children;
	reconcileChildren(wip, nextChildren);
	return wip.child;
};

/**
 * 协调 children
 * @param wip
 * @param children
 */
const reconcileChildren = (wip: FiberNode, children?: ReactElementType) => {
	// 对比子节点 current fiberNode 和子节点的 reactElement
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
