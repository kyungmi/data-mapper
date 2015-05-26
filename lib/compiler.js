/**
 * Created by kyungmi on 15. 5. 26..
 */

var parse = require('./parser');

function _traverse(node, callback){
    callback(node, true);
    if(node.children && node.children.length > 0){
        for(var i in node.children){
            var childNode = node.children[i];
            _traverse(childNode, callback);
        }
        callback(node, false);
    }
}

var contextedValue = /^\s*!?([a-zA-Z]+[\w\[\]\.']*)/mg;
function _evalNormalize(evalStr, context){
    var lineBreaks = evalStr.replace(/([\s!=<>]+)/g, '\n$1\n');
    var contexted = lineBreaks.replace(contextedValue, function(){
        return context + '.' + arguments[1];
    });
    return contexted.replace(/(\s)+/g, ' ');
}

//console.log(_evalNormalize('!a[abc] - a < aaa === a[\'b\']', 'model'));

function Compiler(){}

var whereFn = 'function _where(input){ return input.trim().replace(/^\\s*(AND|OR)+/, \'\'); }';
var setFn = 'function _set(input){ return input.trim().replace(/^\\s*(,)+/, \'\'); }';
var valuesFn = 'function _values(input){ return input; }';
var fn = '(function fn(){ return function(m){ ~whereFn~ ~setFn~ ~valuesFn~ var stmt = \'\'; var params = []; ' +
    '~replacement~ return {stmt: stmt, params: params}; }; })()';

Compiler.prototype.preCompile = function(input){
    var root = parse(input),
        queryType = root.content,
        rplc = '',
        fns = {where: false, set: false, values: false},
        context;
    _traverse(root, function(node, start){
        switch(node.type){
            case 'query':
                break;
            case 'where':
                if(queryType !== 'insert'){
                    if(start){
                        fns.where = true;
                        rplc += ' var whereClause = \' \'; '
                        context = 'where';
                    } else {
                        rplc += ' stmt += \' WHERE \' + _where(whereClause); '
                        context = '';
                    }
                }
                break;
            case 'set':
                if(queryType === 'update'){
                    if(start){
                        fns.set = true;
                        rplc += ' var setClause = \' \'; '
                        context = 'set';
                    } else {
                        rplc += ' stmt += \' SET \' + _set(setClause); '
                        context = '';
                    }
                }
                break;
            case 'values':
                if(queryType === 'insert'){
                    if(start){
                        fns.values = true;
                        rplc += ' var valuesClause = \' \'; '
                        context = 'values';
                    } else {
                        rplc += ' stmt += \' VALUES \' + _values(valuesClause); '
                        context = '';
                    }
                }
                break;
            case 'if':
                if(start){
                    rplc += ' if(' + _evalNormalize(node.eval, 'm') + ') { ';
                } else {
                    rplc += ' } ';
                }
                break;
            case 'text':
                if (context) {
                    rplc += ' ' + context + 'Clause += \'' + node.content + '\'; ';
                } else {
                    rplc += ' stmt += \'' + node.content + '\'; ';
                }
                break;
            case 'placeholder':
                if (context) {
                    rplc += ' ' + context + 'Clause += \' ? \'; ';
                } else {
                    rplc += ' stmt += \' ? \'; ';
                }
                rplc += ' params.push(' + _evalNormalize(node.eval, 'm') + '); ';
                break;
        }
        //console.log(node);
    });
    var resultFn = fn.replace('~replacement~', rplc).replace('~whereFn~', fns.where ? whereFn : '')
        .replace('~setFn~', fns.set ? setFn : '').replace('~valuesFn~', fns.values ? valuesFn : '');
    return eval(resultFn);
};

Compiler.prototype.compile = function(preCompiledFn, params){
    var preStmt;
    var paramArray = [];
    return {
        preparedStatement: preStmt,
        params: paramArray
    };
};

module.exports = new Compiler();

/*
function _test(){
    var testStr = [
        'SELECT * FROM A \
        {#where}\
            {# if a=1} AND column_a >= {{a}} {/if}\
            {#if b} AND column_b = {{b}} {/if} \
            OR column_c = {{c.value}} \
        {/ where} GROUP BY column_a',
        'UPDATE ABCD_A SET a={{a}}, b={{b}}',
        'UPDATE ABCD_A {#set} ,  a={{a}}, b={{b}}{/set}'
    ];

    for(var i in testStr){
        console.log('=================== ' + i + ' ===================');
        var compile = module.exports.preCompile(testStr[i]);
        console.log('precompiled: ', compile.toString());
        var result = compile({a: 2, b: 'abc', c: {value: 'a'}});
        console.log('result: ', result);

    }
}
_test();
    */