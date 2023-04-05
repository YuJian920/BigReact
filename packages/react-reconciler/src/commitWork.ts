import {
	appendChildToContainer,
	commitUpdate,
	Container,
	insertChildToContainer,
	Instacne,
	removeChild
} from 'hostConfig';
import { FiberNode, FiberRootNode, PendingPassiveEffects } from './fiber';
import {
	ChildDeletion,
	Flags,
	MutationMask,
	NoFlags,
	PassiveEffect,
	PassiveMask,
	Placement,
	Update
} from './fiberFlags';
import { Effect, FCUpdateQueue } from './fiberHooks';
import { HookHasEffect } from './hookEffectTags';
import { FunctionComponent, HostComponent, HostRoot, HostText } from './workTags';

let nextEffect: FiberNode | null = null;

/**
 * 寻找带有标记的子节点，然后处理标记
 * @param finishedWork
 */
export const commitMutationEffects = (finishedWork: FiberNode, root: FiberRootNode) => {
	nextEffect = finishedWork;

	// 遍历树
	while (nextEffect !== null) {
		const child: FiberNode | null = nextEffect.child;
		// 判断子树中是否存在 MutationMask
		// 也就是说如果有一个子节点中存在一个 flag，不管层级有多深，都会遍历到它然后再不断向上执行插入
		if ((nextEffect.subtreeFlags & (MutationMask | PassiveMask)) !== NoFlags && child !== null) {
			// 继续向下遍历
			nextEffect = child;
		} else {
			// 子树中不存在 MutationMask 或者子树为 null
			// 有几种情况：1. 遍历到叶子节点 2. 节点本身存在 MutationMask 3.节点的兄弟节点存在 MutationMask
			// 开始往上以及往兄弟节点开始遍历
			// 在 mount 阶段，进入到这里的会是 HostRootFiber 的第一个子 FiberNode，被执行后续逻辑
			up: while (nextEffect !== null) {
				commitMutationEffectsOnFiber(nextEffect, root);
				const sibling: FiberNode | null = nextEffect.sibling;

				if (sibling !== null) {
					// 开始遍历兄弟节点
					nextEffect = sibling;
					// 跳出 up
					break up;
				}

				// 开始向上遍历
				// 也就是说如果子节点存在 effect 那么会从那个子节点开始一路向上遍历处理 effect
				nextEffect = nextEffect.return;
			}
		}
	}
};

/**
 * 处理 flags 标记
 * @param finishedWork 当前节点
 */
const commitMutationEffectsOnFiber = (finishedWork: FiberNode, root: FiberRootNode) => {
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
				commitDeletion(childToDelete, root);
			});
		}
		finishedWork.flags &= ~ChildDeletion;
	}
	// PassiveEffect
	if ((flags & PassiveEffect) !== NoFlags) {
		// PassiveEffect 标记在 mountEffect 或者 updateEffect 中被设置
		// mountEffect 阶段标记 PassiveEffect 是因为 useEffect 会被初始化执行一次
		// updateEffect 阶段标记 PassiveEffect 是因为 useEffect 的依赖数据发生变化，需要重新执行
		// 这里传入的 type 是 update 是因为 update 对应的是 useEffect 的 update 阶段
		// 如果当前 useEffect 需要处理 unmount 阶段，则表示 FiberNode 将会被移除，会在处理 ChildDeletion 标记的时候被处理
		commitPassiveEffect(finishedWork, root, 'update');
		finishedWork.flags &= ~PassiveEffect;
	}
};

/**
 * 处理 PassiveEffect 标记
 * @param fiber 当前 fiber
 * @param root fiberRoot
 * @param type update | unmount
 * @returns
 */
const commitPassiveEffect = (
	fiber: FiberNode,
	root: FiberRootNode,
	type: keyof PendingPassiveEffects
) => {
	// 如果当前 fiber 不是 FunctionComponent 或者 type 等于 update 的同时当前 fiber 不存在 PassiveEffect 标记，直接返回
	if (
		fiber.tag !== FunctionComponent ||
		(type === 'update' && (fiber.flags & PassiveEffect) === NoFlags)
	) {
		return;
	}

	const updateQueue = fiber.updateQueue as FCUpdateQueue<any>;
	if (updateQueue !== null) {
		if (updateQueue.lastEffect === null && __DEV__) {
			console.warn('当 FC 存在 PassiveEffect flag 时，不应该不存在 lastEffect', fiber);
		}
		// 获取 fiberNode 中的 updateQueue 添加到 fiberRootNode 的 pendingPassiveEffects 属性上
		// 从这里可以知道 React 会执行子节点的 useEffect 之后再执行父节点的 useEffect
		// 因为 push 的顺序是先子节点再到父节点
		root.pendingPassiveEffects[type].push(updateQueue.lastEffect as Effect);
	}
};

const commitHookEffectList = (
	flags: Flags,
	lastEffect: Effect,
	callback: (effect: Effect) => void
) => {
	// lastEffect 的 next 指向第一个 effect
	let effect = lastEffect.next as Effect;
	// 遍历所有 effect
	do {
		if ((effect.tag & flags) === flags) callback(effect);
		effect = effect.next as Effect;
	} while (effect !== lastEffect.next);
};

/**
 * 处理 useEffect 的 unmount
 * @param flags
 * @param lastEffect
 */
export const commitHookEffectListUnmount = (flags: Flags, lastEffect: Effect) => {
	// 这个函数主要是处理 FunctionComponent 卸载时的 useEffect
	// 卸载时需要执行其 destroy 函数
	commitHookEffectList(flags, lastEffect, (effect) => {
		const destroy = effect.destroy;
		if (typeof destroy === 'function') destroy();
		// 和 commitHookEffectListDestroy 的区别在于这里会将 effect.tag 的 HookHasEffect 标记移除
		// 确保 useEffect 不会执行后续的 create 和 destroy
		effect.tag &= ~HookHasEffect;
	});
};

/**
 * 处理 useEffect 的 destroy
 * @param flags
 * @param lastEffect
 */
export const commitHookEffectListDestroy = (flags: Flags, lastEffect: Effect) => {
	// 这个函数主要是处理 useEffect 的 destroy，也就是 useEffect 的 return 函数
	// commitHookEffectListDestroy 会在 commitHookEffectListCreate 前被执行
	// 因为每一次 useEffect 都会先执行 destroy 再执行 create
	commitHookEffectList(flags, lastEffect, (effect) => {
		const destroy = effect.destroy;
		// 当 destroy 不为函数时，可能表示 useEffect 还未被执行过，destroy 还未被赋值
		if (typeof destroy === 'function') destroy();
	});
};

/**
 * 处理 useEffect 的 create
 * @param flags
 * @param lastEffect
 */
export const commitHookEffectListCreate = (flags: Flags, lastEffect: Effect) => {
	// 这个函数主要是处理 useEffect 的 destroy，也就是 useEffect 的 return 函数
	// 这个函数执行后会得到 destroy 函数，也就是 useEffect 的 return 函数
	// destroy 函数会被赋值到 effect.destroy 上
	commitHookEffectList(flags, lastEffect, (effect) => {
		const create = effect.create;
		if (typeof create === 'function') effect.destroy = create();
	});
};

/**
 * 处理 Host 类型的子节点删除
 * @param childrenToDelete
 * @param unmountFiber
 */
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
const commitDeletion = (childToDelete: FiberNode, root: FiberRootNode) => {
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
				commitPassiveEffect(unmountFiber, root, 'unmount');
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
