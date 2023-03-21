let syncQueue: ((...args: any) => void)[] | null = null;
let isFlushingSyncQueue = false;

export const scheduleSyncCallback = (callback: (...args: any) => void) => {
	if (syncQueue === null) syncQueue = [callback];
	else syncQueue.push(callback);
};

export const flushSyncCallbacks = () => {
	if (!isFlushingSyncQueue && syncQueue) {
		isFlushingSyncQueue = true;
		try {
			syncQueue.forEach((callback) => callback());
		} catch (error) {
			if (__DEV__) console.warn('flushSyncCallbacks 发生错误', error);
		} finally {
			isFlushingSyncQueue = false;
			syncQueue = null;
		}
	}
};
