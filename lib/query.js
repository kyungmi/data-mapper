/**
 * Created by kyungmi.koong on 2015-05-22.
 */

'use strict';

function Query(template){
    this.type = null;   // select, insert, update, delete
    this.template = template;
    this.precompiledTemplate = template;
    this.params = null;
    this.preparedStatement = null;
    this.statementArgs = [];
}

var REGEX_FIND_TYPE = /^[\s\(]*(select|update|delete|insert)\s+.*$/i;
var REGEX_WHERE_CLAUSE = /{#where(\s?\(.*\))?}(.*){\/where}/i;
var REGEX_SET_CLAUSE = /{#set(\s?\(.*\))?}(.*){\/set}/gi;
var REGEX_VALUES_CLAUSE = /{#values(\s?\(.*\))?}(.*){\/values}/i;
var REGEX_IF_CLAUSE = /{#if(\s?\(.*\))?}([^#\/]*){\/if}/gi;
var REGEX_PLACE_HOLDER = /{{([\w\.])*}}/g;
function _getType(template){
    var matched = REGEX_FIND_TYPE.exec(template);
    return (matched.length > 1) ? matched[1].toLowerCase() : '';
}

Query.prototype.preCompile = function(){
    // get query type
    this.type = _getType(this.template);
    // remove clauses not matched with query type
    switch(this.type){
        case 'select':
            // only where
            this.precompiledTemplate = this.template.replace(REGEX_SET_CLAUSE, '').replace(REGEX_VALUES_CLAUSE, '');
            break;
        case 'insert':
            // only values
            this.precompiledTemplate = this.template.replace(REGEX_SET_CLAUSE, '').replace(REGEX_WHERE_CLAUSE, '');
            break;
        case 'update':
            // only set, where
            this.precompiledTemplate = this.template.replace(REGEX_VALUES_CLAUSE, '');
            break;
        case 'delete':
            // only where
            this.precompiledTemplate = this.template.replace(REGEX_SET_CLAUSE, '').replace(REGEX_VALUES_CLAUSE, '');
            break;
    }
    console.log('Query precompile: ', this.template, '=>', this.precompiledTemplate);
};

function _eval(evaluation, context){

}

Query.prototype.compile = function(params){
    this.params = params;
    if(this.params){
        //if and placeholder
        var matched;
        var input = this.precompiledTemplate;

        this.params._eval = function(evalString, model){
            evalString = evalString.trim().replace(/[\s\(\)]*/g, '');
            return eval('(function(){ return this.' + evalString + '; }).bind(model)()');
        };

        while((matched = REGEX_IF_CLAUSE.exec(input)) !== null){
            var result = this.params._eval(matched[1], params);
            console.log(matched, result);

        }
    }

    //where or set clause

    // set preparedStatement
    // set statement argument
};

module.exports = Query;


function _test(){
    var query = new Query('select * from table {#set} abcd {/set}{#where} {#if (a)} AND col_a = {{a}}  {/if} {/where}');
    query.preCompile();
    query.compile({a: 'abcd'});
}
_test();