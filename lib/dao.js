/**
 * Created by kyungmi.koong on 2015-04-23.
 */

'use strict';

var _ = require('lodash');
//var async = require('async');
var logger = require('./log-manager');
var JSON5 = require('json5');
var fs = require('fs');
var Handlebars = require('handlebars');
//var dbConnection = require('./db-connection');
//var DBException = require('./db-error');

//var queries = {};

//var testMappers = {};
//testMappers.user = {
//    connection: 'mysql',
//    queries: {
//        getUserById: 'SELECT * FROM t_user WHERE id = :id',
//        getUsers: 'SELECT * FROM t_user',
//        modifyUser: 'UPDATE t_user SET name = :name, phone = :phone WHERE id = :id',
//        deleteUserById: 'DELETE FROM t_user WHERE id = :id',
//        deleteAllUser: 'DELETE FROM t_user',
//        addUser: 'INSERT INTO t_user VALUES (:id, :name, :phone)'
//    }
//};

var mappers = {};

function _logging(info, params, err, result) {
    var prefix = 'Query [' + info.dao + '.' + info.method + '] execution with params ';
    if(err) {
        logger.error(prefix, params, 'was failed: ', err);
    } else {
        logger.info(prefix, params, 'result: ', result);
    }
}

function Mapper(mapperName, options) {
    this._options = options;
    this._name = mapperName;
    this._file = (typeof options === 'object') ? options.file : options;
    this._queries = {};
    this._connector = null;
}

Mapper.prototype.checkConf = function(){
    var self = this;
    if(!self._fileLoaded) {
        var file = (typeof self._options === 'object') ? self._options.file : self._options;
        try {
            // TODO file json/json5
            var content = fs.readFileSync(file, 'utf8');
            self._queries = JSON5.parse(content);

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
                        //_getExecutable.call(_self, info, sql, params)(null, null, callback);
                    } else {
                        return _getExecutable.call(_self, info, sql, params);
                    }
                };
            });
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
/*
Mapper.prototype.lazyExcutable = function(queryName){
    var self = this;
    return function(params, connection,  callback){
        self.loadFile(function(err) {
            if(err){
                // TODO error 처리
                console.error('File is not loaded');
                return callback('File is not loaded');
            }
            var query = self._queries[queryName];
            if(!query){
                return callback(queryName + ' query is not exist');
            }
            var template = Handlebars.compile(query);
            if (connection) {
                connection.query(template(params), function (err, result) {
                    if (err) {
                        // TODO 공통 error 처리
                        console.error(err);
                    }
                    _logging({type: self.name, name: queryName}, params, err, result);
                    if (_.isFunction(callback)) {
                        callback(err, connection, result);
                    }
                });
            } else {
                self.connector.beginConnection(function (err, newConn) {
                    newConn.query(template(params), function (err, result) {
                        if (err) {
                            // TODO 공통 error 처리
                            console.error(err);
                        }
                        _logging({type: self.name, name: queryName}, params, err, result);
                        if (_.isFunction(callback)) {
                            callback(err, connection, result);
                        }
                    });
                });
            }
        });
    };
};
*/
Mapper.prototype.setConnector = function(connector){
    this.connector = connector;
};


//function _getConfigurations(){
//    //FIXME get from mapper configuration files
//    return testMappers;
//}

function _executeQuery(info, query, params, connection, callback){
    var self = this;
    var template = Handlebars.compile(query);
    if(!connection) {
        self.connector.beginConnection(function (err, newConn) {
            if (err) {
                _logging(info, params, err);
                // TODO 공통 error 처리
            } else {
                newConn.query(template(params), function (err, result) {
                    self.connector.endConnection(newConn);
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

/*(function initialize(){
    var mappers = _getConfigurations();
    _.forEach(mappers, function(mapper, type){
        if(queries[type]){
            logger.warn('Mapper type \'' + type + '\' is duplicated. The latter one will be ignored.');
        } else {
            var methodsByType = {};
            _.forEach(mapper.queries, function(sql, methodName){
                if(methodsByType[methodName]){
                    logger.warn('Query name \'' + methodName + '\' of the mapper type \'' + type +
                        '\' is duplicated. The latter one will be ignored.');
                } else {
                    methodsByType[methodName] = function () {
                        var self = this;
                        var params, connection, callback;
                        if(arguments.length > 0){
                            params = (_.isPlainObject(arguments[0])) ? arguments[0] : {};
                            callback = (_.isFunction(arguments[arguments.length - 1])) ?
                                arguments[arguments.length - 1] : undefined;
                            if((arguments.length === 2 && !callback) || (arguments.length === 3)){
                                connection = arguments[1];
                            }
                        }
                        var info = {type: type, name: methodName};
                        if (_.isFunction(callback)) {
                            _executeQuery.call(self, info, sql, params, connection, callback);
                            //_getExecutable.call(self, info, sql, params)(null, null, callback);
                        } else {
                            return _getExecutable.call(self, info, sql, params);
                        }
                    };
                }
            });
            queries[type] = methodsByType;
        }
    });
})();*/

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
    //return queries[mapperName];
};