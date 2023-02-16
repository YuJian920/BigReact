import { REACT_ELEMENT_TYPE } from 'shared/ReactSymbols';
import type { ReactElementType, Key, Ref, Props, ReactElement } from 'shared/ReactTypes';

const ReactElement = function (type: ReactElementType, key: Key, ref: Ref, props: Props): ReactElement {
	const element = {
		$$typeof: REACT_ELEMENT_TYPE,
		type,
		key,
		ref,
		props,
		__mark: 'BigReact'
	};

	return element;
};

/**
 * 将 JSX 转换为 ReactElement
 * @param type ReactElement 类型
 * @param config ReactElement 接受的参数
 * @param maybeChildren ReactElement 的子元素
 * @returns ReactElement
 */
export const jsx = (type: ReactElementType, config: any, ...maybeChildren: any) => {
	let key: Key = null;
	const props: Props = {};
	let ref: Ref = null;

	// 对 config 进行便利
	for (const prop in config) {
		const val = config[prop];

		// 从 config 中取出 key 属性
		if (prop === 'key') {
			if (val !== undefined) key = '' + val;
			continue;
		}

		// 从 config 中取出 ref 属性
		if (prop === 'ref') {
			if (val !== undefined) ref = val;
			continue;
		}

		// 检查当前遍历属性是否为 Config 自身属性，自身属性则赋值给 props 中的相应字段
		if (Object.prototype.hasOwnProperty.call(config, prop)) {
			props[prop] = val;
		}
	}

	const childrenLength = maybeChildren.length;
	if (childrenLength) {
		if (childrenLength === 1) props.children = maybeChildren[0];
		else props.children = maybeChildren;
	}

	return ReactElement(type, key, ref, props);
};

export const jsxDEV = (type: ReactElementType, config: any) => {
	let key: Key = null;
	const props: Props = {};
	let ref: Ref = null;

	// 对 config 进行便利
	for (const prop in config) {
		const val = config[prop];

		// 从 config 中取出 key 属性
		if (prop === 'key') {
			if (val !== undefined) key = '' + val;
			continue;
		}

		// 从 config 中取出 ref 属性
		if (prop === 'ref') {
			if (val !== undefined) ref = val;
			continue;
		}

		// 检查当前遍历属性是否为 Config 自身属性，自身属性则赋值给 props 中的相应字段
		if (Object.prototype.hasOwnProperty.call(config, prop)) {
			props[prop] = val;
		}
	}

	return ReactElement(type, key, ref, props);
};
