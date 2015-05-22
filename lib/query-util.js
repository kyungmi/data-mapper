/**
 * Created by kyungmi.koong on 2015-05-22.
 */

var Handlebars = require('handlebars');

var QUERY_TYPE = Object.freeze({
    save: 'INSERT INTO {{table}} ( {{columnsTemplate}} ) VALUES ( {{valuesTemplate}} )',
    findOne: 'SELECT {{columnsTemplate}} FROM {{table}} WHERE {{whereClause}}',
    find: 'SELECT {{columnTemplate}} FROM {{table}} WHERE {{whereClause}}',
    update: 'UPDATE {{table}} SET {{setClause}} WHERE {{whereClause}}',
    remove: 'DELETE FROM {{table}} WHERE {{whereClause}}',
    count: 'SELECT COUNT(*) FROM {{table}} WHERE {{whereClause}}'
});

module.exports.generate = function(type, mapConf){
    var typeConf = QUERY_TYPE[type];
};

function _makeVariables(mapConf){
    var result = {};
    result.table = mapConf.table;

    var columns = [];
    if(mapConf.columns){
        for(var colName in mapConf.columns){
            if(mapConf.columns.hasOwnProperty(colName)){
                var col = mapConf.columns[colName];
                var model, type;
                if(typeof col === 'string'){
                    model = col;
                } else {
                    model = col.model;
                    type = col.type;
                }
                '{{' +  + '}}'
                columns.push('{{#if}}' + '{{/if}}');
            }
        }
    }

    return result;
}