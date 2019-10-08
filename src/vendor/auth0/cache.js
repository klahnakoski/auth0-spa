import {sleep} from "../signals";
import {json2value, value2json} from "../convert";
import {GMTDate as Date} from "../dates";
import {missing} from "../utils";
import {Data} from "../datas";
import {Log} from "../logs";

const ls = window.localStorage;

class Cache {
    constructor({name, onStateChange}) {
        this.name = name;
        this.value = null;
        this.timestamp = 0;
        this.onStateChange = onStateChange;  // function called when external change happened

        // this.onStateChange = coalesce(onStateChange, () => 0);  // function called when external change happened
        this.updater();
    }

    async updater(pleaseStop) {
        while (true) {
            await sleep(1000);
            const {name} = this;
            const timestamp = json2value(ls.getItem(name + ".timestamp"));
            if (this.timestamp === timestamp) continue;

            if (this.timestamp > timestamp) {
                //update storage with newer value
                this._push();
            } else {
                // let storage update this.value
                this.timestamp = timestamp;
                this.value = json2value(ls.getItem(name + ".value"));
                try {
                    this.onStateChange(timestamp);
                } catch (e) {
                    Log.warning("callback after change in {{name|quote}} failed", {name})
                }
            }
        }
    }

    set(value) {
        this.timestamp = Date.now().unix();
        this.value = value;
        this._push();
    }


    get(path) {
        if (missing(path)) return this.value;
        return Data.get(this.value, path);
    }

    _push() {
        ls.setItem(this.name + ".timestamp", value2json(this.timestamp));
        ls.setItem(this.name + ".value", value2json(this.value));
    }

    clear() {
        this.timestamp = Date.now().unix();
        this.value = null;
        this._push();
    }

}

export {Cache};