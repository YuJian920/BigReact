import { appendInitialChild, Container, createInstance, createTextInstance } from 'hostConfig';
import { updateFiberProps } from 'react-dom/src/SyntheticEvent';
import { FiberNode } from './fiber';
import { NoFlags, Update } from './fiberFlags';
import { HostRoot, HostComponent, HostText, FunctionComponent } from './workTags';

/**
 * 标记 Update
 * @param fiber FiberNode
 */
const markUpdate = (fiber: FiberNode) => {
	fiber.flags |= Update;
};

/**
 * 负责 React DFS 当中的归阶段
 * @param wip
 */
export const completeWork = (wip: FiberNode) => {
	const newProps = wip.pendingProps;
	const current = wip.alternate;

	switch (wip.tag) {
		case HostRoot:
			// HostRoot 的 completeWork 工作流程:
			bubbleProperties(wip);
			return null;
		case HostComponent:
			if (current !== null && wip.stateNode) {
				// update 阶段 HostComponent 的 completeWork 工作流程:
				// 1. props 是否变化
				// 2. 标记 Update
				updateFiberProps(wip.stateNode, newProps);
			} else {
				// mount 阶段 HostComponent 的 completeWork 工作流程:
				// 1. 构建离屏 DOM 树
				const instance = createInstance(wip.type, newProps);
				// 2. 将 DOM 插入到 DOM 树中
				appendAllChildren(instance, wip);
				wip.stateNode = instance;
			}
			bubbleProperties(wip);
			return null;
		case HostText:
			if (current !== null && wip.stateNode) {
				// update
				const oldText = current.memoizedProps.content;
				const newText = newProps.content;
				if (oldText !== newText) markUpdate(wip);
			} else {
				// mount 阶段 HostText 的 completeWork 工作流程:
				// 1. 构建离屏 DOM 树
				const instance = createTextInstance(newProps.content);
				wip.stateNode = instance;
			}
			bubbleProperties(wip);
			return null;
		case FunctionComponent:
			bubbleProperties(wip);
			return null;
		default:
			if (__DEV__) console.warn('未实现 completeWork 类型');
			break;
	}
};

/**
 * 递归寻找第一层 HostComponent 类型的子节点并执行插入动作
 * @param parent
 * @param wip
 * @returns
 */
const appendAllChildren = (parent: Container, wip: FiberNode) => {
	let node = wip.child;

	while (node !== null) {
		// 递阶段
		// 寻找 HostComponent / HostText 类型的 FiberNode
		if (node.tag === HostComponent || node.tag === HostText) {
			// 找到类型为 HostComponents 的子节点执行插入动作
			// 然后就不再深入递阶段
			// 只递第一层
			appendInitialChild(parent, node.stateNode);
		} else if (node.child !== null) {
			// 子节点类型不为 HostComponents
			// 深入查找子节点的子节点
			node.child.return = node;
			node = node.child;
			continue;
		}

		if (node === wip) return;

		// 归阶段
		while (node.sibling === null) {
			// 没有子节点且父节点为递归开始的节点，结束循环
			if (node.return === null || node.return === wip) return;
			// 开始归阶段
			node = node?.return;
		}
		// 切换至兄弟节点开始递归
		node.sibling.return = node.return;
		node = node.sibling;
	}
};

/**
 * 将子节点中的 flag 冒泡到父节点
 * @param wip
 */
const bubbleProperties = (wip: FiberNode) => {
	let subtreeFlags = NoFlags;
	let child = wip.child;

	// 遍历子节点
	while (child !== null) {
		subtreeFlags |= child.subtreeFlags;
		subtreeFlags |= child.flags;

		child.return = wip;
		child = child.sibling;
	}

	// 将子节点的 flag 和 subtreeFlags 标记到 wip 上 subtreeFlags
	wip.subtreeFlags |= subtreeFlags;
};
