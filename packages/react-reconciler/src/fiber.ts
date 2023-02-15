import type { Key, Props, Ref } from 'shared/ReactTypes';
import type { Flags } from './fiberFlags';
import { NoFlags } from './fiberFlags';
import type { WorkTag } from './workTags';

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
	alternate: FiberNode | null;
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
		this.alternate = null; // 指向内存中的另一颗 Fiber 树
		this.flags = NoFlags; // 标记 Fiber 节点的副作用
	}
}
