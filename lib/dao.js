/**
 * Created by kyungmi.koong on 2015-04-23.
 */

'use strict';

var _ = require('lodash');
var logger = require('./log-manager');
var JSON5 = require('json5');
var fs = require('fs');
var Handlebars = require('handlebars');
var path = require('path');
//var DBException = require('./db-error');

var mappers = {};

function _logging(info, params, err, result) {
    var prefix = 'Query [' + info.dao + '.' + info.method + '] execution with params ';
    if(err) {
        logger.error(prefix, params, 'was failed: ', err);
    } else {
        logger.info(prefix, params, 'result: ', result);
    }
}

function _executeQuery(info, query, params, connection, callback){
    var self = this;
    var template = Handlebars.compile(query);
    if(!connection) {
        self._connector.beginConnection(function (err, newConn) {
            if (err) {
                _logging(info, params, err);
                // TODO 공통 error 처리
            } else {
                newConn.query(template(params), function (err, result) {
                    self._connector.endConnection(newConn);
                    if (err) {
                        // TODO 공통 error 처리
                    }
                    _logging(info, params, err, result);
                    callback(err, result);
                });
            }
        });
    } else {
        connection.query(template(params), function (err, result) {
            if (err) {
                // TODO 공통 error 처리
            }
            _logging(info, params, err, result);
            callback(err, result);
        });
    }
}

function _getExecutable(info, query, params){
    return function(connection, result, callback){
        if(connection) {
            var template = Handlebars.compile(query);
            connection.query(template(params), function (err, result) {
                if (err) {
                    // TODO 공통 error 처리
                }
                _logging(info, params, err, result);
                if (_.isFunction(callback)) {
                    callback(err, connection, result);
                }
            });
        } else {
            callback('There is no connection.');
        }
    };
}

function Mapper(mapperName, options) {
    this._options = options;
    this._name = mapperName;
    this._file = (typeof options === 'object') ? options.file : options;
    this._queries = {};
    this._connector = null;
}

Mapper.prototype.makeMappers = function(){
    var self = this;
    _.forEach(self._queries, function(sql, methodName){
        self[methodName] = function () {
            var _self = this;
            var params, connection, callback;
            if(arguments.length > 0){
                params = (_.isPlainObject(arguments[0])) ? arguments[0] : {};
                callback = (_.isFunction(arguments[arguments.length - 1])) ?
                    arguments[arguments.length - 1] : undefined;
                if((arguments.length === 2 && !callback) || (arguments.length === 3)){
                    connection = arguments[1];
                }
            }
            var info = {dao: self._name, method: methodName};
            if (_.isFunction(callback)) {
                _executeQuery.call(_self, info, sql, params, connection, callback);
            } else {
                return _getExecutable.call(_self, info, sql, params);
            }
        };
    });
};

Mapper.prototype.checkConf = function(){
    var self = this;
    if(!self._fileLoaded) {
        var file = (typeof self._options === 'object') ? self._options.file : self._options;
        try {
            // TODO file json/json5
            var content = fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');
            self._queries = JSON5.parse(content);
            self.makeMappers();
            self._fileLoaded = true;
        } catch (e) {
            if(e.code === 'ENOENT'){
                logger.error(self.name + ' mapper configuration file not found: ' + file);
            } else {
                logger.error('Unknown error occurred: ', e);
            }
        }
    }
};

Mapper.prototype.setConnector = function(connector){
    this._connector = connector;
};

var initialized = false;

module.exports.init = function(mapperOptions){
    if(mapperOptions && !initialized) {
        for (var mapperName in mapperOptions) {
            if (mapperOptions.hasOwnProperty(mapperName)) {
                mappers[mapperName] = new Mapper(mapperName, mapperOptions[mapperName]);
            }
        }
        initialized = false;
    } else if(!mapperOptions){
        console.warn('mapper options should be not empty.');
    } else {
        console.warn('dao has been already initialized.');
    }
};

module.exports.getMapper = function(mapperName, dbConnector){
    if(mappers[mapperName]){
        var mapper = mappers[mapperName];
        mapper.setConnector(dbConnector);
        mapper.checkConf();
        return mapper;
    }
};