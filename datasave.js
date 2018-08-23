

/*
* 以下为接受数据类：利用Promise将浏览器XMLHTTPResponse()类用法简单封装
*
* */
var Xhr = function( param ){
    //@url 资源的位置
    this.url = param.url
    //@method 为获取方法（GET、POST、HEAD etc）
    this.method = param.method;
    //@responseType 为获取数据类型（json,arraybuffer etc）
    this.responseType = param.responseType;
    //@xmlHttpResponse 一个XMLHttpRequest（）实例化对象
    //this.xmlHttpResponse = new XMLHttpRequest();
}


Xhr.prototype.getData = function () {
    var scope = this;
    return new Promise(function ( resolve, reject) {
        var xmlHttpResponse = new XMLHttpRequest();
        xmlHttpResponse.open( scope.method, scope.url ,true);
        if( scope.responseType !== undefined ) {
            xmlHttpResponse.responseType = scope.responseType;
        }
        xmlHttpResponse.send();

        //异步响应事件
        xmlHttpResponse.onreadystatechange = function () {
            if( xmlHttpResponse.readyState == XMLHttpRequest.DONE ){
                if( xmlHttpResponse.status == 200 ){
                    resolve( xmlHttpResponse.response );
                }
                else {
                    reject();
                }
            }
        }

        xmlHttpResponse.addEventListener("progress",function ( e ) {
            if( e.lengthComputable ){
                console.log( e.loaded );
            }
        })
    });
};

/*
*以上为接受数据类
*以下为url类：根据服务器地址、模型id、生成相关资源路径
 */
var Url = function (serverUrl, modelId,dbName) {
    //@serverUrl 服务器的地址
    //@modelId 模型id
    //@dbName 数据库名字
    this.serverUrl = serverUrl;
    this.modelId = modelId;
    this.dbName=dbName;
};

//@projectUrl() 获取项目信息的url
Url.prototype.projectUrl = function () {
    return this.serverUrl + "/api/"+this.dbName+"/models?modelKey="+this.modelId;
};

//@textureUrl() 获取文件（scene、component、material）的数据
Url.prototype.textureUrl = function (textureId) {
    return this.serverUrl + "/api/"+this.dbName+"/files?fileKey=" + textureId;
};

/*
* 以上为url类
* 以下是解析geometry、material的方法
* */

//@saveGeo 将几何arraybuffer 切片为小的arraybuffer
function saveGeo( DAT_data ) {
    
    var geomAmount = new Uint32Array(DAT_data, 0, 1);
    var geoData={};
    for(var j = 0; j < geomAmount; j++) {

        //用来缓存的几何对象
        var geom = [];
        //几何描述信息的偏移量（以字节为单位）
        var geomInforOffset = 4 * (1 + geomAmount * 6);
        //描述信息的数据（以字节为单位）
        var infors = new Uint32Array(DAT_data, 4 * (1 + j * 6), 6);

        var header=DAT_data.slice(4 * (1 + j * 6), 4 * (1 + j * 6)+24);

        //几何构件的ID
        var geoId = "geo_"+infors[0];
        //几何构件的偏移量（以字节为单位）
        var offset = infors[1];
        //顶点长度（以字节为单位）
        var vertexLength = infors[2];
        //法线长度（以字节为单位）
        var normalLength = infors[3];
        //索引长度（以字节为单位）
        var IndicesLength = infors[4];
        //材质长度（以字节为单位）
        var uvLength = infors[5];
        //      当前偏移量  = 描述信息偏移量  + 描述信息里提供的offset
        var currOffset = geomInforOffset + offset;
      //   var verticesData = new Float32Array(DAT_data.slice(currOffset, vertexLength * 4 + currOffset));
        //顶点偏移量（以字节为单位）     顶点长度（每个顶点数值4个字节）*4 + 当前偏移量
        var vertOffset = vertexLength * 4 + currOffset;
       //  var normalsData = new Float32Array(DAT_data.slice(vertOffset, vertOffset + normalLength * 4));
        //法线偏移量   = 顶点偏移量  + 法线个数（每个法线数值4个字节）*4
        var nomalOffset = vertOffset + normalLength * 4;
       //  var indicesData = new Int32Array(DAT_data.slice(nomalOffset, nomalOffset + IndicesLength * 4));
        //索引偏移量  = 法线偏移量  + 索引个数（每个索引数值4个字节）*4
        var indexOffset = nomalOffset + IndicesLength * 4;
        // var uvData = new Float32Array(DAT_data.slice(indexOffset, indexOffset + uvLength * 4));

        var body=DAT_data.slice(geomInforOffset + offset,indexOffset + uvLength * 4);

        geoData[geoId]={
            header:header,
            body:body
        };
    }
    return geoData;
}


//@saveMaterial 为从材质arraybuffer将各个材质buffer切片为小的材质arraybuffer
function saveMaterial( DAT_data ) {
    //字节数   单位数值的个数
    var compNum = new Uint32Array(DAT_data, 0, 1);
    //材质描述信息偏移量   字节为单位
    var materInforOffset = (1 + compNum * 6) * 4;
    var matData={};
    for(var i = 0; i < compNum; i++) {
        // var material = [];
        //4 代表4个字节 一个32位数值                                                                     从 1+i*6 个开始取 6 个32位数值
        var infors = new Uint32Array(DAT_data, 4 * (1 + i * 6), 6);
        var matId = "mat_"+infors[0];

        var header=DAT_data.slice(4 * (1 + i * 6), 4 * (1 + i * 6)+24);
        var inf = new Uint32Array(header);
        var offset = infors[1];
        var colorLength = infors[2];
        var colorIndexLength = infors[3];
        var materLength = infors[4];
        var materIndexLength = infors[5];

        var  materDataOffset  =  colorLength  *  4  +  materInforOffset  +  offset  +  colorIndexLength  *  2  +  materLength;
        var body=DAT_data.slice(materInforOffset + offset, materDataOffset  +  materIndexLength*2);

        matData[matId]={
            header:header,
            body:body
        };
    }
    return matData;
}

/*
*
* 以下为在同一浏览器打开不同模型时，即使更改indexeddb的版本，使用window.localstorage 保存indexecdb的版本以及数据仓库名
* */
function indexedConfig( config ) {
    var indexedDbName = "bos_3d";
    if( config.store.constructor !== Array ){
        config.store = [ config.store ];
    }
    if(window.localStorage[ indexedDbName ] === undefined ){
        window.localStorage[ indexedDbName ] = JSON.stringify( config );
    }else {
        var indexDbInfo = JSON.parse(window.localStorage[ indexedDbName ] );
        if ( indexDbInfo.store.indexOf( config.store[ 0 ] )== -1 ){
            config.version++;
            indexDbInfo.version++;
            indexDbInfo.store.push( config.store[ 0 ] );
            window.localStorage[ indexedDbName ] = JSON.stringify( indexDbInfo );
        }
    }
    return config;

}


/*
*
* 以下为测试部分
* */


var testUrl = {
   // serverurl:"http://192.168.0.181:11186",
   // modelid: "M1533202901193",
    //dbname:"debugDB"
     serverurl:"http://bos3d.bimwinner.com",
     modelid: "M1533803783283",
     dbname:"yingjia_bos3d"
};

//@dbConfig 数据库创建相关内容
var dbConfig = {
    dbName: "bos3d_r",
    version: 1,
    store: [testUrl.modelid]
};

/*
* @Content 下面是无LOD数据库加载
* */

var db_test = new indexedDbOpen( indexedConfig( dbConfig ) );
var url_test = new Url( testUrl.serverurl, testUrl.modelid, testUrl.dbname );

var xhr = new Xhr({ url:url_test.projectUrl(),method:"GET",responseType:"json" });
xhr.getData().then(function ( e ) {
    db_test.put("model",e);
    return e.data.scene;
}).then(function ( e ) {
    var progress_total = e.trees.length + e.components.length + e.materials.length + e.geometries.length;
    var progress_loaded=0;
    for( var i =0; i < e.trees.length; i++ ){
        xhr.url = url_test.textureUrl(e.trees[i].fileKey);
        xhr.getData().then(function ( e ) {
            progress_loaded++;
            document.getElementById("bar").style.width = (progress_loaded/progress_total)*100+"%";
            document.getElementById("bar").innerHTML=(progress_loaded/progress_total)*100+"%";
            if( e.axis !== undefined ) {
                db_test.put("k-d", e);
            }
            else{
                db_test.put("scene", e);
            }
        });
    };
    for( var i in e.components ){
        xhr.url = url_test.textureUrl(e.components[i].fileKey);
        xhr.getData().then( function ( e ) {
            progress_loaded++;
            document.getElementById("bar").style.width = (progress_loaded/progress_total)*100+"%";
            document.getElementById("bar").innerHTML=(progress_loaded/progress_total)*100+"%";
            db_test.setBatch("compoents",e);
        });
    }

    for( var i in e.materials ){
        xhr.url = url_test.textureUrl(e.materials[i].fileKey);
        xhr.responseType = "arraybuffer";
        xhr.getData().then( function ( e ) {
            progress_loaded++;
            document.getElementById("bar").style.width = (progress_loaded/progress_total)*100+"%";
            document.getElementById("bar").innerHTML=(progress_loaded/progress_total)*100+"%";
            var materialData = saveMaterial( e );
            db_test.setBatch("materials",materialData );
        });
    }

    for( var i in e.geometries ){
        xhr.url = url_test.textureUrl(e.geometries[i].fileKey);
        xhr.responseType = "arraybuffer";
        xhr.getData().then(function ( e ) {
            progress_loaded++;
            document.getElementById("bar").style.width = (progress_loaded/progress_total)*100+"%";
            document.getElementById("bar").innerHTML=(progress_loaded/progress_total)*100+"%";
            var geoData = saveGeo( e );
            db_test.setBatch("materials",geoData );
        });

    }
});





