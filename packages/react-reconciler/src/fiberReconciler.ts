import { Container } from 'hostConfig';
import { ReactElementType } from 'shared/ReactTypes';
import { FiberNode, FiberRootNode } from './fiber';
import { requestUpdateLane } from './fiberLanes';
import { createUpdate, createUpdateQueue, enqueueUpdate, UpdateQueue } from './updateQueue';
import { scheduleUpdateOnFiber } from './workLoop';
import { HostRoot } from './workTags';

/**
 * createRoot 方法内部会调用 createContainer
 * @param container 宿主挂载点
 * @returns
 */
export const createContainer = (container: Container) => {
	// 创建 hostRootFiber，tag 为 HostRoot
	const hostRootFiber = new FiberNode(HostRoot, {}, null);
	// 创建 FiberRootNode，并与 hostRootFiber 关联
	const root = new FiberRootNode(container, hostRootFiber);
	// 接入更新机制
	hostRootFiber.updateQueue = createUpdateQueue();

	return root;
};

/**
 * render 方法内部会调用 updateContainer
 * @param element
 * @param root
 */
export const updateContainer = (element: ReactElementType | null, root: FiberRootNode) => {
	// 从 FiberRootNode 的 current 中取得 hostRootFiber
	const hostRootFiber = root.current;
	const lane = requestUpdateLane();
	// 创建一个类型为 ReactElement 的 update
	const update = createUpdate<ReactElementType | null>(element, lane);
	// 将创建的 update 插入到 hostRootFiber 的 updateQueue
	enqueueUpdate(hostRootFiber.updateQueue as UpdateQueue<ReactElementType | null>, update);
	// 链接 workLoop 更新流程
	scheduleUpdateOnFiber(hostRootFiber, lane);

	return element;
};
