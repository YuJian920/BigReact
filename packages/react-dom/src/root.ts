import { createContainer, updateContainer } from 'react-reconciler/src/fiberReconciler';
import type { ReactElementType } from 'shared/ReactTypes';
import type { Container } from './hostConfig';

export const createRoot = (container: Container) => {
	const root = createContainer(container);

	return {
		render: (element: ReactElementType) => {
			return updateContainer(element, root);
		}
	};
};
