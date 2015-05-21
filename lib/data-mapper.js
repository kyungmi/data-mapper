/**
 * Created by kyungmi.koong on 2015-05-15.
 */

'use strict';

var _ = require('lodash');
var dao = require('./dao');
var dbConnection = require('./db-connection');
//var DBException = require('./db-error');

var initialized = false;
var dataMapperOptions = {connectors: {}, mappers: {}};

module.exports.Transaction = require('./transaction');

module.exports.init = function(options){
    if(options && !initialized) {
        dataMapperOptions = _.extend(dataMapperOptions, options);
        dbConnection.init(dataMapperOptions.connectors);
        dao.init(dataMapperOptions.mappers);
        initialized = true;
    } else if(!options){
        console.warn('options should be not empty.');
    } else {
        console.warn('data-mapper has been already initialized.');
    }
    return this;
};

module.exports.dao = function(mapperName){
    if(!initialized){
        console.warn('Not initialized.');
    }
    if(dataMapperOptions.mappers[mapperName]){
        var connectorName = '';
        if(typeof dataMapperOptions.mappers[mapperName] === 'object'){
            connectorName = dataMapperOptions.mappers[mapperName].connector;
        }
        var dbConnector = dbConnection.getConnector(connectorName);
        return dao.getMapper(mapperName, dbConnector);
    }
};