class Radial {

    /*global Radial variables and functions*/
    static containers = [];
    static scopes = {};
    static scope_names = [];
    static create_scope(name,func){
        const default_scope = {
            "+":(...numbers)=>{
                let total = 0;
                for(let number of numbers){
                    total += number;
                }
                return total;
            },
            "*":(...numbers)=>{
                let total = 1;
                for(let number of numbers){
                    total *= number;
                }
                return total;
            },
            "-":(...numbers)=>{
                let total = numbers[0] ?? 0;
                numbers = numbers.slice(1);
                for(let number of numbers){
                    total -= number;
                }
                return total;
            },
            "/":(...numbers)=>{
                let total = numbers[0] ?? 0;
                numbers = numbers.slice(1);
                for(let number of numbers){
                    total /= number;
                }
                return total;
            },
            "concat":(...strings)=>{
                let result = "";
                for(let string of strings){
                    result += string;
                }
                return result;
            },
            "obj":(obj,...keys)=>{
                for(let i = 0; i < keys.length; i++){
                    obj = obj[keys[i]];
                }
                return obj;
            },
            "get_target":(event,func,...args)=>{
                func(event.target,...args);
            },
            "range":(start,end)=>{
                const arr = new Array(end-start);
                for(let i = 0; i < arr.length; i++){
                    arr[i] = start+i;
                }
                return arr;
            },
            "%":(a,b) => a % b,
            "ternary":(bool,a,b)=>{
                return (bool) ? a : b;
            },
            "?":(bool,a,b)=>{
                return (bool) ? a : b;
            },
            "switch":(variable,equals_value,a,b)=>{
                if(variable == equals_value){
                    return a;
                }
                return b
            },
            "eqs":(a,b)=>{
                return a == b;
            },
            "==":(a,b)=>{
                return a == b;
            },
            "===":(a,b)=>{
                return a === b;
            },
            "neqs":(a,b)=>{
                return a != b;
            },
            "!=":(a,b)=>{
                return a != b;
            },
            "!==":(a,b)=>{
                return a !== b;
            },
            "not_empty":(list)=>{
                return list.length > 0;
            },
            ">":(a,b)=>{
                return a > b;
            },
            "<":(a,b)=>{
                return a < b;
            },
            ">=":(a,b)=>{
                return a >= b;
            },
            "<=":(a,b)=>{
                return a <= b;
            },
            "clean":(raw_html)=>{
                if(!raw_html) return "";
                raw_html = raw_html.replaceAll("<","&lt;").replaceAll(">","&gt;");
                return raw_html;
            },
            "local":{
                index:-1
            }
        };
        let scope = {...default_scope};
        Radial.scopes[name] = scope;
        Radial.scope_names.push(name);
        func(Radial.scopes[name]);
    }
    static GetCurrent = class {
        constructor(scope,var_name){
            this.scope = scope;
            this.var_name = var_name;
        }
        get(){
            if(this.scope == null) return undefined;
            return this.scope[this.var_name];
        }
    };

    /*class instance variable and functions*/
    constructor(element,scope,var_markers={opener:"{{",closer:"}}"},func_markers={opener:"((",closer:"))"},bind_markers={opener:"[[",closer:"]]"}){
        this.container = element;
        this.var_markers = var_markers;
        this.func_markers = func_markers;
        this.bind_markers = bind_markers;
        this.scope = scope;
        this.expressions = {};
        this.unique_expression_id = -1;
        this.unique_local_id = -1;
        Radial.containers.push(this);
    }

    add_local_vars(new_vars){
        for(let variable of new_vars){
            if(!this.is_local_var(variable)) this.scope.local[variable] = null;
        }
    }

    remove_local_vars(old_vars){
        for(let variable of old_vars){
            this.scope.local[variable] = undefined;
        }
    }

    is_local_var(var_name){
        return !(this.scope.local[var_name] === undefined);
    }

    interpret_object_string(object_string,custom_obj={}){
        const undefined_obj = {scope:{"undefined":undefined},var_name:"undefined"};
        object_string = object_string.trim();
        const dot_split = object_string.split(".");
        if(dot_split.length == 0) return;
        let first = dot_split[0];
        let scope = this.scope;
        if(this.is_local_var(first)) scope = scope.local;
        if(first in custom_obj) scope = custom_obj;
        for(let i = 0; i < dot_split.length-1; i++){
            if(scope == null || !(dot_split[i] in scope)) return undefined_obj;
            scope = scope[dot_split[i]];
        }
        return {scope:scope,var_name:dot_split[dot_split.length-1]};
    }

    get_var_expression(expression_inside,custom_obj={}){
        expression_inside = expression_inside.trim();
        let scope = this.scope;
        let obj_string = this.interpret_object_string(expression_inside,custom_obj);
        const get_current = new Radial.GetCurrent(obj_string.scope,obj_string.var_name);
        return get_current;
    }

    get_func_expression(arguments_string,custom_obj={}){
        arguments_string = arguments_string.trim();
        const split_reg = /('[^']+'|[^,]+)/g;
        const split = arguments_string.match(split_reg);
        const get_value_from_string = (string)=>{
            string = string.trim();
            if(string in custom_obj) return custom_obj[string];
            if(string.length == 0) return undefined;
            if(string == "false") return false;
            if(string == "true") return true;
            if(string == "undefined" || string == "null") return undefined;
            if(string.length >= 2 && ((string[0] == "'" && string[string.length-1] == "'" ) || (string[0] == '"' && string[string.length-1] == '"' ))) return string.slice(1,string.length-1);
            if(!isNaN(+string)) return +string;
            if(string.length >= 2 && string[0] == "{" && string[string.length-1] == "}"){
                try {
                    const json = JSON.parse(string);
                    return json;
                } catch(e){
                    let obj_string = this.interpret_object_string(string,custom_obj);
                    return (new Radial.GetCurrent(obj_string.scope,obj_string.var_name));
                }
            }
            let obj_string = this.interpret_object_string(string,custom_obj);
            return (new Radial.GetCurrent(obj_string.scope,obj_string.var_name));
        };
        const return_arguments = split.map((value)=>get_value_from_string(value));
        return return_arguments;
    }

    on_removed(removed_elements){
        for(let removed of removed_elements){
            for(let expression of this.loop_expressions()){
                if(expression.element == removed || removed.contains(expression.element)){
                    expression = undefined;
                }
            }
        }
    }

    create_new_expression(element,found_in,save_to_scope,attribute_name=undefined){
        let exp = {element:element,found_in:found_in};
        let func;
        if(attribute_name != undefined){
            exp.attribute_name = attribute_name;
            switch (attribute_name){
                case "loop":
                    this.unique_local_id++;
                    element.setAttribute("rad-id",this.unique_local_id);
                    this.scope.local[this.unique_local_id] = [];
                    func = this.get_loop_func(element.getAttribute(attribute_name),this.unique_local_id,element);
                    break;
                case "rad-if":
                    func = this.get_if_func(element,element.getAttribute(attribute_name));
                    break;
                default:
                    func = this.get_expression_func(element.getAttribute(attribute_name));
                    break;
            }
        }else{
            func = this.get_expression_func(element.innerHTML);
        }
        exp.func = func;
        if(save_to_scope){
            this.unique_expression_id++;
            this.expressions[this.unique_expression_id] = exp;
            return;
        }
        return exp;
    }

    create_bind_expression(element,save_to_scope=true){
        let exp = {
            element:element,
            found_in:"bind",
            func:()=>{
                let binded_var = element.getAttribute("bind-var");
                element.value = this.scope[binded_var];
            }
        };
        if(save_to_scope){
            this.unique_expression_id++;
            this.expressions[this.unique_expression_id] = exp;
            return;
        }
        return exp;
    }

    get_inner_text(element){
        return [].reduce.call(element.childNodes, function(a, b) { return a + (b.nodeType === 3 ? b.textContent : ''); }, '');
    }

    string_includes_expression(string,markers){
        const opener_index = string.indexOf(markers.opener);
        const closer_index = string.indexOf(markers.closer);
        if(opener_index > -1 && closer_index > opener_index) return true;
        return false;
    };

    search_for_expressions(element,save_to_scope=true){

        let exps = [];

        for(let i = 0; i < element.attributes.length; i++){
            let attribute = element.attributes[i];
            if(attribute.name.length >= 4 && attribute.name.slice(0,2) == this.bind_markers.opener && attribute.name.slice(attribute.name.length-2,attribute.name.length) == this.bind_markers.closer){
                this.handle_event_binds(element,attribute.name);
            }
            if(this.string_includes_expression(attribute.value,this.var_markers)){
                let exp = this.create_new_expression(element,"attribute",save_to_scope,attribute.name);
                if(exp != undefined)exps.push(exp);
            }else if(this.string_includes_expression(attribute.value,this.func_markers)){
                let exp = this.create_new_expression(element,"attribute",save_to_scope,attribute.name);
                if(exp != undefined)exps.push(exp);
            }
        }

        if(element.children.length == 0){
            if(element.nodeName != "TEMPLATE"){
                if(this.string_includes_expression(element.innerHTML,this.var_markers)){
                    let exp = this.create_new_expression(element,"text",save_to_scope);
                    if(exp != undefined)exps.push(exp);
                }else if(this.string_includes_expression(element.innerHTML,this.func_markers)){
                    let exp = this.create_new_expression(element,"text",save_to_scope);
                    if(exp != undefined)exps.push(exp);
                }
            }
        }else{
            if(this.string_includes_expression(this.get_inner_text(element),this.var_markers)){
                throw Error("inside expressions only allowed within elements with NO children");
            }else if(this.string_includes_expression(this.get_inner_text(element),this.func_markers)){
                throw Error("inside expressions only allowed within elements with NO children");
            }
        }

        if(!save_to_scope)return exps;
    }

    get_expression_func(text,custom_obj={}){

        const strings = [];
        let mode = "open";
        let type = "var";
        let markers = "var_markers";
        let current = "";
        let depth = 0;
        let depth_type = "";
        let last = "";

        const push_current = ()=>{
            strings.push(current);
            current = "";
        };

        const depth_handler = (text)=>{
            switch (depth){
                case 0:
                    if((text == "\"" || text == "'")){
                        depth = 1;
                        depth_type = text;
                    }
                    break;
                case 1:
                    if(last != "\\" && text == depth_type){
                        depth = 0;
                    }
                    break;
            }
            last = text;
        };

        const copy_current = ()=>{
            const copy = current;
            return copy;
        }

        const get_expression_func = (expression)=>{
            switch (type){
                case "var":
                    return ()=>{
                        const var_getter = this.get_var_expression(expression,custom_obj);
                        return var_getter.get();
                    };
                case "func":
                    return ()=>{
                        const args = this.get_func_expression(expression,custom_obj);
                        const func_name = args[0].get();
                        const func_args = args.slice(1);
                        for(let i = 0; i < func_args.length; i++){
                            if(func_args[i] instanceof Radial.GetCurrent){
                                func_args[i] = func_args[i].get();
                            }
                        }
                        let result = "";
                        if(typeof func_name == "function") result = func_name(...func_args);
                        return result;
                    };
            }
        }

        for(let i = 0; i < text.length; i++){
            switch (mode){
                case "open":
                    if(text.slice(i,i+2) == this.var_markers.opener){
                        mode = "close";
                        type = "var";
                        markers = "var_markers";
                        push_current();
                        i += 1;
                    }else if(text.slice(i,i+2) == this.func_markers.opener){
                        mode = "close";
                        type = "func";
                        markers = "func_markers";
                        push_current();
                        i += 1;
                        depth = 0;
                    }else{
                        current += text[i];
                    }
                    break;
                case "close":
                    if(text.slice(i,i+2) == this[markers].closer && depth == 0){
                        mode = "open";
                        depth = 0;
                        strings.push(get_expression_func(copy_current()));
                        i += 1;
                        current = "";
                    }else{
                        if(text[i] == "\\"){
                            if(last == "\\") current += text[i];
                        }else{
                            current += text[i];
                        }
                        depth_handler(text[i]);
                    }
            }
        }
        push_current();

        const get_overall_func = ()=>{
            return function(element,attribute=undefined){
                let result = "";
                for(let string of strings){
                    if(typeof string === "function"){
                        result += string();
                    }else{
                        result += string;
                    }
                }
                return result;
            };
        };

        return get_overall_func();

    }

    get_loop_func(text,id,element){

        if(element.nodeName !== "TEMPLATE") throw Error("radial loops only allowed on template elements");

        const custom_var = element.getAttribute("loop-var");
        if(custom_var == undefined) throw Error("radial loops require a loop-var attribute with desired loop variable name");
        if(custom_var.length == 0) throw Error("loop-var attribute must be filled");

        this.add_local_vars([custom_var,"index"]);

        let get_list = ()=>{this.scope.local[id] = [];};

        let no_markers = text.slice(2,text.length-2);
        if(text.slice(0,2) == this.var_markers.opener && text.slice(text.length-2,text.length) == this.var_markers.closer){
            get_list = ()=>{
                this.scope.local[id] = this.get_var_expression(no_markers).get();
            };
        }
        if(text.slice(0,2) == this.func_markers.opener && text.slice(text.length-2,text.length) == this.func_markers.closer){
            get_list = ()=>{
                const args = this.get_func_expression(no_markers);
                const func_name = args[0].get();
                const func_args = args.slice(1);
                for(let i = 0; i < func_args.length; i++){
                    if(func_args[i] instanceof Radial.GetCurrent){
                        func_args[i] = func_args[i].get();
                    }
                }
                let result;
                if(typeof func_name == "function") result = func_name(...func_args);
                this.scope.local[id] = result;
            };
        }

        return ()=>{

            get_list();

            let old_elements = document.querySelectorAll(`[radial-loop='${custom_var}']`);
            for(let old of old_elements){
                old.remove();
            }

            let last_element = element;

            for(let i = 0; i < this.scope.local[id].length; i++){
                this.scope.local[custom_var] = this.scope.local[id][i];
                this.scope.local["index"] = i;
                let new_element = element.content.firstElementChild.cloneNode(true);
                new_element.setAttribute("radial-loop",custom_var);
                last_element.after(new_element);
                last_element = new_element;
                let exps = this.search_for_expressions_recursive(new_element,false);
                this.run_expression_list(exps);
            }

        }

    }

    get_if_func(element,expression,custom_obj={}){
        let normal_display = element.style.display ?? "block";
        if(normal_display == "none") normal_display = "block";
        let no_markers = expression.slice(2,expression.length-2);
        let get_bool = ()=>{
            return this.get_var_expression(no_markers,custom_obj).get();
        };
        if(expression.slice(0,2) == this.func_markers.opener && expression.slice(expression.length-2,expression.length) == this.func_markers.closer){
            const args = this.get_func_expression(no_markers,custom_obj);
            get_bool = ()=>{
                const main_func = args[0].get();
                const rest = args.slice(1);
                for(let i = 0; i < rest.length; i++){
                    if(rest[i] instanceof Radial.GetCurrent) rest[i] = rest[i].get();
                }
                return main_func(...rest);
            };
        }
        return ()=>{
            const result = get_bool();
            if(result){
                element.style.display = normal_display;
                return;
            }
            element.style.display = "none";
            return;
        }
    }

    handle_var_binds(element,save_to_scope=true){
        const allowed = ["TEXTAREA","INPUT","SELECT"];
        const change_event_type = {
            "TEXTAREA":"input",
            "INPUT":"input",
            "SELECT":"change"
        };
        const get_value = {
            "TEXTAREA":(element)=>element.value,
            "INPUT":(element)=>element.value,
            "SELECT":(element)=>element.value,
        };
        if(allowed.includes(element.nodeName) && element.getAttribute("bind-var") != undefined){
            let binded_var = element.getAttribute("bind-var");
            let exp = this.create_bind_expression(element,save_to_scope);
            element.addEventListener(change_event_type[element.nodeName],()=>{
                let val = get_value[element.nodeName](element);
                this.scope[binded_var] = val;
                this.run_expressions();
            });
            if(!save_to_scope) return exp;
        }
    }

    handle_event_binds(element,expression,custom_obj={}){
        expression = expression.slice(2,expression.length-2);
        const args = this.get_func_expression(expression,custom_obj);
        const event_name = (args[0] instanceof Radial.GetCurrent) ? args[0].var_name : String(args[0]);
        const event_func = args[1].get();
        const rest = args.slice(2);
        element.addEventListener(event_name,(event)=>{
            const now_args = rest.map((item)=>{
                if(item instanceof Radial.GetCurrent) return item.get();
                return item;
            });
            event_func(event,...now_args);
            this.run_expressions();
        });
    }

    handle_events(element){
        //basically just for loop created elements
        this.handle_var_binds(element);

        for(let i = 0; i < element.attributes.length; i++){
            let attribute = element.attributes[i];
            if(attribute.name.length >= 4 && attribute.name.slice(0,2) == this.bind_markers.opener && attribute.name.slice(attribute.name.length-2,attribute.name.length) == this.bind_markers.closer){
                this.handle_event_binds(element,attribute.name);
            }
        }

        if(element.children.length > 0){
            for(let child of element.children){
                this.handle_events(child);
            }
        }
    }

    search_for_expressions_recursive(element,save_to_scope=true){
        if(!(element instanceof HTMLElement)) return;
        let exps = [];
        let element_expressions = this.search_for_expressions(element,save_to_scope);
        if(!save_to_scope) exps = exps.concat(element_expressions);
        let bind_exp = this.handle_var_binds(element,save_to_scope);
        if(!save_to_scope && bind_exp != undefined)exps.push(bind_exp);
        if(element.children.length > 0 && element.nodeName != "TEMPLATE"){
            for(let child of element.children){
                let child_expressions = this.search_for_expressions_recursive(child,save_to_scope);
                if(!save_to_scope) exps = exps.concat(child_expressions);
            }
        }
        return exps;
    }

    on_added(added){
        for(let element of added){
            this.search_for_expressions_recursive(element);
        }
    }

    on_attr(element,attr){
        let attr_value = element.getAttribute(attr);
        if(this.string_includes_expression(attr_value,this.var_markers)){
            this.create_new_expression(element,"attribute",attr);
        }else if(this.string_includes_expression(attr_value,this.func_markers)){
            this.create_new_expression(element,"attribute",attr);
        }
    }

    observe(){
        const config = { attributes: true, childList: true, subtree: true };
        const callback = (mutations_list, observer) => {
            for(const mutation of mutations_list) {
                if (mutation.type === 'childList') {
                    this.on_removed(mutation.removedNodes);
                    this.on_added(mutation.addedNodes);
                }
            }
        };
        const observer = new MutationObserver(callback);
        observer.observe(this.container, config);
    }

    observe_attrs(element){
        const config = { attributes: true};
        const callback = (mutations_list, observer) => {
            for(const mutation of mutations_list) {
                if (mutation.type === 'attributes') {
                    this.on_attr(element,mutation.attributeName);
                }
            }
        };
        const observer = new MutationObserver(callback);
        observer.observe(element, config);
    }

    *loop_expressions(){
        let id = 0;
        while(id <= this.unique_expression_id){
            if(this.expressions[id] !== undefined){
                yield this.expressions[id];
            }
            id++;
        }
    }

    run_expression(expression){
        let result;
        switch (expression.found_in){
            case "attribute":
                result = expression.func();
                if(expression.attribute_name != "loop" && expression.attribute_name != "rad-if"){
                    expression.element.setAttribute(expression.attribute_name,result);
                }
                break;
            case "text":
                result = expression.func();
                expression.element.innerHTML = result;
                break;
            case "bind":
                expression.func();
                break;
        }
    }

    run_expressions(){
        for(let expression of this.loop_expressions()){
            this.run_expression(expression);
        }
    }

    run_expression_list(exp_list){
        for(let exp of exp_list){
            this.run_expression(exp);
        }
    }

}

customElements.define("rad-ial",class RadialElement extends HTMLElement {
    constructor(){
        super();
        this.already_set_scope = false;
    }
    set_scope(){
        if(this.already_set_scope)return;
        if(this.getAttribute("scope") == undefined) return;
        this.radial = new Radial(this,Radial.scopes[this.getAttribute("scope")]);
        Object.defineProperty(this.radial.scope, "reload", {
            value: ()=>{this.radial.run_expressions();},
            writable: false,
            enumerable: true,
            configurable: true
        });
        window.addEventListener("load",()=>{
            this.radial.search_for_expressions_recursive(this);
            this.radial.run_expressions();
        });
        this.already_set_scope = true;
    }
    connectedCallback(){
        this.set_scope();
    }
    attributeChangedCallback(attr,old_name,new_name){
        this.set_scope();
    }
    static get observedAttributes(){
        return ["scope"];
    }
    reload(){
        this.radial.run_expressions();
    }
});