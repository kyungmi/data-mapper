/**
 * Created by kyungmi.koong on 2015-04-23.
 */

'use strict';

var _ = require('lodash');
//var async = require('async');
var logger = require('./log-manager');
var JSON5 = require('json5');
var NodeProxy = require('node-proxy');
var fs = require('fs');
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
    var prefix = 'Query [' + info.type + '.' + info.name + '] execution with params ';
    if(err) {
        logger.error(prefix, params, 'was failed: ', err);
    } else {
        logger.info(prefix, params, 'result: ', result);
    }
}

function Mapper(mapperName, options) {
    this.name = mapperName;
    this.file = (typeof options === 'object') ? options.file : options;
    this.queries = {};
    this.connector = null;
}

Mapper.prototype.loadFile = function(callback){
    if(!this.fileLoaded) {
        // TODO file json/json5
        var file = (typeof this.options === 'object') ? this.options.file : this.options;
        fs.readFile(file, function (err, content) {
            if (err) {
                callback(err);
            } else {
                this.queries = JSON5.parse(content);
                this.fileLoaded = true;
                callback();
            }
        });
    } else {
        callback();
    }
};
Mapper.prototype.lazyExcutable = function(queryName){
    var self = this;
    return function(params, connection, /*result,*/ callback){
        self.loadFile(function(err) {
            if(err){
                // TODO error 처리
                console.error('File is not loaded');
                return callback('File is not loaded');
            }
            var query = self.queries[queryName];
            if(!query){
                return callback(queryName + ' query is not exist');
            }
            if (connection) {
                connection.query(query, params, function (err, result) {
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
                    newConn.query(query, params, function (err, result) {
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

Mapper.create = function(mapperName, options){
    var proxyHandler = {
        get: function(obj, queryMethod) {
            // TODO arguemnt
            return obj.lazyExecutable(queryMethod);
        },
        set: function(obj, method){
            return obj[method];
        }
    };
    var proxy = NodeProxy.create(proxyHandler, Mapper.prototype);
    var mapperObject = Object.create(proxy, {name: {value: mapperName}, options: {value: options}});

    return mapperObject;
};

Mapper.prototype.setConnector = function(connector){
    this.connector = connector;
};


//function _getConfigurations(){
//    //FIXME get from mapper configuration files
//    return testMappers;
//}

/*function _executeQuery(info, query, params, connection, callback){
    if(!connection) {
        dbConnection.beginConnection(function (err, newConn) {
            if (err) {
                _logging(info, params, err);
                // TODO 공통 error 처리
            } else {
                newConn.query(query, params, function (err, result) {
                    dbConnection.endConnection(newConn);
                    if (err) {
                        // TODO 공통 error 처리
                    }
                    _logging(info, params, err, result);
                    callback(err, result);
                });
            }
        });
    } else {
        connection.query(query, params, function (err, result) {
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
            connection.query(query, params, function (err, result) {
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
}*/

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
                mappers[mapperName] = Mapper.create(mapperName, mapperOptions[mapperName]);
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
        mapper.connector = dbConnector;
        //mapper.setConnector(dbConnector);
        return mapper;
    }
    //return queries[mapperName];
};