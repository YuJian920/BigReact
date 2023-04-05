import { scheduleMicroTask } from 'hostConfig';
import { beginWork } from './beginWork';
import {
	commitHookEffectListCreate,
	commitHookEffectListDestroy,
	commitHookEffectListUnmount,
	commitMutationEffects
} from './commitWork';
import { completeWork } from './completeWork';
import { createWorkInProgess, FiberNode, FiberRootNode, PendingPassiveEffects } from './fiber';
import { MutationMask, NoFlags, PassiveMask } from './fiberFlags';
import {
	getHighestPriorityLanes,
	Lane,
	markRootFinished,
	mergeLanes,
	NoLane,
	SyncLane
} from './fiberLanes';
import { flushSyncCallbacks, scheduleSyncCallback } from './syncTaskQueue';
import { HostRoot } from './workTags';
import {
	unstable_scheduleCallback as scheduleCallback,
	unstable_NormalPriority as NormalPriority
} from 'scheduler';
import { HookHasEffect, Passive } from './hookEffectTags';

let workInProgress: FiberNode | null = null;
// 本次更新的 lane
let wipRootRenderLanes: Lane = NoLane;
let rootDoesHasPassiveEffects = false;

/**
 * 初始化 workInProgress
 * @param fiber
 */
const prepareFreshStack = (root: FiberRootNode, lane: Lane) => {
	// 初始化也可以说是确认 workInProgress 的位置
	// 传入的 root 是 FiberRootNode，current 指向的是 HostRootFiber
	// 为 HostRootFiber 创建 wip FiberNode
	// 所以在 mount 阶段，只有 HostRootFiber 具有 current
	workInProgress = createWorkInProgess(root.current, {});
	wipRootRenderLanes = lane;
};

/**
 * 从触发更新的 FiberNode 开始作更新准备
 * @param fiber 触发更新的 FiberNOde
 * @param lane 触发更新的优先级
 */
export const scheduleUpdateOnFiber = (fiber: FiberNode, lane: Lane) => {
	// 对于 mount 阶段，传入的 fiberNode 是 hostRootFiber
	// 对于 update 阶段，传入的 fiberNode 是触发更新的 fiberNode
	// 我们需要从我们当前的 fiberNode 一直遍历到 fiberRootNode
	const root = markUpdateFromFiberToRoot(fiber);
	// 调用 markRootUpdated 记录 lane 到 FiberRootNode
	markRootUpdated(root, lane);
	// 然后从 fiberRootNode 开始更新流程
	ensureRootIsScheduled(root);
};

/**
 * 判断优先级开始调度
 * @param root FiberRootNode
 * @returns
 */
const ensureRootIsScheduled = (root: FiberRootNode) => {
	// 获取最高优先级的 lane，就是当前需要更新的 lane
	const updateLane = getHighestPriorityLanes(root.pendingLanes);
	if (updateLane === NoLane) return;

	if (updateLane === SyncLane) {
		// 同步优先级，用微任务调度
		if (__DEV__) console.log('在微任务中调度，优先级 =>', updateLane);
		scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root, updateLane));
		scheduleMicroTask(flushSyncCallbacks);
	} else {
		// 其他优先级，用宏任务调度
	}
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

/**
 * render 阶段的入口
 * @param root
 * @param lane
 * @returns
 */
const performSyncWorkOnRoot = (root: FiberRootNode, lane: Lane) => {
	const nextLane = getHighestPriorityLanes(root.pendingLanes);
	if (nextLane !== SyncLane) {
		// 1. 其他比 SyncLane 优先级低的任务
		// 2. NoLane
		ensureRootIsScheduled(root);
		return;
	}

	prepareFreshStack(root, lane);

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
	root.finishedLane = lane;
	wipRootRenderLanes = NoLane;

	// 结束 render 阶段，开始 commit 阶段
	commitRoot(root);
};

/**
 * commit 阶段的入口
 * @param root
 * @returns
 */
const commitRoot = (root: FiberRootNode) => {
	// finishedWork 是完成了 render 阶段的完整 fiber 树，从 HostRootFiber 开始
	const finishedWork = root.finishedWork;

	if (finishedWork === null) return;
	if (__DEV__) console.warn('commit 阶段开始', finishedWork);

	const lane = root.finishedLane;
	if (lane === NoLane) console.error('commit 阶段的 lane 为 NoLane');

	root.finishedWork = null;
	root.finishedLane = NoLane;

	markRootFinished(root, lane);

	if (
		(finishedWork.flags & PassiveMask) !== NoFlags ||
		(finishedWork.subtreeFlags & PassiveMask) !== NoFlags
	) {
		// 保证多次执行 commitRoot 函数只会执行一次 scheduleCallback
		if (!rootDoesHasPassiveEffects) {
			rootDoesHasPassiveEffects = true;
			scheduleCallback(NormalPriority, () => {
				flushPassiveEffects(root.pendingPassiveEffects);
				return;
			});
		}
	}

	// 判断是否存在3个子阶段需要执行的操作
	// mount 阶段，只有 HostRootFiber 存在 flags
	const subtreeHasEffect = (finishedWork.subtreeFlags & MutationMask) !== NoFlags;
	const rootHasEffect = (finishedWork.flags & MutationMask) !== NoFlags;

	if (subtreeHasEffect || rootHasEffect) {
		// beforeMutation
		// mutation
		commitMutationEffects(finishedWork, root);
		// 切换 currnt 指向，从这里开始 wip 变成 current
		root.current = finishedWork;
		// layout
	} else {
		// FIber 树的切换
		root.current = finishedWork;
	}

	rootDoesHasPassiveEffects = false;
	ensureRootIsScheduled(root);
};

/**
 * 执行 useEffect 的副作用
 * @param pendingPassiveEffects FiberRootNode 的 pendingPassiveEffects 属性
 */
const flushPassiveEffects = (pendingPassiveEffects: PendingPassiveEffects) => {
	pendingPassiveEffects.unmount.forEach((effect) => {
		commitHookEffectListUnmount(Passive, effect);
	});
	pendingPassiveEffects.unmount = [];

	pendingPassiveEffects.update.forEach((effect) => {
		commitHookEffectListDestroy(Passive | HookHasEffect, effect);
	});

	pendingPassiveEffects.update.forEach((effect) => {
		commitHookEffectListCreate(Passive | HookHasEffect, effect);
	});
	pendingPassiveEffects.update = [];

	flushSyncCallbacks();
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
	const next = beginWork(fiber, wipRootRenderLanes);
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
