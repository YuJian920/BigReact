export type Container = Element;
export type Instacne = Element;

/**
 * 创建宿主环境实例
 * @param args
 * @returns
 */
export const createInstance = (type: string, props: any): Instacne => {
	const element = document.createElement(type);
	return element;
};

export const appendInitialChild = (parent: Instacne | Container, child: Instacne) => {
	parent.appendChild(child);
};

export const createTextInstance = (content: string) => {
	return document.createTextNode(content);
};

export const appendChildToContainer = appendInitialChild;
