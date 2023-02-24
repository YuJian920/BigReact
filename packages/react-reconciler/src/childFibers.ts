import { REACT_ELEMENT_TYPE } from 'shared/ReactSymbols';
import { ReactElementType } from 'shared/ReactTypes';
import { createFiberFromElement, FiberNode } from './fiber';
import { Placement } from './fiberFlags';
import { HostText } from './workTags';

/**
 *
 * @param shouldTrackEffects 是否标记副作用
 */
const ChildReconciler = (shouldTrackEffects: boolean) => {
	/**
	 * 协调单一元素节点
	 * @param returnFiber
	 * @param currentFiber
	 * @param element
	 */
	const reconcileSingleElement = (
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		element?: ReactElementType
	) => {
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

		if (__DEV__) console.warn('未实现的 reconcile 类型', newChild);

		return null;
	};

	return reconcileChildFibers;
};

export const reconcileChildFibers = ChildReconciler(true);
export const mountChildFibers = ChildReconciler(false);
