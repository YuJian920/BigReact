import { REACT_ELEMENT_TYPE } from 'shared/ReactSymbols';
import { Props, ReactElementType } from 'shared/ReactTypes';
import { createFiberFromElement, createWorkInProgess, FiberNode } from './fiber';
import { ChildDeletion, Placement } from './fiberFlags';
import { HostText } from './workTags';

/**
 * 协调子节点
 * @param shouldTrackEffects 是否需要追踪 effect
 */
const ChildReconciler = (shouldTrackEffects: boolean) => {
	/**
	 * 标记删除节点
	 * @param returnFiber 父节点
	 * @param childToDelete 待删除的子节点
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
	 * 删除剩余的子节点
	 * @param returnFiber 父节点
	 * @param currentFirstChild 当前子节点
	 * @returns
	 */
	const deleteRemainingChildren = (returnFiber: FiberNode, currentFirstChild: FiberNode | null) => {
		if (!shouldTrackEffects) return;
		let childToDelete = currentFirstChild;

		while (childToDelete !== null) {
			deleteChild(returnFiber, childToDelete);
			childToDelete = childToDelete.sibling;
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
		while (currentFiber !== null) {
			// update
			if (currentFiber.key === key) {
				// key 相同
				if (element.$$typeof === REACT_ELEMENT_TYPE) {
					if (currentFiber.type === type) {
						// type 相同
						// 完全相同，复用逻辑
						const existing = useFiber(currentFiber, element.props);
						existing.return = returnFiber;
						// 当前节点可复用，剩下的节点都是需要被删除的节点
						deleteRemainingChildren(returnFiber, currentFiber.sibling);
						return existing;
					}
					// key 相同，type 不同 —— 不存在可复用的节点，删除旧节点，创建新节点
					deleteRemainingChildren(returnFiber, currentFiber.sibling);
					// break 走后续创建逻辑
					break;
				} else {
					if (__DEV__) console.warn('未实现当前 element 类型', element);
					break;
				}
			} else {
				// key 不同 —— 当前节点不可复用，删除旧节点，继续遍历下一个节点
				// 删除旧节点 —— 删除对应的 current FiberNode
				deleteChild(returnFiber, currentFiber);
				currentFiber = currentFiber.sibling;
			}
		}

		// 创建子元素的 FiberNode
		const fiber = createFiberFromElement(element);
		fiber.return = returnFiber;
		return fiber;
	};

	/**
	 * 协调单一文本节点
	 * @param returnFiber 父 fiberNode
	 * @param currentFiber 待比较 子fiberNode
	 * @param content	文本内容
	 * @returns
	 */
	const reconcileSingleTextNode = (
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		content?: string | number
	) => {
		while (currentFiber !== null) {
			// update
			if (currentFiber.tag === HostText) {
				// 对于 HostText 类型节点，只用判断 tag 是否相同
				const existing = useFiber(currentFiber, { content });
				existing.return = returnFiber;
				deleteRemainingChildren(returnFiber, currentFiber.sibling);
				return existing;
			}
			// tag 不同 —— 当前节点不可复用，删除旧节点，继续遍历下一个节点
			deleteChild(returnFiber, currentFiber);
			currentFiber = currentFiber.sibling;
		}

		// 创建子元素的 FiberNode
		const fiber = new FiberNode(HostText, { content }, null);
		fiber.return = returnFiber;
		return fiber;
	};

	/**
	 * 标记 Placement
	 * @param fiber fiberNode
	 * @returns
	 */
	const placeSingleChild = (fiber: FiberNode) => {
		// mount 阶段且 shouldTrackEffects 为 true
		// 这种情况下，只有 hostRootFiber 的子 Fiber 满足这个条件
		if (shouldTrackEffects && fiber.alternate === null) fiber.flags |= Placement;
		return fiber;
	};

	/**
	 * 协调子节点
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
