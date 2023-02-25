import { ReactElementType } from 'shared/ReactTypes';
// @ts-ignore
import { createRoot } from 'react-dom';

export const renderIntoDocument = (element: ReactElementType) => {
	const div = document.createElement('div');
	return createRoot(div).render(element);
};
