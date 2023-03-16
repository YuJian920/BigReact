import {
	appendChildToContainer,
	commitUpdate,
	Container,
	insertChildToContainer,
	Instacne,
	removeChild
} from 'hostConfig';
import { FiberNode, FiberRootNode } from './fiber';
import { ChildDeletion, MutationMask, NoFlags, Placement, Update } from './fiberFlags';
import { FunctionComponent, HostComponent, HostRoot, HostText } from './workTags';

let nextEffect: FiberNode | null = null;

/**
 * 寻找带有标记的子节点，然后处理标记
 * @param finishedWork
 */
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

/**
 * 处理 flags 标记
 * @param finishedWork
 */
const commitMutationEffectsOnFiber = (finishedWork: FiberNode) => {
	const flags = finishedWork.flags;

	// 表示当前节点存在 Placement 标记
	if ((flags & Placement) !== NoFlags) {
		commitPlacement(finishedWork);
		finishedWork.flags &= ~Placement;
	}
	// Update
	if ((flags & Update) !== NoFlags) {
		commitUpdate(finishedWork);
		finishedWork.flags &= ~Update;
	}
	// ChildDeletion
	if ((flags & ChildDeletion) !== NoFlags) {
		const deletions = finishedWork.deletions;
		if (deletions !== null) {
			deletions.forEach((childToDelete) => {
				commitDeletion(childToDelete);
			});
		}
		finishedWork.flags &= ~ChildDeletion;
	}
};

const recordHostChildrenToDelete = (childrenToDelete: FiberNode[], unmountFiber: FiberNode) => {
	const lastOne = childrenToDelete[childrenToDelete.length - 1];

	if (!lastOne) {
		childrenToDelete.push(unmountFiber);
	} else {
		let node = lastOne.sibling;
		while (node !== null) {
			if (unmountFiber === node) childrenToDelete.push(unmountFiber);
			node = node.sibling;
		}
	}
};

/**
 * commit 阶段的 ChildDeletion 处理
 * @param childToDelete 要删除的子节点
 */
const commitDeletion = (childToDelete: FiberNode) => {
	// FC 需要处理 useEffect 的 unmount、解绑 ref
	// Host 需要解绑 ref
	const rootChildrenToDelete: FiberNode[] = [];

	// 递归子树
	commitNestedComponent(childToDelete, (unmountFiber) => {
		switch (unmountFiber.tag) {
			case HostComponent:
				recordHostChildrenToDelete(rootChildrenToDelete, unmountFiber);
				return;
			case HostText:
				recordHostChildrenToDelete(rootChildrenToDelete, unmountFiber);
				return;
			case FunctionComponent:
				return;
			default:
				if (__DEV__) console.warn('未处理的 unmount 类型', unmountFiber);
				break;
		}
	});

	// 移除 DOM 节点
	if (rootChildrenToDelete.length) {
		const hostParent = getHostParent(childToDelete);
		if (hostParent !== null) {
			rootChildrenToDelete.forEach((node) => removeChild(node.stateNode, hostParent));
		}
	}

	childToDelete.return = null;
	childToDelete.child = null;
};

/**
 * 递归子树执行回调
 * @param root
 * @param onCommitUnmount
 * @returns
 */
const commitNestedComponent = (root: FiberNode, onCommitUnmount: (fiber: FiberNode) => void) => {
	let node = root;

	while (true) {
		onCommitUnmount(node);

		// 向下遍历
		if (node.child !== null) {
			node.child.return = node;
			node = node.child;
			continue;
		}

		if (node === root) return;

		// 开始向上遍历
		while (node.sibling === null) {
			if (node.return === null || node.return === root) return;
			node = node.return;
		}

		// 开始往兄弟节点遍历
		node.sibling.return = node.return;
		node = node.sibling;
	}
};

/**
 * commit 阶段的 Placement 处理
 * @param finishedWork
 */
const commitPlacement = (finishedWork: FiberNode) => {
	if (__DEV__) console.warn('执行 Placement 操作', finishedWork);
	// 执行插入操作需要两个参数:
	// 1. 被插入的父元素 / 被插入的兄弟元素
	const hostParent = getHostParent(finishedWork);
	const sibling = getHostSibling(finishedWork);
	// 2. 待插入的 DOM
	// 遍历到 HostComponent / HostText 类型的子元素插入到父节点
	if (hostParent !== null) {
		insertOrAppendPlacementNodeIntoContainer(finishedWork, hostParent, sibling);
	}
};

/**
 * 寻找 HostComponent 类型的兄弟节点
 * @param fiber 要插入的节点
 * @returns
 */
const getHostSibling = (fiber: FiberNode) => {
	let node: FiberNode = fiber;

	findSibling: while (true) {
		// 向上遍历
		while (node.sibling === null) {
			const parent = node.return;

			// 待验证：
			// q: 为什么要判断 parent === HostComponent
			// a: 因为如果 parent 是 HostComponent，那么它的兄弟节点就是它的父节点的兄弟节点
			if (parent === null || parent.tag === HostComponent || parent.tag === HostRoot) return null;
			// 从父节点开始寻找兄弟节点
			node = parent;
		}

		// 开始往兄弟节点遍历
		node.sibling.return = node.return;
		node = node.sibling;

		// 直接兄弟节点不是 HostComponent / HostText 类型的节点
		while (node.tag !== HostText && node.tag !== HostComponent) {
			// 向下遍历，这里都是只找第一层 Host 类型的节点
			// 不稳定的 Host 节点不能作为目标节点
			if ((node.flags & Placement) !== NoFlags) continue findSibling;
			if (node.child === null) continue findSibling;
			else {
				node.child.return = node;
				node = node.child;
			}
		}

		if ((node.flags & Placement) === NoFlags) return node.stateNode;
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
 * @param finishedWork 要插入的节点
 * @param hostParent 父节点
 * @param before 兄弟节点
 * @returns
 */
const insertOrAppendPlacementNodeIntoContainer = (
	finishedWork: FiberNode,
	hostParent: Container,
	before?: Instacne
) => {
	if (finishedWork.tag === HostComponent || finishedWork.tag === HostText) {
		if (before) {
			// 插入寻找到的 HostComponent / HostText 到 before 前面
			insertChildToContainer(finishedWork.stateNode, hostParent, before);
		} else {
			// 插入寻找到的 HostComponent / HostText 到 hostParent
			appendChildToContainer(hostParent, finishedWork.stateNode);
		}

		return;
	}

	// 节点自身不是 HostComponent / HostText，便利子节点
	const child = finishedWork.child;
	if (child !== null) {
		// 对子节点递归执行 insertOrAppendPlacementNodeIntoContainer
		insertOrAppendPlacementNodeIntoContainer(child, hostParent);
		// 切换到 sibling 开始递归
		let sibling = child.sibling;

		// 递归 sibling
		while (sibling !== null) {
			insertOrAppendPlacementNodeIntoContainer(sibling, hostParent);
			sibling = sibling.sibling;
		}
	}
};
