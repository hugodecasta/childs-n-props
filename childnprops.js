
import BoolMaster from './BoolMaster/boolMaster.js'

export default class ChildNProps {

    constructor(key, dir) {

        this.bm = new BoolMaster(dir+'BoolMaster/api.php')

        this.key = key

        this.base = {
            props:{},
            childs:{},
            value:null
        }

        this.childs = {}
        this.props = {}

        this.waiters = []
    }

    // ----------------------------------

    async init() {

    }

    // ----------------------------------

    async online_check() {

        if(!('last_loaded' in this)) {
            this.last_loaded_str = JSON.stringify(this.base)
        }

        if(JSON.stringify(this.base) != this.last_loaded_str) {
            await this.bm.write_key(this.key, this.base)
            return
        }

        if(!await this.bm.key_exists(this.key)) {
            this.trigger_event('del',null)
            return
        }
        let loaded_base = await this.bm.read_key(this.key)
        let last_loaded = JSON.parse(this.last_loaded_str)

        if(loaded_base.value != last_loaded.value) {
            this.set_value(loaded_base.value)
        }
        let childs_to_add = []
        let childs_to_del = []
        for(let id in loaded_base.childs) {
            if(!(id in last_loaded.childs)) {
                childs_to_add.push(id)
            }
        }
        for(let id in last_loaded.childs) {
            if(!(id in loaded_base.childs)) {
                this.childs_to_del(id)
            }
        }
        for(let id of childs_to_add) {
            this.add_child(id)
        }
        for(let id of childs_to_del) {
            this.del_child(id)
        }
    }

    // ----------------------------------
    
    add_child(child_id) {
        this.base.childs[child_id] = child_id
        this.trigger_event('new_child',child_id)
    }

    del_child(child_id) {
        delete this.base.childs[child_id]
        this.trigger_event('del_child',child_id)
    }

    set_value(value) {
        this.base.
    }

    // ----------------------------------

    trigger_event(type, data) {
        this.trigger({type,data})
    }

    trigger(event) {
        for(let cb of this.waiters) {
            this.waiters(event)
        }
    }

    // ----------------------------------

    on(callback) {
        this.waiters.push(callback)
    }

    on_set_value(callback) {
        let cb = function(event) {
            if(event.type == 'set_value') {
                callback(event.data)
            }
        }
        this.on(cb)
    }

    on_new_child(callback) {
        let cb = function(event) {
            if(event.type == 'new_child') {
                callback(event.data)
            }
        }
        this.on(cb)
    }

    on_del_child(callback) {
        let cb = function(event) {
            if(event.type == 'del_child') {
                callback(event.data)
            }
        }
        this.on(cb)
    }

    on_del(callback) {
        let cb = function(event) {
            if(event.type == 'del') {
                callback(event.data)
            }
        }
        this.on(cb)
    }
}