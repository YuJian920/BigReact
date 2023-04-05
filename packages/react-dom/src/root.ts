import { createContainer, updateContainer } from 'react-reconciler/src/fiberReconciler';
import type { ReactElementType } from 'shared/ReactTypes';
import type { Container } from './hostConfig';
import { initEvent } from './SyntheticEvent';

// container 是 React 应用的挂载点，在这里是 id 为 root 的div
export const createRoot = (container: Container) => {
	// 创建 hostRootFiber 和 FiberRootNode 并相互关联
	// 返回的 root 是 FiberRootNode
	const root = createContainer(container);
	return {
		render: (element: ReactElementType) => {
			// 初始化事件
			initEvent(container, 'click');
			return updateContainer(element, root);
		}
	};
};
