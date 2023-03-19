import { beginWork } from './beginWork';
import { commitMutationEffects } from './commitWork';
import { completeWork } from './completeWork';
import { createWorkInProgess, FiberNode, FiberRootNode } from './fiber';
import { MutationMask, NoFlags } from './fiberFlags';
import { Lane, mergeLanes } from './fiberLanes';
import { HostRoot } from './workTags';

let workInProgress: FiberNode | null = null;

/**
 * 初始化 workInProgress
 * @param fiber
 */
const prepareFreshStack = (root: FiberRootNode) => {
	// 初始化也可以说是确认 workInProgress 的位置
	workInProgress = createWorkInProgess(root.current, {});
};

export const scheduleUpdateOnFiber = (fiber: FiberNode, lane: Lane) => {
	// 对于 mount 阶段，传入的 fiberNode 是 hostRootFiber
	// 对于 update 阶段，传入的 fiberNode 是触发更新的 fiberNode
	// 我们需要从我们当前的 fiberNode 一直遍历到 fiberRootNode
	const root = markUpdateFromFiberToRoot(fiber);
	markRootUpdated(root, lane);
	// 然后从 fiberRootNode 开始更新流程
	renderRoot(root);
};

/**
 * 记录 Lane 到 FiberRootNode
 * @param root FiberRootNode
 * @param lane Lane
 */
const markRootUpdated = (root: FiberRootNode, lane: Lane) => {
	root.pendingLanes = mergeLanes(root.pendingLanes, lane);
};

/**
 * 负责从传入 fiberNode 一直遍历到 fiberRootNode 并返回
 * @param fiber
 */
const markUpdateFromFiberToRoot = (fiber: FiberNode) => {
	let node = fiber;
	let parent = node.return;
	while (parent !== null) {
		node = parent;
		parent = node.return;
	}
	// 没有 父Node 且 fiberNode 的 Tag 为 HostRoot
	if (node.tag === HostRoot) return node.stateNode;
	return null;
};

const renderRoot = (root: FiberRootNode) => {
	prepareFreshStack(root);

	do {
		try {
			workLoop();
			break;
		} catch (error) {
			if (__DEV__) console.warn('workLoop 发生错误', error);
			workInProgress = null;
		}
	} while (true);

	const finishedWork = root.current.alternate;
	root.finishedWork = finishedWork;

	commitRoot(root);
};

/**
 * commit 阶段的入口
 * @param root
 * @returns
 */
const commitRoot = (root: FiberRootNode) => {
	const finishedWork = root.finishedWork;

	if (finishedWork === null) return;
	if (__DEV__) console.warn('commit 阶段开始', finishedWork);

	root.finishedWork = null;

	// 判断是否存在3个子阶段需要执行的操作
	const subtreeHasEffect = (finishedWork.subtreeFlags & MutationMask) !== NoFlags;
	const rootHasEffect = (finishedWork.flags & MutationMask) !== NoFlags;

	if (subtreeHasEffect || rootHasEffect) {
		// beforeMutation
		// mutation
		commitMutationEffects(finishedWork);
		root.current = finishedWork;
		// layout
	} else {
		// FIber 树的切换
		root.current = finishedWork;
	}
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
		completeWork(node);
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
