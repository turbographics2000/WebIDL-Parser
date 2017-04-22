
var csTypeNames = {
    'boolean': 'bool',
    'byte': 'byte',
    'short': 'short',
    'long': 'int',
    'long long': 'long',
    'double': 'double',
    'unsigned short': 'ushort',
    'unsigned long': 'uint',
    'unsigned long long': 'ulong',
    'float': 'float',
    'unrestricted float': 'float',
    'double': 'double',
    'unrestricted double': 'double',
    'domstring': 'string',
    'usvstring': 'string',
    'object': 'object',
    'void': 'void',
    'arraybuffer': 'byte',
    'arraybufferview': 'byte',
    'domhighRestimestamp': 'TimeSpan',
    'domtimestamp': 'TimeSpan',
    'octet': 'byte',
    'blob': 'FileInfo',
    'record': 'map'
};

var primitiveTypes = [
    'void',
    'bool',
    'byte',
    'sbyte',
    'short',
    'ushort',
    'int',
    'uint',
    'long',
    'ulong',
    'float',
    'double',
    'string'
];

var primitiveDefault = {
    bool: false,
    byte: 0,
    sbyte: 0,
    short: 0,
    ushort: 0,
    int: 0,
    uint: 0,
    long: 0,
    float: '0f',
    double: '0f',
    string: null
};

var zip = null;
var idlCodes = [];
var idlEnums = [];
var csCode = '';
var csIndentSize = 2;
var csIndentLevel = 0;
var managerNameSpace = 'UnityWebGLWebRTC';

function camelize(txt, forceUpperCase) {
    return txt.split('-').map((elm, idx) => {
        var arr = elm.split('');
        if (idx === 0 && !forceUpperCase) {
            arr[0] = arr[0].toLowerCase();
        } else {
            arr[0] = arr[0].toUpperCase();
        }
        return arr.join('');
    }).join('');
}

function addCSIndent() {
    csCode += [...Array(csIndentSize * csIndentLevel)].map(x => ' ').join('');
}
function addCSCode(code = '', isIndent) {
    if (isIndent) addCSIndent();
    csCode += code;
}
function addCSLine(code = '') {
    if (code.startsWith('}')) csIndentLevel--;
    addCSIndent();
    csCode += code + '\r\n';
    if (code === '{') csIndentLevel++;
}
function saveCSCode(fileName) {
    zip.file(fileName, csCode);
    csCode = '';
    csIndentLevel = 0;
}
function saveIdlCode(fileName, enumFileName) {
    idlCodes.sort((a, b) => {
        if (a.id > b.id) return 1;
        if (a.id < b.id) return -1;
        return 0;
    });
    var idlCode = '';
    idlCodes.forEach(code => {
        idlCode += '\r\n' + code.code;
    });
    zip.file(fileName, idlCode);
    var idlEnumCode = '';
    idlEnums.sort((a, b) => {
        if (a.id > b.id) return 1;
        if (a.id < b.id) return -1;
        return 0;
    });
    idlEnums.forEach(code => {
        idlEnumCode += '\r\n' + code.code;
    });
    zip.file(enumFileName, idlEnumCode);
}
var csManagerCode = '';
var csManagerIndentLevel = 0;
function addCSManagerIndent() {
    csManager += [...Array(csIndentSize * csIndentLevel)].map(x => ' ').join();
}
function addCSManagerCode(code = '') {
    csManagerCode += code;
}
function addCSManagerLine(code = '') {
    if (code.startsWith('}')) csManagerIndentLevel--;
    addCSIndent();
    csManagerCode += [...Array(csIndentSize * csIndentLevel)].map(x => ' ') + code + '\r\n';
    if (code === '{') csManagerIndentLevel++;
}
function saveCSManagerCode(fileName) {
    zip.file(fileName, csManagerCode);
    csManagerCode = '';
    csManagerIndentLevel = 0;
}

function generateCS(parseData, classStructs, arrayToList) {
    var attrOrMemberAddCSLine = (name, data) => {
        var camName = camelize(name, true);
        var t = data.type[0];

        // 型が配列かそうでないかの複数の場合は配列を選択
        if (data.type.length > 1) {
            data.type.forEach(type => {
                if (type.isArray || type.isSequence) {
                    t = type;
                }
            });
        }

        var retType = t.isPrimitive ? t.type : 'string';
        addCSLine();
        addCSLine('[DllImport("__Internal")]');
        addCSLine(`private static extern ${retType} get${camName}(string instanceId);`);
        if (!data.isReadonly) {
            addCSLine('[DllImport("__Internal")]');
            addCSLine(`private static extern void set${camName}(string instanceId, ${retType} value);`);
        }
        if (t.isArray) {
            if (arrayToList) {
                addCSLine(`public List<${t.type}> ${name}`);
            } else {
                addCSLine(`public ${t.type}[] ${name}`);
            }
            addCSLine('{');
            addCSLine('get');
            addCSLine('{');
            addCSLine(`var ret = get${camName}(InstanceId);`);
            addCSLine(`return JsonUtility.FromJson<${t.type + 'List'}>(ret)${t.isArray ? '.list' : ''};`);
            addCSLine('}');
            if (!data.isReadonly) {
                addCSLine('set');
                addCSLine('{');
                addCSLine(`var tmp = new ${t.type + 'List'}();`);
                addCSLine('tmp.list = value;');
                addCSLine('var json = JsonUtility.ToJson(tmp);');
                addCSLine(`set${camName}(InstanceId, json);`);
                addCSLine('}');
            }
            addCSLine('}');
        } else {
            addCSLine(`public ${t.type} ${name}`);
            addCSLine('{');
            addCSLine('get');
            addCSLine('{');
            if (t.isPrimitive) {
                addCSLine(`return get${camName}(InstanceId);`);
            } else {
                addCSLine(`var ret = get${camName}(InstanceId);`);
                addCSLine(`return JsonUtility.FromJson<${t.type}>(ret);`);
            }
            addCSLine('}');
            if (!data.isReadonly) {
                addCSLine('set');
                addCSLine('{');
                if (t.isPrimitive) {
                    addCSLine(`set${camName}(InstanceId, value);`);
                } else {
                    if (t.isArray) {
                        addCSLine(`var tmp = new ${t.type + 'List'}();`);
                        addCSLine('tmp.list = value;');
                        addCSLine('var json = JsonUtility.ToJson(tmp);');
                    } else {
                        addCSLine('var json = JsonUtility.ToJson(value);');
                    }
                    addCSLine(`set${camName}(InstanceId, json);`);
                }
                addCSLine('}');
            }
            addCSLine('}');
        }
    };

    var methodAddCSLine = (method, params) => {
        var methodName = method.name;
        var retType = method.returnType.type;
        var proxyRetType = method.returnType.type;
        var rtIsPrimitive = method.returnType.isPrimitive;
        var rtIsPromise = method.returnType.isPromise;
        var rtIsVoid = method.returnType.isVoid;
        if (!rtIsPrimitive) proxyRetType = 'string';
        addCSLine();
        if (rtIsPromise) {
            addCSLine(`private Action<${rtIsVoid ? 'string' : proxyRetType}> __${methodName};`);
            addCSLine('[DllImport("__Internal")]');
            addCSCode(`private static extern void _${methodName}(string instanceId`, true);
            params.forEach(pt => {
                addCSCode(`, ${pt.type} ${pt.name}`);
                if (pt.isOptional) {
                    if (pt.isPrimitive) {
                        addCSCode(` = ${primitiveDefault[pt.name]}`);
                    } else {
                        addCSCode(` = null`);
                    }
                }
            });
            addCSCode(');\r\n');
            addCSLine(`[MonoPInvokeCallback(typeof(Action<string` + (rtIsVoid ? '' : ', ' + proxyRetType) + `>))]`);
            addCSLine(`private static void res_${methodName}(string instanceId` + (rtIsVoid ? ', string error' : `, ${proxyRetType} result`) + ')');
            addCSLine('{');
            if (!rtIsPrimitive) {
                addCSLine(`var res = JsonUtility.FromJson<${retType}>(result);`);
                addCSLine(`Instances[instanceId].__${methodName}.Invoke(res);`);
            } else {
                addCSLine(`Instances[instanceId].__${methodName}.Invoke(` + (rtIsVoid ? 'error);' : 'result);'));
            }
            addCSLine('}');
            addCSLine();
            addCSCode(`public Promise${rtIsVoid ? '' : '<' + retType + '>'} ${methodName}(`, true);
            params.forEach((pt, idx) => {
                if (idx > 0) addCSCode(', ');
                addCSCode(`${pt.type} ${pt.name}`);
                if (pt.isOptional) {
                    if (pt.isPrimitive) {
                        addCSCode(` = ${primitiveDefault[pt.name]}`)
                    } else {
                        addCSCode(` = null`);
                    }
                }
            });
            addCSCode(')\r\n');
            addCSLine('{');
            if (rtIsVoid) {
                addCSLine(`var promise = new Promise((resolve, reject) =>`);
                addCSLine('{');
                addCSLine(`__${methodName} = (error) =>`);
                addCSLine('{');
                addCSLine('if(error == "")');
                addCSLine('{');
                addCSLine('resolve();');
                addCSLine('}');
                addCSLine('else');
                addCSLine('{');
                addCSLine('reject(new Exception(error));');
                addCSLine('}');
                addCSLine('};');
            } else {
                addCSLine(`var promise = new Promise<${retType}>((resolve, reject) =>`);
                addCSLine('{');
                addCSLine(`__${methodName} = (result) =>`);
                addCSLine('{');
                addCSLine('if(result.error == "")');
                addCSLine('{');
                addCSLine('resolve(result);');
                addCSLine('}');
                addCSLine('else');
                addCSLine('{');
                addCSLine('reject(new Exception(result.error));');
                addCSLine('}');
                addCSLine('};');
            }
            addCSLine(`_${methodName}(InstanceId${params.map(pt => ', ' + pt.name).join('')});`);
            addCSLine('});');
            addCSLine('return promise;');
            addCSLine('}');
        } else {
            addCSLine('[DllImport("__Internal")]');
            addCSLine(`private static extern ${proxyRetType} _${methodName}(string instanceId` + params.map(pt => ', ' + pt.type + ' ' + pt.name).join('') + ');');
            addCSLine(`public ${retType} ${methodName}(string instanceId` + params.map(pt => ', ' + pt.type + ' ' + pt.name).join('') + ')');
            addCSLine('{');
            if (rtIsVoid) {
                addCSLine(`_${methodName}(instanceId` + params.map(pt => ', ' + pt.name).join('') + ');');
            } else {
                if (rtIsPrimitive) {
                    addCSLine(`${rtIsVoid ? '' : 'return '}_${methodName}(instanceId` + params.map(pt => ', ' + pt.name).join('') + ');');
                } else {
                    addCSLine(`var json = _${methodName}(instanceId` + params.map(pt => ', ' + pt.name).join('') + ');');
                    addCSLine(`var ret = JsonUtility.fromJson<${retType}(json);`);
                    addCSLine('return ret;');
                }
            }
            addCSLine('}');
        }
    };

    zip = new JSZip();
    saveIdlCode('WebIDL.txt', 'WebIDLEnum.txt');
    Object.keys(parseData).forEach(group => {
        var groupData = parseData[group];
        switch (group) {
            case 'Dictionary':
            case 'Interface':
                Object.keys(groupData).forEach(id => {
                    var data = groupData[id];
                    addCSLine('using AOT;');
                    addCSLine('using RSG;');
                    addCSLine('using System;');
                    addCSLine('using System.Collections.Generic;');
                    addCSLine('using System.Runtime.InteropServices;');
                    addCSLine('using UnityEngine;');
                    addCSLine();
                    addCSLine(`namespace ${managerNameSpace}`);
                    addCSLine('{');

                    addCSLine(`public class ${id}${(data.superClasses ? ' : ' + data.superClasse.join(', ') : '')}`);
                    addCSLine('{');
                    addCSLine(`public static Dictionary<string, ${id}> Instances; `);
                    addCSLine('public string InstanceId;');
                    addCSLine('public string error;');

                    if (data.ctor) {
                        addCSLine(`public ${id} (` + data.params.map(param => param.type.type + ' ' + param.type.name).join(', ') + ')');
                        addCSLine(`{`);
                        addCSLine(`} `);
                    }

                    if (data.attributes) {
                        Object.keys(data.attributes).forEach(attributeName => {
                            attrOrMemberAddCSLine(attributeName, data.attributes[attributeName]);
                        });
                    }

                    if (data.members) {
                        Object.keys(data.members).forEach(memberName => {
                            attrOrMemberAddCSLine(memberName, data.members[memberName]);
                        });
                    }

                    if (data.methods) {
                        if (id === 'RTCDataChannel') debugger;
                        Object.keys(data.methods).forEach(methodName => {
                            var method = data.methods[methodName];
                            method.paramPatterns.forEach(paramPattern => {
                                methodAddCSLine(method, paramPattern);
                            });
                        });
                    }

                    if (data.eventHandlers) {
                        data.eventHandlers.forEach(eventHandlerName => {
                            addCSLine();
                            addCSLine(`[MonoPInvokeCallback(typeof (Action<string>))]`);
                            addCSLine(`private static void _${eventHandlerName}(string instanceId) `);
                            addCSLine('{');
                            addCSLine(`Instances[instanceId].${eventHandlerName}.Invoke();`);
                            addCSLine('}');
                            addCSLine(`public Action ${eventHandlerName};`);
                        });
                    }

                    addCSLine('}');
                    addCSLine('}');

                    saveCSCode(id + '.cs');
                    if (useListClasses.includes(id)) {
                        addCSLine('using System.Collections.Generic;');
                        addCSLine();
                        addCSLine(`namespace ${managerNameSpace}`);
                        addCSLine('{');
                        addCSLine(`public class ${id}List`);
                        addCSLine('{');
                        if (arrayToList) {
                            addCSLine(`public List <${id}> list; `);
                        } else {
                            addCSLine(`public ${id}[] list; `);
                        }
                        addCSLine('}');
                        addCSLine('}');
                        saveCSCode(id + 'List.cs');
                    }
                });
                break;
            case 'Enum':
                addCSLine('using System;');
                addCSLine('using System.Collections.Generic;');
                addCSLine('using System.Linq;');
                addCSLine('using System.Text;');
                addCSLine();
                addCSLine(`namespace ${managerNameSpace} `);
                addCSLine('{');
                Object.keys(rtcObj).forEach(id => {
                    var enm = rtcObj[id];
                    addCSLine(`public enum ${id} ${(enm.superClassName ? ' : ' + enm.superClassName : '')} `);
                    addCSLine(`{`);
                    enm.items && enm.items.forEach((item, idx) => {
                        addCSLine(`${item.item} ` + (enm.items.length - 1 > idx ? ',' : '') + ` // ${item.rawItem}`);
                    });
                    addCSLine(`}`);
                });
                addCSLine(`}`);
                saveCSCode(`${managerNameSpace}_Enums.cs`);
                break;
            case 'Callback':
                break;
        }
    });

    zip.generateAsync({ type: 'blob' })
        .then((content) => {
            var a = document.createElement('a');
            a.download = 'cs.zip';
            a.href = URL.createObjectURL(content);
            a.click();
        });
}

function convertToCSType(data, type) {

}

function generateParamPattern(data, params) {
    params.forEach(param => {
        convertToCSData(param, param.type);
    });
}

function convertToCSData(data) {
    if(typeof data !== object) return;
    Object.keys(data).forEach(key => {
        switch(key) {
            case 'param':
                generateParamPattern(data, data[key]);
                break;
            case 'type':
                convertToCSType(data, data[key]);
                break;
        }
        if(key === 'type') {
            var csType = {};
            if(type.sequence) {
                csType.array = true;
                //csType.isPrimitive = 
            }
        }
    })
}