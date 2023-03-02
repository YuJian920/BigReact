import { FiberNode } from 'react-reconciler/src/fiber';
import { HostText } from 'react-reconciler/src/workTags';
import { Props } from 'shared/ReactTypes';
import { updateFiberProps } from './SyntheticEvent';

export type Container = Element;
export type Instacne = Element;
export type TextInstacne = Text;

/**
 * 创建宿主环境实例
 * @param args
 * @returns
 */
export const createInstance = (type: string, props: Props): Instacne => {
	const element = document.createElement(type);
	// 更新属性
	updateFiberProps(element, props);
	return element;
};

export const appendInitialChild = (parent: Instacne | Container, child: Instacne) => {
	parent.appendChild(child);
};

export const createTextInstance = (content: string) => {
	return document.createTextNode(content);
};

export const appendChildToContainer = appendInitialChild;

export const commitUpdate = (fiber: FiberNode) => {
	switch (fiber.tag) {
		case HostText:
			// 取出 content
			const text = fiber.memoizedProps.content;
			// 插入 instance
			return commitTextUpdate(fiber.stateNode, text);
		default:
			if (__DEV__) console.warn('未实现的类型');
			break;
	}
};

export const commitTextUpdate = (textInstance: TextInstacne, content: string) => {
	textInstance.textContent = content;
};

export const removeChild = (child: Instacne | TextInstacne, container: Container) => {
	container.removeChild(child);
};
