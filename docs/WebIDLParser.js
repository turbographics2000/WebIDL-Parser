// var knownKindClassNames = [
//     'idlCallback',
//     'idlDictionary',
//     'idlEnum',
//     'idlInterface'
// ];

// var knownClasses = [
//     'idl',
//     'idlAttrName',
//     'idlAttrType',
//     'idlAttribute',
//     'idlCallback',
//     'idlCallbackID',
//     'idlCallbackType',
//     'idlConst',
//     'idlConstName',
//     'idlConstType',
//     'idlConstValue',
//     'idlCtor',
//     'idlCtorName',
//     'idlDefaultValue',
//     'idlDictionary',
//     'idlDictionaryID',
//     'idlEnum',
//     'idlEnumID',
//     'idlEnumItem',
//     'idlImplements',
//     'idlImplementsDesc',
//     'idlInterface',
//     'idlInterfaceID',
//     'idlIterable',
//     'idlMaplike',
//     'idlMaplikeKeyType',
//     'idlMaplikeValueType',
//     'idlMember',
//     'idlMemberName',
//     'idlMemberType',
//     'idlMemberValue',
//     'idlMethName',
//     'idlMethType',
//     'idlMethod',
//     'idlParam',
//     'idlParamName',
//     'idlParamType',
//     'idlParamValue',
//     'idlSectionComment',
//     'idlSerializer',
//     'idlSerializerValues',
//     'idlSuperclass',
//     'idlTitle',
//     'idlType',
//     'idlTypedef',
//     'idlTypedefID',
//     'idlTypedefType',
//     'idlattr',
//     'idlinterface',
//     'idltype',
//     'idlvalue'
// ];

/*
parseData = {
    Dictionary: { groupData
        RTCConfiguration: { groupItemData
            Member: { memberData
                iceServers: { memberItemData
                    type: {
                        sequence: true,
                        typeName: RTCIceServer
                    }
                }
            }
        }
    }
}
*/

function WebIDLParse(doc) {
    var parseData = {};

    var groups = Array.from(doc.querySelectorAll('.idl *[class$=ID]'))
        .map(elm => elm.className.replace(/^idl(.+?)ID$/, (a, b) => b))
        .filter((val, idx, arr) => arr.indexOf(val) === idx);

    groups.forEach(group => { // Dictionary, Interface, Enum, Callback ...
        var groupData = parseData[group] = parseData[group] || {};
        doc.querySelectorAll(`.idl${group}`).forEach(groupElm => {
            var id = getText(groupElm.querySelector(`.idl${group}ID`));
            var groupItemData = groupData[id] = groupData[id] || {};
            extAttrParse(groupElm, groupItemData);
            switch (group) {
                case 'Dictionary':
                case 'Interface':
                    var superClasses = Array.from(groupElm.querySelectorAll('.idlSuperclass')).map(elm => elm.textContent.trim());
                    if(superClasses.length) groupItemData.superClasses = superClasses;
                    ['Ctor', 'Attribute', 'Member', 'Method'].forEach(memberKind => {
                        memberParse(groupElm, groupItemData, memberKind);
                    })
                    break;
                case 'Callback':
                    memberParse(groupElm, groupItemData, 'Callback');
                    break;
                case 'Enum':
                    groupElm.querySelectorAll('.idlEnumItem').forEach(item => {
                        groupItemData.items = groupItemData.items || [];
                        groupItemData.items.push(getText(item).replace(/"/g, ''));
                    });
                    break;
            }
            memberParse(groupElm, groupItemData, 'Maplike');
        });
    });
    return parseData;
}

function memberParse(groupElm, groupItemData, memberKind) {
    var memberElms = groupElm.querySelectorAll(`.idl${memberKind}`);
    if (memberElms.length) {
        var memberData = groupItemData[memberKind] = groupItemData[memberKind] || {};
        if(typeof memberData === 'string') debugger;
        memberElms.forEach(elm => {
            memberKind = { Attribute: 'Attr', Method: 'Meth' }[memberKind] || memberKind;
            var memberName = getText(elm.querySelector(`.idl${memberKind}Name`));
            var memberItemData = memberName ? memberData[memberName] = memberData[memberName] || {} : memberData;
if(memberName === 'iceCandidatePoolSize') debugger;
            firstKeywordParse(elm, memberItemData);

            extAttrParse(elm, memberItemData);

            var type = typeParse(elm.querySelector(`.idlType, .idl${memberKind}Type`));
            if (type) {
                if (type.typeName[0] === 'EventHandler') {
                    memberData.eventHandlers = memberData.eventHandlers || [];
                    memberData.eventHandlers.push(name);
                } else {
                    memberItemData.type = type;
                }
            }

            var params = paramParse(elm);
            if (params) {
                memberItemData.params = params;
            }

            var defaultValue = getText(elm.querySelector(`.idl${memberKind}Value`));
            if (defaultValue) {
                memberItemData.defaltValue = defaultValue.replace(/"/g, '');
            }

            if(memberKind === 'Superclass') {
                memberData = getText(elm);
            }
        });
    }
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

var nullObj = { textContent: '' };
function getText(elm) {
    return (elm || nullObj).textContent.trim();
}

function firstKeywordParse(target, parseData) {
    var firstWord = getText(target).split(' ')[0];
    if (firstWord === 'readonly') parseData.readonly = true;
    if (firstWord === 'optional') parseData.optional = true;
    if (firstWord === 'required') parseData.required = true;
}

function paramParse(target) {
    var params = null;
    target.querySelectorAll('.idlParam').forEach(param => {
        params = params || [];
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

function typeParse(typeElm) {
    if (!typeElm) return null;

    var type = {};
    var typeName = getText(typeElm);
    var res = /([a-z]+?)<(.+?)>/i.exec(typeName);
    if (res) {
        type[res[1]] = true;
        typeName = res[2];
    }
    var typeNames = [];
    typeName.replace(/\(|\)|\r|\n/g, '').split(' or ').forEach(x => typeNames = typeNames.concat(x.split(',').map(y => y.trim())));
    type.typeName = typeNames;
    return type;
}


