var xhr = new XMLHttpRequest();
xhr.open('GET', 'https://www.w3.org/TR/webrtc/');
xhr.responseType = 'document';
xhr.onload = evt => {
    var idlClasses = [];
    Array.from(document.querySelectorAll('*'))
        .filter(elm => elm.className.startsWith('idl'))
        .forEach(idl => {
            if (!idlClasses.includes(idl.className)) idlClasses.push(idl.className);
        });
    idlClasses.sort();
    var unknownClasses = idlClasses.filter(className => !knownClasses.includes(className));
    if (unknownClasses.length) {
        console.log(`["${unknownClasses.join(", ")}"] unknown class`);
    } else {
        var doc = xhr.responseXML;
        var legacyInterface = doc.getElementById('legacy-interface-extensions');
        legacyInterface.parentElement.removeChild(legacyInterface);
        parseWebIDLminimum(doc);
    }
}
xhr.send();

var knownKindClassNames = [
    'idlCallback',
    'idlDictionary',
    'idlEnum',
    'idlInterface'
];
var knownClasses = [
    'idlAttrName',
    'idlAttrType',
    'idlAttribute',
    'idlCallback',
    'idlCallbackID',
    'idlCallbackType',
    'idlCtor',
    'idlDefaultValue',
    'idlDictionary',
    'idlDictionaryID',
    'idlEnum',
    'idlEnumID',
    'idlEnumItem',
    'idlInterface',
    'idlInterfaceID',
    'idlMaplike',
    'idlMember',
    'idlMemberName',
    'idlMemberType',
    'idlMemberValue',
    'idlMethName',
    'idlMethType',
    'idlMethod',
    'idlParam',
    'idlParamName',
    'idlParamType',
    'idlSectionComment',
    'idlSerializer',
    'idlSerializerValues',
    'idlSuperclass',
    'idlType internalDFN'
];
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

var typeClassNames = [];
var nullObj = { textContent: '' };
var useListClasses = [];

function typeParse(typeElm) {
    var types = [];
    var typeNames = getText(typeElm).replace(/\(|\)|\r|\n/g, '').split(' or ').map(x => x.trim());
    var unknownTypes = [];

    typeNames = typeNames.map(typeName => {
        var isArray = false;
        var isSequence = false;
        var isFrozen = false;
        var isPromise = false;
        var isNullable = false;
        var isMapLike = false;
        var isPrimitive = false;
        var isVoid = false;
        var isUnrestricted = false;

        if (/sequence<(.+?)>/i.test(typeName)) {
            typeName = /sequence<(.+?)>/i.exec(typeName)[1];
            isArray = true;
            isSequence = true;
        } else if (/frozenarray<(.+?)>/i.test(typeName)) {
            typeName = /frozenarray<(.+?)>/i.exec(typeName)[1];
            isArray = true;
            isFrozen = true;
        } else if (/promise<(.+?)>/i.test(typeName)) {
            typeName = /promise<(.+?)>/i.exec(typeName)[1];
            isPromise = true;
        } else if (/maplike<(.+?)>/i.test(typeName)) {
            typeName = /maplike<(.+?)>/i.exec(typeName)[1];
            isMapLike = true;
        } else if (typeName.endsWith('...')) {
            isArray = true;
            typeName = typeName.replace('...', '').trim();
        } else if (typeName.endsWith('?')) {
            isNullable = true;
            typeName = typeName.replace('?', '').trim();
        } else if(typeName.startsWith('unrestricted')) {
            isUnrestricted = true;
            typeName = typeName.replace('unrestricted', '').trim();
        }
        
        var type = {type: typeName};
        isArray = isArray || ['arraybuffer', 'arraybufferview'].includes(typeName);
        isPrimitive = primitiveTypes.includes(type.type);
        isVoid = type.type === 'void';
        if (isArray) type.isArray = true;
        if (isSequence) type.isSequence = true;
        if (isFrozen) type.isFrozen = true;
        if (isPromise) type.isPromise = true;
        if (isNullable) type.isNullable = true;
        if (isPrimitive) type.isPrimitive = true;
        if (isVoid) type.isVoid = true;
        if (isUnrestricted) type.isUnrestricted = true;
        return type;
    });

    if(unknownTypes.length) {
        throw `"${unknownTypes.join('", "')}" unknown types.`;
    }

    return types;
}

function getText(elm) {
    return (elm || nullObj).textContent.trim();
}

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

function firstKeywordParse(target, parseData) {
    var firstWord = getText(target).split(' ')[0];
    if (firstWord === 'readonly') parseData.isReadonly = true;
    if (firstWord === 'optional') parseData.isOptional = true;
    if (firstWord === 'required') parseData.isRequired = true;
}

function paramParse(target) {
    var params = [];
    target.querySelectorAll('.idlParam').forEach(param => {
        var prm = {
            name: getText(param.querySelector('.idlParamName')),
            type: typeParse(param.querySelector('.idlParamType'))
        };
        var defaultValue = getText(param.querySelector('.idlMemberValue'));
        if (defaultValue) {
            if (prm.type[0].isPrimitive && prm.type[0].type !== 'string') {
                defaltValue = +defaultValue;
            }
            prm.defaltValue = defaultValue;
        }
        firstKeywordParse(param, prm);
        params.push(prm);
    });
    return params;
}

function extAttrParse(target, parseData) {
    var extAttrElms = target.querySelectorAll(':scope > .extAttr');
    var extAttrs = [];
    extAttrs.forEach(elm => {
        var extAttr = {};
        extAttr.name = getText(elm.querySelector('extAttrName'));
        extAttr.rhs = getText(elm.querySelector('extAttrRhs'));
        extAttrs.push(extAttr);
    });
    var extAttrNameElms = target.querySelectorAll(':scope > .extAttrName');
    extAttrs.forEach(elm => {
        var extAttr = {};
        extAttr.name = elm.textContent;
        extAttrs.push(extAttr);
    });
    if (extAttrs.length) parseData.extAttrs = extAttrs;
}

function generateParamPattern(idx, ptn, src, result) {
    if (src.length === 0) return [];
    for (var i = 0; i < src[idx].type.length; i++) {
        var p = [].concat(ptn);
        p.push(src[idx].type[i]);
        if (idx < src.length - 1) {
            generateParamPattern(idx + 1, p, src, result);
        } else {
            result.push(p);
        }
    }
}

function appendMessage(txt) {
    var div = document.createElement('div');
    div.textContent = txt;
    document.body.appendChild(div);
}

var idlClasses = [];
function collectIdlClassName(elm) {
    elm.querySelectorAll(':scope > *').forEach(child => {
        child.classList.forEach(className => {
            if (className.startsWith('idl')) {
                if (!idlClasses.includes(className)) idlClasses.push(className);
            }
        });
        collectIdlClassName(child);
    });
}

function parseWebIDLminimum(doc) {
    useListClasses = [];
    classStructs = {};
    doc.querySelectorAll('.def.idl').forEach(idl => {
        jsIndentLevel = jsIndentLevel = 0;
        var kindClassName = idl.firstChild.className;
        var kind = {
            idlDictionary: 'dictionary',
            idlEnum: 'enum',
            idlInterface: 'interface',
            idlCallback: 'callback'
        }[kindClassName];
        var id = getText(idl.querySelector(`.${kindClassName}ID`));
        classStructs[kind] = classStructs[kind] || {};

        if (id) {
            var superClassName = getText(idl.querySelector('.idlSuperclass'));
            var ctor = idl.querySelector('.idlCtor');
            var attributes = idl.querySelectorAll('.idlAttribute');
            var members = Array.from(idl.querySelectorAll('.idlMember'));
            var methods = Array.from(idl.querySelectorAll('.idlMethod'));
            var enumItems = idl.querySelectorAll('.idlEnumItem');
            var callback = idl.querySelector('.idlCallback');
            var maplikes = idl.querySelectorAll('.idlMaplike');

            if (enumItems.length) {
                idlEnums.push({ id: id, code: idl.textContent });
            } else {
                idlCodes.push({ id: id, code: idl.textContent });
            }

            classStructs[kind][id] = classStructs[kind][id] || {};
            var classStruct = classStructs[kind][id];
            extAttrParse(idl, classStruct);

            if (superClassName) {
                classStruct.superClass = superClassName;
                if (superClassName === 'Event') superClassName = 'EventArg';
            }

            if (ctor) {
                classStruct.constructor = {
                    params: paramParse(ctor)
                };
                extAttrParse(ctor, classStruct.constructor);
            }

            if (callback) {
                classStruct.params = paramParse(callback);
            }

            if (attributes.length) {
                classStruct.attributes = classStruct.attributes || {};
                attributes.forEach(attribute => {
                    var attrName = getText(attribute.querySelector('.idlAttrName'));
                    firstKeywordParse(attribute, attr);
                    var types = typeParse(attribute.querySelector('.idlAttrType'));
                    if (types[0].type === 'EventHandler') {
                        classStruct.eventHandlers = classStruct.eventHandlers || [];
                        classStruct.eventHandlers.push(attrName);
                    } else {
                        var attr = classStruct.attributes[attrName] = classStruct.attributes[attrName] || {};
                        attr.type = types;
                        extAttrParse(attribute, attr);
                    }
                });
            }

            if (members.length) {
                classStruct.members = classStruct.members || {};
                members.forEach(member => {
                    var mem = classStruct.members[memName] = classStruct.members[memName] || {};
                    mem.name = getText(member.querySelector('.idlMemberName'));;
                    mem.type = typeParse(member.querySelector('.idlMemberType'));
                    var defaultValue = getText(member.querySelector('.idlMemberValue'));
                    if (defaultValue) {
                        if (mem.type[0].isPrimitive && mem.type[0].type !== 'string') {
                            defaltValue = +defaultValue;
                        }
                        mem.defaltValue = defaultValue;
                    }
                    extAttrParse(member, mem);
                });
            }

            if (methods.length) {
                classStruct.methods = classStruct.methods || {};
                methods.some(method => {
                    var returnType = typeParse(method.querySelector('.idlMethType'));
                    if (returnType.length > 1) {
                        throw `parser error return type not one. kind=${kind} id=${id} methodName=${methodName}`;
                        return true;
                    }
                    var meth = classStruct.methods[methodName] = classStruct.methods[methodName] || {};
                    meth.name = getText(method.querySelector('.idlMethName'));
                    meth.returnType = returnType[0];
                    meth.params = paramParse(method);
                    return false;
                });
            }

            if (enumItems.length) {
                classStruct.items = classStruct.items || [];
                enumItems.forEach(item => {
                    var rawTxt = item.textContent.replace(/"/g, '');
                    var item = camelize(rawTxt);
                    if (item === 'new') item = 'New';
                    classStruct.items.push(item);
                });
            }

            if (maplikes.length) { // TODO
                classStruct.map = {};
                firstKeywordParse(maplikes[0], classStruct.map);
                typeParse(maplikes[0], classStruct.map);
            }
        }
    });

    console.log(JSON.stringify(classStructs, null, 2));
    //console.log(classStructs);
    //generateCS(classStructs);
    //WebRTCSpecCoverageCheck(classStructs);
}

var zip = null;
var idlCodes = [];
var idlEnums = [];
var csCode = '';
var csIndentSize = 2;
var csIndentLevel = 0;
var managerNameSpace = 'UnityWebGLWebRTC';
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

function generateCS(classStructs, arrayToList) {
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
    Object.keys(classStructs).forEach(kind => {
        var rtcObj = classStructs[kind];
        switch (kind) {
            case 'dictionary':
            case 'interface':
                Object.keys(rtcObj).forEach(id => {
                    var data = rtcObj[id];
                    addCSLine('using AOT;');
                    addCSLine('using RSG;');
                    addCSLine('using System;');
                    addCSLine('using System.Collections.Generic;');
                    addCSLine('using System.Runtime.InteropServices;');
                    addCSLine('using UnityEngine;');
                    addCSLine();
                    addCSLine(`namespace ${managerNameSpace}`);
                    addCSLine('{');

                    addCSLine(`public class ${id}${(data.superClassName ? ' : ' + data.superClassName : '')}`);
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
            case 'enum':
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
            case 'callback':
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

function WebRTCSpecCoverageCheck(classStructs) {
    var fragment = document.createDocumentFragment();
    var browsers = ['Chrome', 'Edge', 'Firefox', 'Safari'];
    // Opera 8.0+
    var isOpera = (!!window.opr && !!opr.addons) || !!window.opera || navigator.userAgent.indexOf(' OPR/') >= 0;
    var isFirefox = typeof InstallTrigger !== 'undefined';
    var isSafari = /constructor/i.test(window.HTMLElement) || (function (p) { return p.toString() === "[object SafariRemoteNotification]"; })(!window['safari'] || safari.pushNotification);
    var isIE = /*@cc_on!@*/false || !!document.documentMode;
    var isEdge = !isIE && !!window.StyleMedia;
    var isChrome = !!window.chrome && !!window.chrome.webstore;
    var isBlink = (isChrome || isOpera) && !!window.CSS;
    Object.keys(classStructs.interface).forEach(id => {
        if (window[id]) {
            let rtcObj = classStructs.interface[id];
            let secId = document.createElement('section');
            let h2 = document.createElement('h2');
            h2.textContent = id;
            h2.classList.add('OK');
            secId.appendChild(h2);
            fragment.appendChild(secId);
            if (rtcObj.members) {
                rtcObj.members.forEach(member => {
                    var div = document.createElement('div');
                    div.textContent = member.name;
                    if (Object.keys(window[id].prototype).includes(member.name)) {
                        div.classList.add('OK');
                    } else {
                        div.classList.add('NG');
                    }
                    secId.appendChild(div);
                });
            }
            if (rtcObj.methods) {
                rtcObj.methods.forEach(method => {
                    var div = document.createElement('div');
                    div.textContent = method.name;
                    if (Object.keys(window[id].prototype).includes(method.name)) {
                        div.classList.add('OK');
                    } else {
                        div.classList.add('NG');
                    }
                    secId.appendChild(div);
                });
                fragment.appendChild(secId);
            }
        } else {
            let rtcObj = classStructs[type][id];
            let secId = document.createElement('section');
            let h2 = document.createElement('h2');
            h2.textContent = id;
            h2.classList.add('NG');
            secId.appendChild(h2);
            fragment.appendChild(secId);
        }
    });
    document.body.appendChild(fragment);
}
