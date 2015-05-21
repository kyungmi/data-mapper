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
var DBException = require('./db-error');

var mappers = {};

function _logging(daoInfo, err, result) {
    if(daoInfo) {
        var prefix = 'Query [' + daoInfo.name + '.' + daoInfo.mapper + '] execution with params ';
        if (err) {
            logger.error(prefix, daoInfo.params, 'was failed: ', err);
        } else {
            logger.info(prefix, daoInfo.params, 'result: ', result);
        }
    } else {
        logger.error(err);
    }
}

function _execute(context, callback, endConnection, executable) {
    context.connection.query(context.daoInfo.query, function (err, result) {
        if(endConnection) {
            context.connector.endConnection(context.connection);
        }
        if(_.isFunction(callback)){
            if (err) {
                callback(new DBException(err));
            } else {
                if(context.setData && executable){
                    context.setData(result);
                    callback();
                } else {
                    callback(null, result);
                }
            }
        }
        _logging(context.daoInfo, err, result);
    });
}

function _executeQuery(context, callback){
    if(!context){
        callback('Invalid context');
        _logging(null, 'Invalid context');
        return;
    }

    if(!context.connection) {
        context.connector.beginConnection(function (err, newConn) {
            if (err) {
                callback(new DBException(err));
                _logging(context.daoInfo, err);
            } else {
                context.connection = newConn;
                _execute(context, callback, true);
            }
        });
    } else {
        _execute(context, callback, false);
    }
}

function _getExecutable(originalContext){
    return function (context, callback) {
        context = _.extend({}, originalContext, context);
        if(!context || !context.connection) {
            callback('Invalid context');
            _logging(null, 'Invalid context');
        } else {
            _execute(context, callback, false, true);
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
        /**
         * auto generated query execution methods for each DAO
         * @example
         *      ...
         *      var Transaction = dataMapper.Transaction;
         *      var userDao = dataMapper.dao('user');
         *      ...
         *      var transaction = new Transaction( [ userDao.findUser({userId: 1234}), ... ] );
         *      ...
         *      userDao.findUser({userId: 1234}, function(err, result){ ... });
         *      ...
         *      var executable = userDao.findUser({userId: 1234}, connection);
         *      executable(function(err, result){ ... });
         *      ...
         *      userDao.findUser({userId: 1234},
         *      ...
         * @returns return type depends on the arguments
         *      ([params])
         *          => returns query executable function(callback) in transactional job
         *      ([params,] callback)
         *          => execute query with a new connection
         *      (params, context)
         *          => returns query executable function(callback) with existing connection context
         *      (params, callback, context)
         *          => execute query with existing connection context
         */
        self[methodName] = function () {
            var params = {}, context, callback;
            if(arguments.length > 0){
                params = (_.isPlainObject(arguments[0])) ? arguments[0] : {};
                if(arguments.length > 1) {
                    if(_.isFunction(arguments[1])){
                        callback = arguments[1];
                    } else {
                        context = arguments[1];
                    }
                    if(arguments.length > 2){
                        context = arguments[2];
                    }
                }
            }

            var template = Handlebars.compile(sql);

            context = context || {};
            context.daoInfo = {
                name: self._name,
                mapper: methodName,
                sql: sql,
                params: params,
                query: template(params)
            };
            if(!context.connector){
                context.connector = self._connector;
            }
            return callback ? _executeQuery(context, callback) : _getExecutable(context);
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