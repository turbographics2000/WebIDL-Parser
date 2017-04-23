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
    'record': 'dictionary'
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

function convertToCSType(data, types) {
    var csTypes = [];
    types.forEach(type => {
        var csType = {};
        csType.typeName = type.typeName;
        if (csType.typeName.endsWith('?')) {
            csType.typeName = csType.typeName.substr(0, type.typeName.length - 1);
            csType.nullable = true;
        }
        csType.typeName = csTypeNames[csType.typeName.toLowerCase()] || csType.typeName;
        if (type.sequence) csType.array = true;
        if (primitiveTypes.includes(csType.typeName)) csType.primitive = true;
        if (csType.typeName === 'string' && csType.array) csType.primitive = false;
        csType.proxyType = csType.primitive ? csType.typeName : 'json';
        csTypes.push(csType);
    });
    data.csType = csTypes;
}


function generateParamPattern(param, idx, ptn, result){
	if(idx === param.length){
        var ptnStr = ptn.map(p => p.data_type.typeName).join('');
        if(result.filter(res => res.ptnStr === ptnStr).length === 0) {
            result.push({
                ptnStr: ptnStr,
                ptn: ptn
            });
        }
    } else {
        if(!param[idx].data_type) debugger;
    	for(var i = 0, l = param[idx].data_type.length; i < l; i++) {
			var p = [].concat(ptn);
            var itm = {};
            Object.keys(param[idx]).forEach(key => {
                if(key !== 'data_type') itm[key] = param[idx][key];
            });
            itm.data_type = param[idx].data_type[i];
			p.push(itm);
			generateParamPattern(param, idx + 1, p, result);
        }
	}
}

function paramPatternParse(data) {
    if (typeof data !== 'object') return;
    Object.keys(data).forEach(key => {
        var patterns = [];
        if(key === 'param') {
            generateParamPattern(data[key], 0, [], patterns);
        } else if(key === 'over_load') {
            for(var i = 0, il = data[key].length; i < il; i++) {
                var result = [];
                generateParamPattern(data[key][i], 0, [], result);
                if(result.length) patterns = patterns.concat(result);
            }
        }
        if(patterns.length) data.param_pattern = patterns;
        paramPatternParse(data[key]);
    });
}


function convertToCSData(data) {
    dataTypeParse(data);
    paramPatternParse(data);
}

function dataTypeParse(data) {
    if (typeof data !== 'object') return;
    Object.keys(data).forEach(key => {
        if (key === 'data_type') {
            convertToCSType(data, data[key]);
            //delete data[key];
        }
        dataTypeParse(data[key]);
    });

}