import { REACT_ELEMENT_TYPE, REACT_FRAGMENT_TYPE } from 'shared/ReactSymbols';
import { Key, Props, ReactElementType } from 'shared/ReactTypes';
import {
	createFiberFromElement,
	createFiberFromFragment,
	createWorkInProgess,
	FiberNode
} from './fiber';
import { ChildDeletion, Placement } from './fiberFlags';
import { Fragment, HostText } from './workTags';

type ExistingChildren = Map<string | number, FiberNode>;

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
						let props = element.props;
						// 针对 React.Fragment 的特殊处理，取出它的子元素作为 props
						// Fragment 也是 Fiber 节点，也需要被创建
						if (element.type === REACT_FRAGMENT_TYPE) props = element.props.children;
						// 完全相同，复用逻辑
						const existing = useFiber(currentFiber, props);
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
		let fiber;
		if (element.type === REACT_FRAGMENT_TYPE) {
			fiber = createFiberFromFragment(element.props.children, key);
		} else {
			fiber = createFiberFromElement(element);
		}
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
	 * 协调多节点
	 * @param returnFiber 父节点
	 * @param currentFirstChild 当前子节点
	 * @param newChild ReactElement 数组
	 * @returns
	 */
	const reconcileChildrenArray = (
		returnFiber: FiberNode,
		currentFirstChild: FiberNode | null,
		newChild: any[]
	) => {
		// 最后一个可复用 fiber 在 current 中的位置
		let lastPlacedIndex = 0;
		// 创建的最后一个 FiberNode
		let lastNewFiber: FiberNode | null = null;
		// 创建的第一个 FiberNode
		let firstNewFiber: FiberNode | null = null;

		// 1. 将 current 保存在 Map 中
		const existingChildren: ExistingChildren = new Map();
		let current = currentFirstChild;
		// 遍历 currentFirstChild，将所有子节点保存在 Map 中
		while (current !== null) {
			// 取出 key，如果 key 不存在，则使用 index 作为 key
			// key 会作为 Map 的 key，在后续遍历 newChild 时，可以通过 key 快速找到对应的 current
			const keyToUse = current.key !== null ? current.key : current.index;
			existingChildren.set(keyToUse, current);
			// 遍历下一个节点
			current = current.sibling;
		}

		for (let i = 0; i < newChild.length; i++) {
			// 2. 遍历 newChild，寻找可复用的节点
			const after = newChild[i];
			const newFiber = updateFromMap(returnFiber, existingChildren, i, after);
			// 返回的 newFiber 是可复用的节点，接下来要判断是移动还是插入
			// newFiber 为 null，可能表示当前节点在更新之后是 false 或者 null
			if (newFiber === null) continue;

			// 3. 判断移动还是插入
			newFiber.index = i;
			newFiber.return = returnFiber;

			if (lastNewFiber === null) {
				firstNewFiber = newFiber;
				lastNewFiber = newFiber;
			} else {
				lastNewFiber.sibling = newFiber;
				lastNewFiber = lastNewFiber.sibling;
			}

			if (!shouldTrackEffects) continue;

			const current = newFiber.alternate;
			if (current !== null) {
				const oldIndex = current.index;
				if (oldIndex < lastPlacedIndex) {
					// 当前节点需要移动
					newFiber.flags |= Placement;
					continue;
				} else {
					// 当前节点不需要移动，更新 lastPlacedIndex
					lastPlacedIndex = oldIndex;
				}
			} else {
				// mount
				newFiber.flags |= Placement;
			}
		}

		// 4. 删除 Map 中剩余的节点
		existingChildren.forEach((fiber) => {
			deleteChild(returnFiber, fiber);
		});

		return firstNewFiber;
	};

	/**
	 * 判断 existingChildren 中是否存在可复用的节点
	 * @param returnFiber 父节点
	 * @param existingChildren existingChildren
	 * @param index 索引
	 * @param element ReactElement
	 * @returns
	 */
	const updateFromMap = (
		returnFiber: FiberNode,
		existingChildren: ExistingChildren,
		index: number,
		element: any
	): FiberNode | null => {
		const keyToUse = element.key !== null ? element.key : index;
		const before = existingChildren.get(keyToUse);

		// HostText
		if (typeof element === 'string' || typeof element === 'number') {
			if (before) {
				if (before.tag === HostText) {
					// 可复用，删除 existingChildren 中的节点
					existingChildren.delete(keyToUse);
					return useFiber(before, { content: element + '' });
				}
			}
			return new FiberNode(HostText, { content: element + '' }, null);
		}

		// ReactElement
		if (typeof element === 'object' && element !== null) {
			switch (element.$$typeof) {
				case REACT_ELEMENT_TYPE:
					if (element.type === REACT_FRAGMENT_TYPE) {
						return updateFragment(returnFiber, before, element, keyToUse, existingChildren);
					}
					// before 存在则表示 key 相同
					if (before) {
						// type 相同，可复用
						if (before.type === element.type) {
							existingChildren.delete(keyToUse);
							return useFiber(before, element.props);
						}
					}
					// key 不同，tupe 不同，创建新节点
					return createFiberFromElement(element);
			}
		}

		// 处理数组子元素又是数组的情况
		// 例如：[1, [2, 3]]
		// 直接当作 Fragment 处理
		if (Array.isArray(element)) {
			return updateFragment(returnFiber, before, element, keyToUse, existingChildren);
		}

		return null;
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
		newChild?: any
	) => {
		const isUnkeyedTopLevelFragment =
			typeof newChild === 'object' &&
			newChild !== null &&
			newChild.type === REACT_FRAGMENT_TYPE &&
			newChild.key === null;

		if (isUnkeyedTopLevelFragment) newChild = newChild.props.children;

		if (typeof newChild === 'object' && newChild !== null) {
			// 多节点情况
			if (Array.isArray(newChild)) {
				return reconcileChildrenArray(returnFiber, currentFiber, newChild);
			}

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
		if (currentFiber !== null) deleteRemainingChildren(returnFiber, currentFiber);

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

const updateFragment = (
	returnFiber: FiberNode,
	current: FiberNode | undefined,
	elements: any[],
	key: Key,
	existingChildren: ExistingChildren
) => {
	let fiber;
	if (!current || current.tag !== Fragment) {
		// current 不存在或者 tag 不为 Fragment，创建新节点
		fiber = createFiberFromFragment(elements, key);
	} else {
		// current 存在且 tag 为 Fragment，复用
		existingChildren.delete(key);
		fiber = useFiber(current, elements);
	}

	fiber.return = returnFiber;
	return fiber;
};

export const reconcileChildFibers = ChildReconciler(true);
export const mountChildFibers = ChildReconciler(false);
