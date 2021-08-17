class Radial {

    /*global Radial variables and functions*/
    static containers = [];
    static scopes = {};
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
            "eqs":(variable,equals_value,a,b)=>{
                if(variable == equals_value){
                    return a;
                }
                return b
            },
            "==":(variable,equals_value,a,b)=>{
                if(variable == equals_value){
                    return a;
                }
                return b
            },
            "not_empty":(list)=>{
                return list.length > 0;
            },
            "local":{
                index:-1
            }
        };
        let scope = {...default_scope};
        Radial.scopes[name] = scope;
        func(Radial.scopes[name]);
    }
    static GetCurrent = class {
        constructor(scope,var_name){
            this.scope = scope;
            this.var_name = var_name;
        }
        get(){
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
        this.local_scopes=new Set();
        Radial.containers.push(this);
        // this.observe();
    }

    interpret_object_string(object_string,custom_vars=[],custom_obj={}){
        object_string = object_string.trim();
        const dot_split = object_string.split(".");
        if(dot_split.length == 0) return;
        let first = dot_split[0];
        let scope = this.scope;
        if(custom_vars.includes(first)) scope = scope.local;
        if(first in custom_obj) scope = custom_obj;
        for(let i = 0; i < dot_split.length-1; i++){
            scope = scope[dot_split[i]];
        }
        return {scope:scope,var_name:dot_split[dot_split.length-1]};
    }

    get_var_expression(expression_inside,custom_vars=[],custom_obj={}){
        expression_inside = expression_inside.trim();
        let scope = this.scope;
        let obj_string = this.interpret_object_string(expression_inside,custom_vars,custom_obj);
        //if(custom_vars.includes(expression_inside)) scope = scope.local;
        const get_current = new Radial.GetCurrent(obj_string.scope,obj_string.var_name);
        return get_current;
    }

    get_func_expression(arguments_string,custom_vars=[],custom_obj={}){
        arguments_string = arguments_string.trim();
        // const split_reg = /(?:[^\s"]+|"[^"]*")+/g;
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
                    let obj_string = this.interpret_object_string(string,custom_vars,custom_obj);
                    return (new Radial.GetCurrent(obj_string.scope,obj_string.var_name));
                }
            }
            let obj_string = this.interpret_object_string(string,custom_vars,custom_obj);
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

    create_new_expression(element,found_in,attribute_name=undefined){
        this.unique_expression_id++;
        this.expressions[this.unique_expression_id] = {
            element:element,
            found_in:found_in,
        };
        let func;
        if(attribute_name != undefined){
            this.expressions[this.unique_expression_id].attribute_name = attribute_name;
            switch (attribute_name){
                case "loop":
                    this.unique_local_id++;
                    this.local_scopes.add(this.unique_local_id);
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
            func = this.get_expression_func(element.innerText);
        }
        // func = (found_in == "attribute") ? this.get_expression_func(element.getAttribute(attribute_name)) : this.get_expression_func(element.innerText) ;
        this.expressions[this.unique_expression_id].func = func;
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

    search_for_expressions(element){

        for(let i = 0; i < element.attributes.length; i++){
            let attribute = element.attributes[i];
            if(attribute.name.length >= 4 && attribute.name.slice(0,2) == this.bind_markers.opener && attribute.name.slice(attribute.name.length-2,attribute.name.length) == this.bind_markers.closer){
                this.handle_event_binds(element,attribute.name);
            }
            if(this.string_includes_expression(attribute.value,this.var_markers)){
                this.create_new_expression(element,"attribute",attribute.name);
            }else if(this.string_includes_expression(attribute.value,this.func_markers)){
                this.create_new_expression(element,"attribute",attribute.name);
            }
        }

        if(element.children.length == 0){
            if(this.string_includes_expression(element.innerText,this.var_markers)){
                this.create_new_expression(element,"text");
            }else if(this.string_includes_expression(element.innerText,this.func_markers)){
                this.create_new_expression(element,"text");
            }
        }else{
            if(this.string_includes_expression(this.get_inner_text(element),this.var_markers)){
                throw Error("inside expressions only allowed within elements with NO children");
            }else if(this.string_includes_expression(this.get_inner_text(element),this.func_markers)){
                throw Error("inside expressions only allowed within elements with NO children");
            }
        }
    }

    get_expression_func(text,custom_vars=[]){

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
                        const var_getter = this.get_var_expression(expression,custom_vars);
                        return var_getter.get();
                    };
                case "func":
                    return ()=>{
                        const args = this.get_func_expression(expression,custom_vars);
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

        const get_template_html = ()=>{
            if(element.content.firstElementChild == undefined) throw Error("loop template element must include child element");
            let inner = element.content.firstElementChild.innerHTML;
            let tag_name = element.content.firstElementChild.nodeName.toLowerCase();
            let attributes = [];
            for(let i = 0; i < element.content.firstElementChild.attributes.length; i++){
                let attr = element.content.firstElementChild.attributes[i];
                if(attr.value){
                    attributes.push(`${attr.name}="${attr.value}"`);
                }else{
                    attributes.push(attr.name);
                }
            }
            return {inner:inner,attributes:attributes.join(" "),tag:tag_name};
        };

        const custom_var = element.getAttribute("loop-var");
        if(custom_var == undefined) throw Error("radial loops require a loop-var attribute with desired loop variable name");
        if(custom_var.length == 0) throw Error("loop-var attribute must be filled");
        const template_html = get_template_html();
        const get_element_inner_func = this.get_expression_func(template_html.inner,[custom_var,"index"]);
        const get_element_attribute_func = this.get_expression_func(template_html.attributes,[custom_var,"index"]);

        let get_list = ()=>{this.scope.local[id] = [];};

        let no_markers = text.slice(2,text.length-2);
        if(text.slice(0,2) == this.var_markers.opener && text.slice(text.length-2,text.length) == this.var_markers.closer){
            get_list = ()=>{
                this.scope.local[id] = this.get_var_expression(no_markers,[custom_var,"index"]).get();
            };
        }
        if(text.slice(0,2) == this.func_markers.opener && text.slice(text.length-2,text.length) == this.func_markers.closer){
            get_list = ()=>{
                const args = this.get_func_expression(no_markers,[custom_var,"index"]);
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

            let old_elements = document.querySelectorAll(`.radial_loop_${custom_var}`);
            for(let old of old_elements){
                old.remove();
            }

            const split_lr = (string, char)=>{
                let left = "";
                let right = "";
                let onleft = true;
                for(let i = 0; i < string.length; i++){
                    if(string[i] == char && onleft){
                        onleft=false;
                    }else{
                        if(onleft)left+=string[i];
                        if(!onleft)right+=string[i];
                    }
                }
                return {left:left,right:right};
            };

            let elements_list = [];

            for(let i = 0; i < this.scope.local[id].length; i++){
                this.scope.local[custom_var] = this.scope.local[id][i];
                this.scope.local["index"] = i;
                let new_element = document.createElement(template_html.tag);
                let attributes = get_element_attribute_func();
                let splits = attributes.match(/(?:[^\s"]+|"[^"]*")+/g);
                if(splits == undefined) splits=[];
                for(let split of splits){
                    let name_value = split_lr(split,"=");
                    if(name_value.right[0] == '"' && name_value.right[name_value.right.length-1] == '"') name_value.right = name_value.right.slice(1,name_value.right.length-1);
                    if(name_value.left.length >= 4 && name_value.left.slice(0,2) == this.bind_markers.opener && name_value.left.slice(name_value.left.length-2,name_value.left.length) == this.bind_markers.closer){
                        this.handle_event_binds(new_element,name_value.left,[custom_var],{index:i});
                        continue;
                    }
                    new_element.setAttribute(name_value.left,name_value.right);
                }
                // new_element.outerHTML = `<${template_html.tag} ${attributes}>${get_element_inner_func()}</${template_html.tag}>`;
                new_element.classList.add(`radial_loop_${custom_var}`);
                new_element.innerHTML = get_element_inner_func();
                this.handle_events(new_element);
                elements_list.push(new_element);
            }

            element.after(...elements_list);

        }

    }

    get_if_func(element,expression,custom_vars=[],custom_obj={}){
        let normal_display = element.style.display ?? "block";
        if(normal_display == "none") normal_display = "block";
        let no_markers = expression.slice(2,expression.length-2);
        let get_bool = ()=>{
            return this.get_var_expression(no_markers,custom_vars,custom_obj).get();
        };
        if(expression.slice(0,2) == this.func_markers.opener && expression.slice(expression.length-2,expression.length) == this.func_markers.closer){
            const args = this.get_func_expression(no_markers,custom_vars,custom_obj)
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

    handle_var_binds(element){
        const allowed = ["TEXTAREA","INPUT","SELECT"];
        const change_event_type = {
            "TEXTAREA":"input",
            "INPUT":"input",
            "SELECT":"change"
        };
        const get_value = {
            "TEXTAREA":(element)=>element.value,
            "INPUT":(element)=>element.value,
            "SELECT":(element)=>element.options[element.selectedIndex].text,
        }
        if(allowed.includes(element.nodeName) && element.getAttribute("bind-var") != undefined){
            let binded_var = element.getAttribute("bind-var");
            element.value = this.scope[binded_var];
            element.addEventListener(change_event_type[element.nodeName],()=>{
                let val = get_value[element.nodeName](element);
                this.scope[binded_var] = val;
                this.run_expressions();
            });
        }
    }

    handle_event_binds(element,expression,custom_vars=[],custom_obj={}){
        expression = expression.slice(2,expression.length-2);
        const args = this.get_func_expression(expression,custom_vars,custom_obj);
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

    search_for_expressions_recursive(element){
        if(!(element instanceof HTMLElement)) return;
        this.search_for_expressions(element);
        this.handle_var_binds(element);
        // this.observe_attrs(element);
        if(element.children.length > 0){
            for(let child of element.children){
                this.search_for_expressions_recursive(child);
            }
        }
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
            if(this.expressions[id] != undefined){
                yield this.expressions[id];
            }
            id++;
        }
    }

    run_expressions(){
        for(let expression of this.loop_expressions()){
            let result;
            switch (expression.found_in){
                case "attribute":
                    result = expression.func();
                    if(expression.attribute_name != "loop"){
                        expression.element.setAttribute(expression.attribute_name,result);
                    }
                    break;
                case "text":
                    result = expression.func();
                    expression.element.innerText = result;
                    break;
            }
        }
    }

}

customElements.define("rad-ial",class RadialElement extends HTMLElement {
    constructor(){
        super();
    }
    set_scope(){
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
        this.removeAttribute("scope");
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
});