type Subscriber<T> = (value: T) => void;

type SimpleStore<T> = {
    get: () => T;
    set: (newVal: T) => void;
    subscribe: (cb: Subscriber<T>) => void;
    unsubscribe: (cb: Subscriber<T>) => void;
};

export function createStore<T>(initialValue: T): SimpleStore<T> {
    let _val = initialValue;
    const subs = new Set<Subscriber<T>>();
    return {
        get: () => _val,
        set: (newVal) => {
            _val = newVal;
            Array.from(subs).forEach((cb) => cb(_val));
        },
        subscribe: (cb) => {
            subs.add(cb);
            cb(_val);
        },
        unsubscribe: (cb) => {
            subs.delete(cb);
        },
    };
}
