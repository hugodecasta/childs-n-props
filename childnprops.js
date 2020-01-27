import BoolMaster from "./BoolMaster/boolMaster.js"

// -----------------------------------------------------------------

export var bm = new BoolMaster('./Childs-n-Props/BoolMaster/api.php')
var store = {}
var id = uuid()

// -----------------------------------------------------------------

setInterval(async function() {
    for(let id in store) {
        let data = store[id]
        await data.check_online()
    }
},2000)

// -----------------------------------------------------------------
// -----------------------------------------------------------------

export default async function CNP_DATA_factory(data_descriptor, key) {
    if(key in store) {
        return store[key]
    }
    store[key] = new CNP_DATA(data_descriptor, key)
    await store[key].init()
    store[key].on_del(function() {
        delete store[key]
    })
    return store[key]
}

async function force_data(key=null,base={childs:{},value:null}) {
    key = key==null?uuid():key
    await bm.write_key(key,base)
    return key
}

function merge_object(base, spec) {
    base = $.extend(true,{},base)
    for(let prop in spec) {
        base[prop] = spec[prop]
    }
    return $.extend(true,{},base)
}

function uuid() {
    return Math.random()+''+Date.now()
}

// -----------------------------------------------------------------

let base_data_descriptor = {
    props:{},
    childs:{},
    value:null,
    prompt_name:'value',
    force:false,
    pre_methods:[]
}

function fill_base_desc(descriptor) {
    return merge_object(base_data_descriptor, descriptor)
}

// -----------------------------------------------------------------------------
// -----------------------------------------------------------------------------

class CNP_DATA {

    constructor(data_descriptor, key) {

        this.desc = fill_base_desc(data_descriptor)
        this.key = key

        this.base = {
            childs:{},
            value:null,
        }

        this.props = {}
        this.childs = {}

        this.change = false
        this.listeners = []

        this.is_init = false

        let me = this
    }

    // --------------------------------

    // --------------------------------

    async check_online() {

        if(! await bm.key_exists(this.key)) {
            if(!this.desc.force) {
                this.trigger('del',null)
                return false
            }
            let value = this.desc.value
            if(isNaN(value)) {
                value = prompt(this.desc.prompt_name)
                if(value == null) {
                    this.trigger('refuse',null)
                    return false
                }
                this.trigger('set',value)
                this.base.value = value
            }
            await force_data(this.key,this.base)
            return true
        }

        if(this.change) {
            this.change = false
            await force_data(this.key,this.base)
            return true
        }

        let loaded = await bm.read_key(this.key)

        if(this.base.value != loaded.value) {
            this.set(loaded.value)
        }

        let new_childs = Object.keys(loaded.childs).filter(id=>Object.keys(this.base.childs).indexOf(id)==-1)
        let del_childs = Object.keys(this.base.childs).filter(id=>Object.keys(loaded.childs).indexOf(id)==-1)

        for(let child of new_childs) {
            this.link_child(child, false)
        }

        for(let child of del_childs) {
            this.unlink_child(child, false)
        }

        return true
    }

    // --------------------------------

    delete() {
        for(let id in this.childs) {
            this.childs[id].delete()
        }
        for(let id in this.props) {
            this.props[id].delete()
        }
        this.trigger('del',null)
        bm.key_remove(this.key)
    }

    // --------------------------------

    async init() {

        let me = this

        if(this.is_init) {
            return
        }

        for(let pre_method of this.desc.pre_methods) {
            pre_method.call(this)
        }

        this.base.value = this.desc.value

        if(! await this.check_online()) {
            return
        }

        for(let prop in this.desc.props) {
            let prop_key = this.key+'/'+prop
            let prop_desc = this.desc.props[prop]
            prop_desc = fill_base_desc(prop_desc)
            prop_desc.pre_methods.push(function() {
                this.on_type('refuse',function() {
                    me.delete()
                })
            })
            prop_desc.prompt_name = prop
            prop_desc.force = true
            let data = await CNP_DATA_factory(prop_desc, prop_key)
            data.parent = this
            this.props[prop] = data
        }

        this.is_init = true
    }

    // --------------------------------

    their_is_a_change(auto_save) {
        this.change = true
        if(auto_save) {
            this.check_online()
        }
    }

    // --------------------------------

    get() {
        return this.base.value
    }

    // --------------------------------

    set(value, auto_save=true) {
        this.base.value = value
        this.their_is_a_change(auto_save)
        this.trigger('set',value)
    }

    async link_child(child_key, auto_save=true) {
        this.base.childs[child_key] = child_key
        this.their_is_a_change(auto_save)
        let cdata = await CNP_DATA_factory(this.desc.childs,child_key)
        cdata.parent = this
        this.childs[child_key] = cdata
        let me = this
        cdata.on_del(function() {
            me.unlink_child(child_key)
        })
        this.trigger('link_child',child_key)
    }

    unlink_child(child_key, auto_save=true) {
        delete this.base.childs[child_key]
        delete this.childs[child_key]
        this.their_is_a_change(auto_save)
        this.trigger('unlink_child',child_key)
    }

    // --------------------------------

    async create_child() {
        let id = uuid()
        await force_data(id)
        await this.link_child(id)
    }

    // --------------------------------

    trigger(type, data) {
        for(let listener of this.listeners) {
            listener.call(this,type,data)
        }
    }

    // --------------------------------

    on(listener) {
        this.listeners.push(listener)
    }

    on_type(listen_type, listener) {
        this.on(function (type, data) {
            if(type == listen_type) {
                listener.call(this,data)
            }
        })
    }

    on_link_child(listener) {
        this.on_type('link_child', listener)
        if(this.is_init) {
            for(let id in this.childs) {
                listener.call(this,id)
            }
        }
    }

    on_unlink_child(listener) {
        this.on_type('unlink_child', listener)
    }

    on_set(listener) {
        this.on_type('set', listener)
        if(this.is_init) {
            listener.call(this,this.base.value)
        }
    }

    on_del(listener) {
        this.on_type('del', listener)
    }
}

// -----------------------------------------------------------------------------
// -----------------------------------------------------------------------------


let base_gx_descriptor = {
    tag:'div',
    class:'',
    html:'',
    child_view:{},
    elms:{},
    click:function(){}
}

function fill_base_gx_desc(descriptor) {
    return merge_object(base_gx_descriptor, descriptor)
}
// -----------------------------------------------------------------------------
// -----------------------------------------------------------------------------

export class CNP_GX {

    async connect_data(data) {

        let me = this

        this.data = data

        this.childs = {}
        this.childs_gx = $('<div>').addClass('childs')
        this.gx.append(this.childs_gx)

        this.data.on_link_child(async function(link_id) {
            let child_data = await CNP_DATA_factory(me.data.desc.childs,link_id)
            let child_gx = new CNP_GX(me.desc.child_view)
            child_gx.connect_data(child_data)
            child_gx.parent = me
            me.childs[link_id] = child_gx
            me.childs_gx.append(child_gx.gx)
        })
        this.data.on_set(function(value) {
            if(value == null) {
                me.value_gx.html('')
            } else {
                me.value_gx.html(value)
            }
        })
        this.data.on_del(function() {
            me.gx.remove()
        })

        for(let elm_id in this.elms) {
            if(elm_id in this.data.props) {
                this.elms[elm_id].connect_data(this.data.props[elm_id])
            }
        }
    }

    constructor(descriptor) {

        this.desc = fill_base_gx_desc(descriptor)

        this.gx = $('<'+this.desc.tag+'>').addClass(this.desc.class).html(this.desc.html)
        this.value_gx = $('<div>').addClass('value')
        this.elms_gx = $('<div>').addClass('elms')
        this.gx.append(this.value_gx).append(this.elms_gx)

        this.elms = {}

        let me = this

        for(let id in me.desc.elms) {
            let desc = me.desc.elms[id]
            if(!('class' in desc)) {
                desc.class = id
            } else {
                desc.class += ' '+id
            }
            let elm_gx = new CNP_GX(desc)
            elm_gx.parent = me
            me.elms[id] = elm_gx
            me.elms_gx.append(elm_gx.gx)
        }

        this.gx.click(function() {
            me.desc.click.call(me)
        })
    }

}
// ---------------------------------------------

CNP_GX.MDL = {}
CNP_GX.MDL.button = function(icon,click=function(){}, type='fab', more_class='') {
    let button_desc = {
        tag:'div',
        class:'mdl-button mdl-js-button mdl-button--'+type+' mdl-js-ripple-effect '+more_class,
        child_view:{},
        elms:{
            'icon': {
                tag:'i',
                class:'material-icons',
                html:icon
            }
        },
        click:click
    }
    return button_desc
}
