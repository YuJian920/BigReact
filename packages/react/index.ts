import currentDispatcher from './src/currentDispatcher';
import { Dispatcher, resolveDispatcher } from './src/currentDispatcher';
import { jsxDEV, jsx, isValidElement as isValidElementFn } from './src/jsx';

// 取出数据共享层中的 useState
export const useState: Dispatcher['useState'] = (initialState) => {
	const dispatcher = resolveDispatcher();
	return dispatcher.useState(initialState);
};

// 数据共享层，和 ReactDOM 共享数据
export const __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = {
	currentDispatcher
};

export const version = '0.0.0';
export const createElement = jsx;
export const isValidElement = isValidElementFn;
