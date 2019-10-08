import {Log} from "./logs";

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

const delayedValue = () => {
    // return a Promise to a value
    // this.resolve(value) to assign the value when available
    let selfResolve = null;
    let selfReject = null;
    const self = new Promise((resolve, reject) => {
        selfResolve = resolve;
        selfReject = reject;
    });

    self.resolve = selfResolve;
    self.reject = selfReject;

    return self;
};

/*
Binary, unidiretional, signal
Signal starts as `false` and can be triggered to be `true`, it can not go back to `false`.
use `go()` to trigger the signal
attach dependnecies to signal, or wait on signal to continue async functions.
 */
class Signal {

    constructor(){
        this.go = false;
        this._waiting = [];
    }

    valueOf(){
        return this.go;
    }

    /*
    Execute `func` when signalled, once and only once.
    If already signalled, then `func` is executed immediately
     */
    then(func){
        if (this.go){
            func();
        }else{
            this._waiting.push(func);
        }
    }

    /*
    Trigger this signal
     */
    go(){
        if (this.go) return;

        this.go = true;
        const waiting = this._waiting;
        this._waiting = [];

        waiting.forEach(func=>{
            try {
                func()
            }catch(e){
                Log.warning("failure during execution of function", e)
            }
        });
    }

    /*
    Let async function sleep until signalled

    ```
        const s = new Signal();
        ...
        await s.wait();
    ```
     */
    async wait(){
        // return a Promise that will resolve when signalled
        return new Promise((resolve) => {
            this._waiting.push(resolve);
        });
    }

}

/*
A signal based on a timeout
 */
class Timer extends Signal {
    constructor(timeout){
        super();
        setTimeout(this.go, timeout);
    }
}


export {sleep, delayedValue, Signal, Timer}