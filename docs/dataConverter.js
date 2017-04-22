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

function convertToCSType(data, type) {
    var csType = {};
    csType.typeName = csTypeNames[type.typeName] || type.typeName;
    if(type.sequence) csType.array = true;
    csType.primitive = primitiveTypes[csType.typeName];
    if(csType.typeName === 'string' && csType.array) csType.primitive = false; 
    csType.proxyType = csType.primitive ? csType.typeName : 'string';
    delete data.type;
    debugger;
    data.csType = csType;
}

function generateParamPattern(data, params) {
    params.forEach(param => {
        convertToCSData(param, param.type);
    });
}

function convertToCSData(data) {
    if(typeof data !== 'object') return;
    Object.keys(data).forEach(key => {
        switch(key) {
            case 'param':
                generateParamPattern(data, data[key]);
                break;
            case 'type':
                convertToCSType(data, data[key]);
                break;
            default:
                convertToCSData(data[key]);
                break;
        }
    });
}