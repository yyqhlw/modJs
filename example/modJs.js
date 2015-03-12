;(function(win, doc){

    /*
        配置信息缓存
     */
    var c = {
        callback:{},
        isCache: false,
        isDebug : true,
        modConfig:{},
        //缓存前缀
        cachePrefix : ''
    }

    //工具函数
    function isType(type){
        return function(obj){
            return Object.prototype.toString.call(obj).toLowerCase() == "[object "+type.toLowerCase()+"]";
        };
    }

    var isFunction = isType("function");
    var isObject = isType("object");
    var isString = isType("string");
    var isNumber = isType("number");
    var isArray = isType("array");

    //加载的模块信息缓存于此
    var MODULES = {};
    var W3C = document.dispatchEvent;
    //from seajs
    var DEPS_RE = /"(?:\\"|[^"])*"|'(?:\\'|[^'])*'|\/\*[\S\s]*?\*\/|\/(?:\\\/|[^\/\r\n])+\/(?=[^\/])|\/\/.*|\.\s*require|(?:^|[^$])\brequire\s*\(\s*(["'])(.+?)\1\s*\)/g;
    var HEAD = doc.getElementsByTagName("head")[0];
    var READY_STATE_RE = /^(?:loaded|complete|undefined)$/;
    var method = W3C ? "onload" : "onreadystatechange";
    var TYPE_RE = /\.(\w+)$/;
    var TEST_URL_RE = /http|https/;
    var LAST_CHAR = /\/$/;
    var FIRST_RE = /\.\//;
      
    var STATUS = {
        INIT:1,
        LOADING:2,
        LOADED:3,
        COMPLATE:4
    };
    
    /*
        debug模式下打印错误消息
        msg : [String, 要打印的消息]
     */
    var log = function(msg){
        if(getConfig('isDebug')){
            if(console){
                console.log(msg); 
            }else{
                alert(msg);
            }
        }
    }

    /*
        获取配置信息
        key :[String, 要获取的key值]
     */
    function getConfig(key){
        return c[key];
    }

    /*
        获取模块版本信息
     */
    function getVersion(name){
        var v = getConfig('modConfig')[name].version;
        var v1 = getConfig('version');

        return v || v1;
    }
    

    /*
        获取模块的配置信息
        name : [String, 模块名称]
     */
    function getModConfig(name){
        var configs = getConfig('modConfig');
        var modConfig = configs[name] || {};
        return modConfig;
    }
    
    /*
        检查循环依赖，避免限于死循环
        mod  : [Module , 要检查的模块实例]
        deps : [Array , 依赖模块名称数组]  
     */
    function checkCycle(mod, deps){
        
        var  parent, bln = false;
        if(!deps.length){
            return bln;
        }
        parent = mod.parent;
        for(var j=0;j<parent.length;j++){
            for(var i =0,len=deps.length;i<len;i++){
                if(parent[j].name == deps[i]){
                  bln=parent[j].name;
                }
            }
            if(bln){
              return bln;
            }else{
                bln = checkCycle(parent[j],deps);
            }
        }
        return bln;
    }
    
    
     
     /*
        触发回调
        name :[String, 模块名称]
      */
    function fireCallback(name){
        var aCall =c.callback[name],i=0, mod = getMod(name);
        if(aCall && aCall.length && mod){
            for(;i<aCall.length;i++){
                aCall.splice(i, 1)[0](mod.exec());
            }
            
        }
    }
     
     /*
        检查模块是否有回调函数
        name : [String, 模块名称]
      */
    function hasCallback(name){
        if(c.callback[name] && c.callback[name].length){
            return true;
        }
        return false;
    }

    var ajax = function(option){
        option = option || {};
        var type = option.type || 'get';
        var url = option.url || '';
        var success = option.success || function(){};
        var XMLHttp = new XMLHttpRequest();
        XMLHttp.onreadystatechange = function(){
            if(XMLHttp.readyState == 4){ 
                if(XMLHttp.status == 200){
                    var result = XMLHttp.responseText;  
                    if(result){
                        success(result);
                    }
                }else if(XMLHttp.status == 404){
                    log('找不到文件');
                } 
                
            }  
        }
        XMLHttp.open(type, url, true);
        XMLHttp.send(null);
    }

    /*
        加载模块或模版使用的静态类
     */
    function Loader(){

    }
    /*
        加载js文件
     */
    Loader['js'] = function (name, path){
        if(!path){
            return false;
        }
        var script = doc.createElement("script");
        script.src = path+'?t='+(getVersion(name));
        HEAD.appendChild(script);

        script.setAttribute('mid', name);
        script.setAttribute('mtype', 'modjs');
        
        script[method] = function(e){
            if (READY_STATE_RE.test(script.readyState)) {
              script.onload = script.onerror = script.onreadystatechange = null;
              //HEAD.removeChild(script);
              script = null;
            }
        };

        script.onerror = function(e){
            log(name+'模块加载错误');
        }
        
        return script;
    }
    /*
        加载html模版文件
     */
    Loader['html'] = Loader['htm'] = function(name, path){

        if(!name || !path){
            log('加载的模版没有配置路径地址');
            return;
        }

        ajax({
            type:'get',
            url:path+'?t='+getVersion(name),
            success:function(data){

                var mod = getMod(name);
                var modConfig = getModConfig(name);

                var m = {
                    name:name,
                    cache:modConfig.cache,
                    data:data,
                    version:getVersion(name)
                }
                
                mod.setUp(m);
                mod.onload();
            }
        })
    }

    /*
        根据模块名称，获取缓存的模块, 如果没有则新建一个并返回
        name   : [String, 模块名称]
        return : [Object, 模块实例]
     */
    function getMod(name){
        return MODULES[name] || (MODULES[name] = new Module(name));
    }


    /*
        解析模块路径信息
     */
    function getModInfo(url){
        var info = {};
        if(!url) return info;
        info.type = (url.match(TYPE_RE) && url.match(TYPE_RE)[1]) || 'js';
        if(TEST_URL_RE.test(url)){
            info.url = url;
            infor.id = url;
            return info;
        }
        url = url.replace(FIRST_RE,'').replace(TEST_URL_RE,'').replace(LAST_CHAR,'');
        if(url[0] == '/'){
            info.url = location.protocol+'//'+location.host+url+'.'+info.type;
            info.id = info.url;
            return info;
        }
        var base_url = c.base_url || location.protocol+'//'+location.host+location.pathname;
        var type = (url.match(TYPE_RE) &&url.match(TYPE_RE)[1]) || 'js';
        var base_arr = base_url.split('/');
        var url_arr = url.split('/');
        
        if(TYPE_RE.test(base_url)){
            base_arr.pop();
        }
        for(var i=0,len=url_arr.length;i<len;i++){
            if(url_arr[i] == '..'){
                base_arr.pop();
            }else if(url_arr[i] != '.'){
                base_arr.push(url_arr[i]);
            }
        }
        info.url = base_arr.join('/')+'.'+type;
        info.id = info.url;
        
        return info;

    }

    //获取本地缓存的模块信息
    function getLocalMod(name){
        var info = null;
        if(window.localStorage){
            try{
                info = JSON.parse(localStorage.getItem(''+getConfig('cachePrefix')+name));
            }catch(e){

            }
        }
        return info;
    }
    //从localstorage中清楚mod信息
    function clearLocalMod(mod){
        mod.localMod = null;
        localStorage.removeItem(''+getConfig('cachePrefix')+mod.name);
    }
    
  
    /*
    获取依赖的模块名称
    code   : [Function, 函数体]
     */
    function parseDependencies(code) {
      var ret = [];
      code.replace(DEPS_RE, function(m, m1, m2) {
            if (m2) {
              ret.push(m2);
            }
          });
      return ret;
    }

    /*
    缓存模块
     */
    function cacheMod(mod){
        var info={}
        try{

            if(mod.type == 'js'){
                info = {
                    version : mod.version,
                    data : mod.data.toString(),
                }
            }else{
                info = {
                    version : mod.version,
                    data : mod.data,
                }
            }

            localStorage.setItem(c.cachePrefix+mod.name, JSON.stringify(info))
        }catch(e){

        }
    }

    /*
        模块类
     */
    function Module(name){
        this.name = name;
        this.status = STATUS.INIT;
        this.deps = [];
        this.loadedDeps = [];
        this.exports = {};
        this._nw = 0;
        this.parent = [];
        this.isLocal = false;
        this.url  = getModConfig(name).path;
        this.type = getModInfo(this.url).type;

        if(!this.url){
            log(this.name+'模块没有配置');
        }
    }
    Module.prototype = {
        //加载模块
        load:function(){
            if(this.status == STATUS.INIT){
                
                Loader[this.type](this.name, this.url);
                this.status = STATUS.LOADING;
            }
        },
        //安装模块
        setUp:function(info){
            
            this.version = getVersion(this.name);
            this.cache = info.cache;
            this.data = info.data;
        },
        setStatus:function(status){
            this.status = status;
        },
        getStatus:function(){
            return this.status;
        },
        onload:function(){
            this.status = STATUS.LOADED;
            this.checkDeps();

            //本地存储模块
            if(c.isCache && this.cache && !this.isLocal){
                cacheMod(this);
            } 
        },
        setnw:function(name){

            if(this._nw == 0) return;
            this._nw--;
            this.loadedDeps.push(name)
            if(this._nw == 0){
                this.complete();
            }
        },

        checkDeps:function(){
            var self = this;
            //此处的作用是防止文件提前合并时，有多余的请求
            setTimeout(function(){
                if(self.type == 'js'){
                    self.setDeps();
                    var cycle = checkCycle(self, self.deps)
                    if(cycle !== false){
                        log(self.name+'和'+cycle+"模块存在循环依赖关系");
                        return;
                    }
                    if(self.deps.length){                
                        self.loadDeps();
                    }else{
                        self.complete();
                    }
                }else{
                    self.complete();
                }
            }, 0)
            
        },
        loadDeps:function(){
            var self = this;
            if(this.deps.length){
                for(var i=0;i<this.deps.length;i++){
                    var name = this.deps[i];
                    getMod(name).setParent(this);
                    modJs(name);
                }
            }else{
                this.complete();
            }
        },
        setParent:function(parent){
            this.parent.push(parent);
        },
        setDeps:function(){

            this.deps = parseDependencies(isFunction(this.data) ? this.data.toString() : this.data);
            this._nw = this.deps.length;

            return this.deps;
        },
        complete:function(){

            this.status = STATUS.COMPLATE;
            this.updateParent();
            this.doCallback();
        },
        isComplete:function(){
            return this.status === STATUS.COMPLATE;
        },
        updateParent:function(){
            
            if(this.parent.length){
                var i=0,len = this.parent.length;
                for(;i<len;i++){
                    if(this.parent[i].status!= STATUS.COMPLATE){

                        this.parent[i].setnw(this.name);
                    }
                }
            }
       
        },
        exec:function(){

            var exports = {}, module = this;

            if(this.cacheData){
                return this.cacheData;
            }else{
                if(this.type == 'js'){

                    if(this.isLocal){
                        this.data = eval('('+this.data+')');
                    }

                    if(isFunction(this.data)){
                        this.cacheData = this.data(require, this.exports = {} ,this);
                    }else{
                        this.cacheData = this.data;
                    }
                    
                    
                }else{
                    this.cacheData = this.data;
                }
                return this.cacheData;
            }
        },
        doCallback:function(){
            fireCallback(this.name);
        },
        /*
            为模块添加回调函数
            name : [String, 模块名称]
            fn   : [Function, 回调函数]
         */
        addCallback:function (fn){

            var aCall = c.callback[this.name];
            if(aCall) {
                aCall.push(fn);
            }else{
                c.callback[this.name] = [fn];
            }
        }
    };
    
    function require(name){
        if(!name){
            return null;
        }
        var mod = getMod(name);
        return mod.exec();

    }
    
    /*
        模块声明
        name : [String , 模块名称]
        fn   : [Function, 模块主体]
     */
    function define(name, data){
        
        if(!name){
            log('有一个模块定义的时候没有name属性');
        }
        
        var m = getMod(name);
        if(m.getStatus == STATUS.LOADED){
            log('重复定义模块:' +name);
            return;
        }

        var info = getModConfig(name);
        info.data = data;
        m.setUp(info);
        m.onload();
    }

      /*
     入口方法
     name     : [String , 要使用的模块名称]
     callback : [Function, 模块及所有依赖模块加载完成后调用的回调函数]
     */
    function use(name, callback){
        var m = getMod(name);
            callback && m.addCallback(callback);

        if(m.isComplete()){
            m.complete();
            return;
        }

        if(m.getStatus() === 1){
            var localInfo = getLocalMod(name), modConfig = getModConfig(name);
            if(localInfo && (localInfo.version === getVersion(name)) && (c.isCache && modConfig.cache)){
                m.isLocal = true;
                define(name, localInfo.data);               
            }else{

                clearLocalMod(m);
                m.load();
            }
        }
    }

    /*
        配置函数
        obj.isCache : 是否开启模块本地缓存, 缓存机制为localstorage, 如果应用体积过大，慎用
        obj.isDebug : 是否开始调试模式
        obj.modConfig : 模块配置
        obj.version : 版本控制
        
        例子:
        modJs.config({
            isDebug: true,
            isCache: false,
            version : '1.0.0'
            modConfig : {
                zepto:{
                    path:"modJs/libs/zepto.js",
                    version : '1.0.0'
                    cache : false
                },
                Controller:{
                    path:'modJs/app/Controller.js',
                    version : '1.0.0'
                    cache : true,
                }
             
            }
        })
     */
    use.config = function(obj){
        obj = obj || {};
        for(var key in obj){
            c[key] = obj[key];
        }
    };

    /*
        本地调试，配合console.log使用，替换线上的模块
        name : [String , 要替换的模块名称]
        url  : [String , 新的模块路径，一般为本地路径]
     */
    use.replaceMod = function(name, url){
        delete MODULES[name];
        var mod = (MODULES[name] = new Module(name));
            mod.url = url;
    }

    win.define = define;
    define.cmd = {};
    win.modJs = use;

})(window, document, undefined)