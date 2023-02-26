import { REACT_ELEMENT_TYPE } from 'shared/ReactSymbols';
import { Props, ReactElementType } from 'shared/ReactTypes';
import { createFiberFromElement, createWorkInProgess, FiberNode } from './fiber';
import { ChildDeletion, Placement } from './fiberFlags';
import { HostText } from './workTags';

/**
 *
 * @param shouldTrackEffects 是否标记副作用
 */
const ChildReconciler = (shouldTrackEffects: boolean) => {
	/**
	 * 标记删除节点
	 * @param returnFiber
	 * @param childToDelete
	 * @returns
	 */
	const deleteChild = (returnFiber: FiberNode, childToDelete: FiberNode) => {
		if (!shouldTrackEffects) return;

		// 取出删除节点列表
		const deletions = returnFiber.deletions;
		if (deletions === null) {
			// 当前 deletions 不存在需要被删除的子节点
			returnFiber.deletions = [childToDelete];
			returnFiber.flags |= ChildDeletion;
		} else {
			deletions.push(childToDelete);
		}
	};

	/**
	 * 协调单一元素节点
	 * @param returnFiber 父节点
	 * @param currentFiber 子节点
	 * @param element 子节点 ReactElement
	 */
	const reconcileSingleElement = (
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		element: ReactElementType
	) => {
		const key = element.key;
		const type = element.type;
		work: if (currentFiber !== null) {
			// update
			if (currentFiber.key === key) {
				// key 相同
				if (element.$$typeof === REACT_ELEMENT_TYPE) {
					if (currentFiber.type === type) {
						// type 相同
						// 完全相同，复用逻辑
						const existing = useFiber(currentFiber, element.props);
						existing.return = returnFiber;
						return existing;
					}
					// 删除旧节点 —— 删除对应的 current FiberNode
					deleteChild(returnFiber, currentFiber);
					// break 走后续创建逻辑
					break work;
				} else {
					if (__DEV__) console.warn('未实现当前 element 类型', element);
					break work;
				}
			} else {
				// 删除旧节点 —— 删除对应的 current FiberNode
				deleteChild(returnFiber, currentFiber);
			}
		}

		// 创建子元素的 FiberNode
		const fiber = createFiberFromElement(element);
		fiber.return = returnFiber;

		return fiber;
	};

	/**
	 * 协调文本类型节点
	 * @param returnFiber
	 * @param currentFiber
	 * @param content
	 * @returns
	 */
	const reconcileSingleTextNode = (
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		content?: string | number
	) => {
		if (currentFiber !== null) {
			// update
			if (currentFiber.tag === HostText) {
				// 对于 HostText 类型节点，只用判断 tag 是否相同
				const existing = useFiber(currentFiber, { content });
				existing.return = returnFiber;
				return existing;
			}
			deleteChild(returnFiber, currentFiber);
		}
		const fiber = new FiberNode(HostText, { content }, null);
		fiber.return = returnFiber;

		return fiber;
	};

	/**
	 * 插入单一节点
	 * @param fiber
	 * @returns
	 */
	const placeSingleChild = (fiber: FiberNode) => {
		// mount 阶段且 shouldTrackEffects 为 true
		// 这种情况下，只有 hostRootFiber 的子 Fiber 满足这个条件
		if (shouldTrackEffects && fiber.alternate === null) fiber.flags |= Placement;
		return fiber;
	};

	/**
	 *
	 * @param returnFiber 父 fiberNode
	 * @param currentFiber 待比较 子fiberNode
	 * @param newChild 待比较 子ReactElement
	 */
	const reconcileChildFibers = (
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		newChild?: ReactElementType
	) => {
		if (typeof newChild === 'object' && newChild !== null) {
			switch (newChild.$$typeof) {
				case REACT_ELEMENT_TYPE:
					return placeSingleChild(reconcileSingleElement(returnFiber, currentFiber, newChild));
				default:
					if (__DEV__) console.warn('未实现的 reconcile 类型', newChild);
					break;
			}
		}

		// HostText
		if (typeof newChild === 'string' || typeof newChild === 'number') {
			return placeSingleChild(reconcileSingleTextNode(returnFiber, currentFiber, newChild));
		}

		// 兜底处理
		if (currentFiber !== null) deleteChild(returnFiber, currentFiber);

		if (__DEV__) console.warn('未实现的 reconcile 类型', newChild);

		return null;
	};

	return reconcileChildFibers;
};

/**
 * 复用 fiberNode
 * @param fiber 复用的 fiberNode
 * @param pendingProps 复用的 pendingProps
 * @returns
 */
const useFiber = (fiber: FiberNode, pendingProps: Props): FiberNode => {
	// 根据传入的 fiberNode 和 pendingProps 创建 fiberNode
	const clone = createWorkInProgess(fiber, pendingProps);
	clone.index = 0;
	clone.sibling = null;
	return clone;
};

export const reconcileChildFibers = ChildReconciler(true);
export const mountChildFibers = ChildReconciler(false);
