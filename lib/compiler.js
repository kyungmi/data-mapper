/**
 * Created by kyungmi on 15. 5. 26..
 */

'use strict';

var parse = require('./parser');

function _traverse(node, callback){
    callback(node, true);
    if(node.children && node.children.length > 0){
        for(var i=0; i<node.children.length; i++){
            var childNode = node.children[i];
            _traverse(childNode, callback);
        }
        callback(node, false);
    }
}

var contextedValue = /^\s*!?((?!undefined|null)[a-zA-Z\$]+[\w\[\]\.\$']*)/mg;
function _evalNormalize(evalStr, context){
    var lineBreaks = evalStr.replace(/([\s!=<>]+)/g, '\n$1\n');
    var contexted = lineBreaks.replace(contextedValue, function(){
        return (context ? context + '.' : '') + arguments[1];
    });
    return contexted.replace(/(\s)+/g, ' ');
}

//console.log(_evalNormalize('!a[abc] - a < aaa === a[\'b\']', 'model'));

function Compiler(){}

var whereFn = 'function _where(input){ return input.trim().replace(/^(AND|OR)|(AND|OR)$/g, \'\'); }';
var setFn = 'function _set(input){ return input.trim().replace(/^,|,$/g, \'\'); }';
var trimFn = 'function _trim(input, pattern){ ' +
    '   var regex = new RegExp(\'^\' + pattern + \'|\' + pattern + \'$$\', \'g\');' +
    '   return input.trim().replace(regex, \'\'); ' +
    '}';
var fn = '(function fn(){ return function(m){ ~whereFn~ ~setFn~ ~trimFn~ var stmt = \'\'; var params = []; ' +
    '~replacement~ return {stmt: stmt, params: params, type: \'~queryType~\'}; }; })()';

var foreachParamRegex = /(\w+)\s*=\s*([\w\s',\(\)]+)\s*(?:,|$)/mg;

Compiler.prototype.preCompile = function(input){
    var root = parse(input),
        queryType = root.content,
        rplc = '',
        fns = {where: false, set: false, trim: false},
        context,
        evalContext = 'm';
    _traverse(root, function(node, start){
        switch(node.type){
            case 'query':
                break;
            case 'where':
                if(queryType !== 'insert'){
                    if(start){
                        fns.where = true;
                        rplc += ' var whereClause = \' \'; ';
                        context = 'where';
                    } else {
                        rplc += ' var whereResult = _where(whereClause); ';
                        rplc += ' stmt += (whereResult.trim()) ? ( \' WHERE \' + whereResult ) : \'\'; ';
                        context = '';
                    }
                }
                break;
            case 'set':
                if(queryType === 'update'){
                    if(start){
                        fns.set = true;
                        rplc += ' var setClause = \' \'; ';
                        context = 'set';
                    } else {
                        rplc += ' var setResult = _set(setClause); ';
                        rplc += ' stmt += (setResult.trim()) ? ( \' SET \' + setResult ) : \'\'; ';
                        context = '';
                    }
                }
                break;
            case 'trim':
                if(start){
                    fns.trim = true;
                    rplc += ' var trimClause = \' \'; ';
                    context = 'trim';
                } else {
                    rplc += ' var trimResult = _trim(trimClause, \'' + node.evaluation + '\'); ';
                    rplc += ' stmt += (trimResult.trim()) ? trimResult : \'\'; ';
                    context = '';
                }
                break;
            case 'if':
                if(start){
                    rplc += ' if(' + _evalNormalize(node.evaluation, evalContext) + ') { ';
                } else {
                    rplc += ' } ';
                }
                break;
            case 'foreach':
                var options = {
                    item: 'item',
                    collection: 'list',
                    open: '\'\'',
                    close: '\'\'',
                    sep: '\'\''
                };
                if(start){
                    var matched = null;
                    // default foreach options
                    while((matched = foreachParamRegex.exec(node.evaluation)) !== null){
                        var optionKey = matched[1].trim();
                        var optionValue = matched[2].trim();
                        if(options.hasOwnProperty(optionKey)){
                            // override foreach options
                            if(optionKey === 'collection'){
                                optionValue = _evalNormalize(optionValue, evalContext);
                            }
                            options[optionKey] = optionValue;
                        }
                    }
                    rplc += ' ' + (context ? context + 'Clause' : 'stmt') + ' += ' + options.open + ';';
                    rplc += '   var close = ' + options.close + ';';
                    rplc += ' for(var i=0; i<' + options.collection + '.length; i++){ ';
                    rplc += '   var ' + options.item + ' = ' + options.collection + '[i];';
                    rplc += ' if(i > 0){' + (context ? context + 'Clause' : 'stmt') + ' += ' + options.sep + '; }';
                    evalContext = '';
                } else {
                    evalContext = 'm';
                    rplc += ' } ';
                    rplc += ' ' + (context ? context + 'Clause' : 'stmt') + ' += close;';
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
                rplc += ' params.push(' + _evalNormalize(node.evaluation, evalContext) + '); ';
                break;
        }
        //console.log(node);
    });
    var resultFn = fn.replace('~replacement~', rplc).replace('~whereFn~', fns.where ? whereFn : '')
        .replace('~setFn~', fns.set ? setFn : '').replace('~trimFn~', fns.trim ? trimFn : '')
        .replace('~queryType~', queryType);
    /*jslint evil: true */
    return eval(resultFn);
    /*jslint evil: false */
};

module.exports = new Compiler().preCompile;

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
        'UPDATE ABCD_A {#set} ,  a={{a}}, b={{b}}{/set}',
        'UPDATE TABLE_A \
        {#set }\
            {#if a > 0} column_a = {{a}},{/if}\
            {#if b} column_b = {{b}}, {/if} \
            {#if c} column_c = {{c.value}}, {/if} \
        {/ set}\
        {#where}\
            {#if a > 0} AND column_a = {{a}} {/if}\
        {/ where}',
        'INSERT INTO table (\
            {#trim (,)}\
                {#if a > 0} column_a,{/if}\
                {#if b} column_b, {/if}\
            {/trim}\
        ) values (\
            {#trim (,)}\
                {#if a > 0} {{a}},{/if}\
                {#if b} {{b}}, {/if} \
            {/trim}\
        )',
        'SELECT * FROM A'
    ];

    for(var i in testStr){
        console.log('=================== ' + i + ' ===================');
        var compile = module.exports(testStr[i]);
        console.log('precompiled: ', compile.toString());
        var result = compile({a: 2, b: 'abc', c: {value: 'a'}});
        console.log('result: ', result);

    }
}
_test();
*/
