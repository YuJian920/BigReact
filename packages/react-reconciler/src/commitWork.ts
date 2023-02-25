import { appendChildToContainer, Container } from 'hostConfig';
import { FiberNode, FiberRootNode } from './fiber';
import { MutationMask, NoFlags, Placement } from './fiberFlags';
import { HostComponent, HostRoot, HostText } from './workTags';

let nextEffect: FiberNode | null = null;

export const commitMutationEffects = (finishedWork: FiberNode) => {
	nextEffect = finishedWork;

	// 遍历树
	while (nextEffect !== null) {
		const child: FiberNode | null = nextEffect.child;
		// 判断子树中是否存在 MutationMask
		// 也就是说如果有一个子节点中存在一个 flag，不管层级有多深，都会遍历到它然后再不断向上执行插入
		if ((nextEffect.subtreeFlags & MutationMask) !== NoFlags && child !== null) {
			// 继续向下遍历
			nextEffect = child;
		} else {
			// 子树中不存在 MutationMask 或者子树为 null
			// 有几种情况：1. 遍历到叶子节点 2. 节点本身存在 MutationMask 3.节点的兄弟节点存在 MutationMask
			// 开始往上以及往兄弟节点开始遍历
			up: while (nextEffect !== null) {
				commitMutationEffectsOnFiber(nextEffect);
				const sibling: FiberNode | null = nextEffect.sibling;

				if (sibling !== null) {
					// 开始遍历兄弟节点
					nextEffect = sibling;
					// 跳出 up
					break up;
				}

				// 开始向上遍历
				nextEffect = nextEffect.return;
			}
		}
	}
};

const commitMutationEffectsOnFiber = (finishedWork: FiberNode) => {
	const flags = finishedWork.flags;

	// 表示当前节点存在 Placement 标记
	if ((flags & Placement) !== NoFlags) {
		commitPlacement(finishedWork);
		finishedWork.flags &= ~Placement;
	}
	// Update
	// ChildDeletion
};

const commitPlacement = (finishedWork: FiberNode) => {
	if (__DEV__) console.warn('执行 Placement 操作', finishedWork);
	// 执行插入操作需要两个参数:
	// 1. 被插入的父元素
	const hostParent = getHostParent(finishedWork);
	// 2. 待插入的 DOM
	// 遍历到 HostComponent / HostText 类型的子元素插入到父节点
	if (hostParent !== null) {
		appendPlacementNodeIntoContainer(finishedWork, hostParent);
	}
};

/**
 * 从父结点中寻找 HostComponent 类型的节点
 * @param fiber
 * @returns
 */
const getHostParent = (fiber: FiberNode): Container | null => {
	let parent = fiber.return;

	// 向上寻找 HostComponent 类型的节点并返回
	// 有两种情况: 1.HostComponent 2. HostRoot
	while (parent) {
		const parentTag = parent.tag;
		if (parentTag === HostComponent) {
			return parent.stateNode;
		}

		// HostRoot 类型的节点获取 HostRoot 需要先取得 FiberRootNode
		if (parentTag === HostRoot) {
			return (parent.stateNode as FiberRootNode).container;
		}

		parent = parent.return;
	}
	if (__DEV__) console.warn('未找到 Host parent');

	return null;
};

/**
 * 寻找 finishedWork 子节点中的 HostComponent / HostText 节点插入到 hostParent
 * @param finishedWork
 * @param hostParent
 * @returns
 */
const appendPlacementNodeIntoContainer = (finishedWork: FiberNode, hostParent: Container) => {
	if (finishedWork.tag === HostComponent || finishedWork.tag === HostText) {
		// 插入寻找到的 HostComponent / HostText 到 hostParent
		appendChildToContainer(hostParent, finishedWork.stateNode);
		return;
	}
	// 节点自身不是 HostComponent / HostText，便利子节点
	const child = finishedWork.child;
	if (child !== null) {
		// 对子节点递归执行 appendPlacementNodeIntoContainer
		appendPlacementNodeIntoContainer(child, hostParent);
		// 切换到 sibing 开始递归
		let sibing = child.sibling;

		// 递归 sibing
		while (sibing !== null) {
			appendPlacementNodeIntoContainer(sibing, hostParent);
			sibing = sibing.sibling;
		}
	}
};
