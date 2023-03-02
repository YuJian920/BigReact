import { Container } from 'hostConfig';
import { Props } from 'shared/ReactTypes';

export const elementPropsKey = '__props';
const validEventTypeList = ['click'];

type EventCallback = (event: Event) => void;

interface SyntheticEvent extends Event {
	__stopPropagation: boolean;
}

interface Paths {
	capture: EventCallback[];
	bubble: EventCallback[];
}

export interface DOMElement extends Element {
	[elementPropsKey]?: Props;
}

/**
 * @param node 当前节点
 * @param props 当前节点的 props
 */
export const updateFiberProps = (node: DOMElement, props: Props) => {
	node[elementPropsKey] = props;
};

/**
 * 初始化事件，将事件绑定到 container 上
 * @param container 根元素
 * @param eventType 事件类型
 * @returns
 */
export const initEvent = (container: Container, eventType: string) => {
	if (!validEventTypeList.includes(eventType)) {
		console.warn(`事件类型 ${eventType} 未实现`);
		return;
	}

	if (__DEV__) console.log(`初始化事件 ${eventType}`);

	container.addEventListener(eventType, (e) => {
		dispatchEvent(container, eventType, e);
	});
};

/**
 * 创建一个 SyntheticEvent
 * @param event 原生事件
 */
const createSyntheticEvent = (event: Event): SyntheticEvent => {
	const syntheticEvent = event as SyntheticEvent;
	syntheticEvent.__stopPropagation = false;
	const originStopPropagation = event.stopPropagation;

	syntheticEvent.stopPropagation = () => {
		syntheticEvent.__stopPropagation = true;
		if (originStopPropagation) {
			originStopPropagation();
		}
	};

	return syntheticEvent;
};

/**
 * 事件派发
 * @param container 根元素
 * @param eventType 事件类型
 * @param event 原生事件
 * @returns
 */
const dispatchEvent = (container: Container, eventType: string, event: Event) => {
	// targetElement 为触发事件的元素
	const targetElement = event.target;

	if (targetElement === null) {
		console.warn('事件不存在');
		return;
	}
	// 1. 收集沿途的事件
	const { bubble, capture } = collectPaths(targetElement as DOMElement, container, eventType);
	// 2. 构造 SyntheticEvent
	const syntheticEvent = createSyntheticEvent(event);
	// 3. 遍历 captue
	triggerEventFlow(capture, syntheticEvent);
	// 4. 遍历 bubble
	if (!syntheticEvent.__stopPropagation) {
		triggerEventFlow(bubble, syntheticEvent);
	}
};

/**
 * 遍历 captue 和 bubble
 * @param paths bubble
 * @param syntheticEvent SyntheticEvent
 * @returns
 */
const triggerEventFlow = (paths: EventCallback[], syntheticEvent: SyntheticEvent) => {
	for (let i = 0; i < paths.length; i++) {
		const callback = paths[i];
		// 待验证: 为什么要用 call 呢？因为 callback 里面的 this 指向的是 DOMElement
		callback.call(null, syntheticEvent);
		// 如果 syntheticEvent.__stopPropagation 为 true，则停止遍历
		if (syntheticEvent.__stopPropagation) break;
	}
};

/**
 * 根据事件类型获取对应的回调函数名
 * @param eventType 事件类型
 * @returns
 */
const getEventCallbackNameFromEventType = (eventType: string): string[] | undefined => {
	return {
		// 事件类型: [捕获阶段回调, 冒泡阶段回调]
		click: ['onClickCapture', 'onClick']
	}[eventType];
};

/**
 * 向上收集事件
 * @param targatElement 事件触发的元素
 * @param container 根元素
 * @param eventType 事件类型
 * @returns
 */
const collectPaths = (targatElement: DOMElement, container: Container, eventType: string) => {
	const paths: Paths = {
		capture: [],
		bubble: []
	};

	while (targatElement && targatElement !== container) {
		// 1. 获取 targatElement 的 props
		const elementProps = targatElement[elementPropsKey];
		if (elementProps) {
			// 2. 获取 targatElement 的回调函数名
			const callbackNameList = getEventCallbackNameFromEventType(eventType);
			if (callbackNameList) {
				// 3. 遍历 targatElement 的回调函数名
				callbackNameList.forEach((callbackName, i) => {
					// 4. 获取 targatElement 的回调函数，根据 i 的值判断是 捕获阶段回调 还是 冒泡阶段回调
					const eventCallback = elementProps[callbackName];
					if (eventCallback) {
						if (i === 0) {
							// capture
							// q:这里为什么要用 unshift 而不是 push 呢？
							// a:因为 capture 阶段是从外到内，所以要倒序执行
							paths.capture.unshift(eventCallback);
						} else {
							paths.bubble.push(eventCallback);
						}
					}
				});
			}
		}
		// 5. 向上遍历 targatElement 的父元素
		targatElement = targatElement.parentNode as DOMElement;
	}
	return paths;
};
