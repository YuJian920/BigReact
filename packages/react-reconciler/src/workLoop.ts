import { beginWork } from './beginWork';
import { completeWork } from './completeWork';
import { FiberNode } from './fiber';

let workInProgress: FiberNode | null = null;

/**
 * 初始化 renderRoot
 * @param fiber
 */
const prepareFreshStack = (fiber: FiberNode) => {
	workInProgress = fiber;
};

const renderRoot = (root: FiberNode) => {
	prepareFreshStack(root);

	do {
		try {
			workLoop();
			break;
		} catch (error) {
			console.warn('workLoop 发生错误');
			workInProgress = null;
		}
	} while (true);
};

/**
 * React 的工作循环，DFS 的递归流程也发生在 workLoop 中
 */
const workLoop = () => {
	// 如果 workInProgress 指针不为 null，则开始递归流程的递阶段，也就是 beginWork
	while (workInProgress !== null) {
		performUnitOfWork(workInProgress);
	}
};

/**
 * 递归流程的递阶段，主要是负责执行 beginWork 返回子节点继续 workLoop，如果子 Fiber 节点不存在则进入归阶段
 * @param fiber workInProgress 指针 // next 有两种情况：返回子 Fiber 节点和 null，null 则表示当前 Fiber 节点不存在子 Fiber 节点
 */
const performUnitOfWork = (fiber: FiberNode) => {
	// next 有两种情况：返回子 Fiber 节点和 null，null 则表示当前 Fiber 节点不存在子 Fiber 节点
	const next = beginWork(fiber);
	fiber.memoizedProps = fiber.pendingProps;

	if (next === null) {
		completeUnitOfWork(fiber);
	} else {
		workInProgress = next;
	}
};

/**
 * 递归流程的归阶段，主要是负责执行 completeWork，执行完后进入兄弟节点开始新的递归流程，如果兄弟节点不存在，则开始父 Fiber 节点的归阶段
 * @param fiber workInProgress 指针
 * @returns
 */
const completeUnitOfWork = (fiber: FiberNode) => {
	let node: FiberNode | null = fiber;

	do {
		// 对 workInProgress 节点执行 completeWork
		completeWork(fiber);
		// sibling 和 beginWork 的 next 返回相同 —— 存在 null 和 非null 两种情况
		const sibling = node.sibling;

		if (sibling !== null) {
			// 如果 sibling 不为 null，则表示存在兄弟节点，workInProgress 指向 sibling 后返回，继续递归流程
			workInProgress = sibling;
			return;
		}

		// sibling 为 null，则表示不存在兄弟节点，node 指向父 Fiber 节点，开始父 Fiber 节点的归阶段
		node = node.return;
		workInProgress = node;
	} while (node !== null);
};
