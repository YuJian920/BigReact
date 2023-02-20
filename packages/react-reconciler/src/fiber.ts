import type { Key, Props, ReactElementType, Ref } from 'shared/ReactTypes';
import type { Flags } from './fiberFlags';
import { NoFlags } from './fiberFlags';
import { FunctionComponents, HostComponent, WorkTag } from './workTags';
import type { Container } from 'hostConfig';

export class FiberNode {
	tag: WorkTag;
	key: Key;
	stateNode: any;
	type: any;

	return: FiberNode | null;
	sibling: FiberNode | null;
	child: FiberNode | null;
	index: number;

	ref: Ref;

	pendingProps: Props;
	memoizedProps: Props | null;
	memoizedState: any;
	alternate: FiberNode | null;
	updateQueue: unknown;
	flags: Flags;

	constructor(tag: WorkTag, pendingProps: Props, key: Key) {
		// Fiber 节点本身的信息
		this.tag = tag; // Fiber 的 tag
		this.key = key;
		this.stateNode = null; // 对于 HostComponent 来说，stateNode 保存的就是其对应的 DOM 元素
		this.type = null; // 表示 Fiber 节点的类型，用 FunctionComponent 举例，这里存放的就是 FunctionComponent 函数本身

		// Fiber 节点的关系
		this.return = null; // 指向父 Fiber 节点，之所以用 return 来表示，是因为 React 使用深度优先遍历，而当前工作单元（Fiber）结束之后的下一个工作单元（Fiber）就是父 Fiber 节点
		this.sibling = null; // 指向第一个兄弟 Fiber 节点
		this.child = null; // 指向其第一个子 Fiber 节点
		this.index = 0; // 表示其在多个兄弟 Fiber 节点当中的位置

		this.ref = null;

		// 作为工作单元
		this.pendingProps = pendingProps; // 刚开始准备工作时的 props
		this.memoizedProps = null; // 工作结束后确认的 props
		this.memoizedState = null; // 计算之后的 state
		this.alternate = null; // 指向内存中的另一颗 Fiber 树
		this.updateQueue = null; // 更新机制
		this.flags = NoFlags; // 标记 Fiber 节点的副作用
	}
}

export class FiberRootNode {
	container: Container; // 保存对应宿主环境的挂载节点，也就是 createRoot 传入的参数
	current: FiberNode; // 指向 hostRootFiber
	finishedWork: FiberNode | null;

	constructor(container: Container, hostRootFiber: FiberNode) {
		this.container = container;
		this.current = hostRootFiber;
		// hostRootFiber 的 stateNode 指向 FiberRootNode
		hostRootFiber.stateNode = this;
		this.finishedWork = null;
	}
}

/**
 * 创建 WorkInProgess FiberNode
 * @param current
 * @param pendingProps
 * @returns
 */
export const createWorkInProgess = (current: FiberNode, pendingProps: Props) => {
	// 由于 React 采用的是双缓存机制，所以需要从 current 的 alternate 中获取到 WorkInProgess
	let wip = current.alternate;

	// 当首屏渲染或者说挂载阶段，current 会没有对应的 WorkInProgess
	if (wip === null) {
		// mount
		wip = new FiberNode(current.tag, pendingProps, current.key);
		wip.stateNode = current.stateNode;

		// 双向链接
		wip.alternate = current;
		current.alternate = wip;
	} else {
		// update
		// 更新 propsreturnFiber: FiberNode, currentFiber: FiberNode | null, newChild?: ReactElement
		wip.pendingProps = pendingProps;
		// 清空副作用
		wip.flags = NoFlags;
	}

	// 复用元素
	wip.type = current.type;
	wip.updateQueue = current.updateQueue;
	wip.child = current.child;
	wip.memoizedProps = current.memoizedProps;
	wip.memoizedState = current.memoizedState;

	return wip;
};

/**
 * 根据 ReactElement 创建 FiberNode
 * @param element
 * @returns
 */
export const createFiberFromElement = (element: ReactElementType): FiberNode => {
	const { type, key, props } = element;
	let fiberTag: WorkTag = FunctionComponents;

	if (typeof type === 'string') {
		fiberTag = HostComponent;
	} else if (typeof type !== 'function' && __DEV__) {
		console.warn('未定义的 type 类型', element);
	}
	const fiber = new FiberNode(fiberTag, props, key);
	fiber.type = fiber;

	return fiber;
};
