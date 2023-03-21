import { Action } from 'shared/ReactTypes';

export interface Dispatcher {
	useState: <T>(initialState: () => T | T) => [T, Dispatch<T>];
	useEffect: (create: () => void | void, deps: any[] | void) => void;
}

export type Dispatch<State> = (action: Action<State>) => void;

const currentDispatcher: { current: Dispatcher | null } = {
	current: null
};

/**
 * 取出阶段 Hook
 * @returns
 */
export const resolveDispatcher = (): Dispatcher => {
	const dispatcher = currentDispatcher.current;

	if (dispatcher === null) throw new Error('hook 只能在函数组件中执行');
	return dispatcher;
};

export default currentDispatcher;
